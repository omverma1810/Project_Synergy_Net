// Default to the same-origin `/api` path so requests flow through the Next.js
// rewrite proxy (see next.config.mjs) — no CORS needed, works locally, on
// Vercel, and on Cloud Run. Override with an absolute base (must include /api)
// only if you want the browser to call the backend directly.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

// Shared in-flight refresh promise so concurrent expiry doesn't trigger
// multiple simultaneous refresh calls.
let _refreshing: Promise<void> | null = null;

async function _doRefresh(): Promise<void> {
  const refresh = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
  if (!refresh) {
    _clearTokens();
    throw new Error('Session expired. Please sign in again.');
  }
  const res = await fetch(`${API_BASE}/auth/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) {
    _clearTokens();
    throw new Error('Session expired. Please sign in again.');
  }
  const data = await res.json();
  localStorage.setItem('auth_token', data.access);
  document.cookie = `auth_token=${data.access}; path=/; SameSite=Lax`;
}

function _clearTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_token');
  localStorage.removeItem('refresh_token');
  document.cookie = 'auth_token=; path=/; max-age=0';
}

function _redirectToLogin() {
  _clearTokens();
  // Defer navigation so any in-flight fetches complete cleanly before the
  // page unloads — prevents Safari "Load failed" / "The network connection
  // was lost" errors when window.location changes mid-request.
  if (typeof window !== 'undefined') {
    setTimeout(() => { window.location.href = '/login'; }, 100);
  }
}

function _makeHeaders(isFormData: boolean): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';
  return headers;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  isFormData = false,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ..._makeHeaders(isFormData), ...(options.headers as Record<string, string> || {}) },
  });

  // Transparent token refresh on 401
  if (res.status === 401) {
    try {
      if (!_refreshing) _refreshing = _doRefresh().finally(() => { _refreshing = null; });
      await _refreshing;
    } catch {
      // Tokens cleared in _doRefresh; schedule deferred redirect after error propagates
      _redirectToLogin();
      throw new Error('Session expired. Please sign in again.');
    }

    // Retry original request with the newly-issued access token
    const retry = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ..._makeHeaders(isFormData), ...(options.headers as Record<string, string> || {}) },
    });
    if (!retry.ok) {
      const err = await retry.json().catch(() => ({ detail: retry.statusText }));
      throw Object.assign(new Error(err.detail || 'Request failed'), { status: retry.status, data: err });
    }
    if (retry.status === 204) return undefined as T;
    return retry.json();
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw Object.assign(new Error(err.detail || err.error || err.message || 'Request failed'), { status: res.status, data: err });
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ access: string; refresh: string }>('/auth/login/', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: (data: {
      email: string; password: string; first_name: string; last_name: string; company_name: string;
    }) =>
      request<{ id: string; email: string }>('/auth/register/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    refresh: (refresh: string) =>
      request<{ access: string }>('/auth/token/refresh/', {
        method: 'POST',
        body: JSON.stringify({ refresh }),
      }),
    me: () => request<{ id: string; email: string; first_name: string; last_name: string; company_name: string }>('/auth/me/'),
    updateProfile: (data: Partial<{ first_name: string; last_name: string; company_name: string }>) =>
      request<unknown>('/auth/me/', { method: 'PATCH', body: JSON.stringify(data) }),
  },

  projects: {
    list: () => request<ProjectSummary[]>('/projects/'),
    get: (id: number) => request<ProjectDetail>(`/projects/${id}/`),
    create: (data: FormData) => request<ProjectDetail>('/projects/', { method: 'POST', body: data }, true),
    createJson: (data: Record<string, unknown>) =>
      request<ProjectDetail>('/projects/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Record<string, unknown>) =>
      request<ProjectDetail>(`/projects/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/projects/${id}/`, { method: 'DELETE' }),
    uploadBudget: (projectId: number, file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('file_name', file.name);
      fd.append('file_type', file.name.split('.').pop()?.toUpperCase() || 'CSV');
      return request<Budget>(`/projects/${projectId}/upload-budget/`, { method: 'POST', body: fd }, true);
    },
    lineItems: (budgetId: number) => request<BudgetLineItem[]>(`/projects/budgets/${budgetId}/line-items/`),
    vetting: (id: number, data: { vetting_status: string; vetting_notes?: string }) =>
      request<ProjectDetail>(`/projects/${id}/vetting/`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  territories: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<Territory[]>(`/territories/${qs}`);
    },
    get: (id: number) => request<TerritoryDetail>(`/territories/${id}/`),
    partners: (id: number) => request<TerritoryPartner[]>(`/territories/${id}/partners/`),
    alerts: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<PolicyAlert[]>(`/territories/alerts/${qs}`);
    },
  },

  analysis: {
    create: (projectId: number, budgetId: number) =>
      request<Analysis>('/analysis/', { method: 'POST', body: JSON.stringify({ project: projectId, budget: budgetId }) }),
    get: (id: number) => request<Analysis>(`/analysis/${id}/`),
    list: (projectId?: number) => {
      const qs = projectId ? `?project=${projectId}` : '';
      return request<Analysis[]>(`/analysis/${qs}`);
    },
  },

  reports: {
    list: () => request<Report[]>('/reports/'),
    generate: (analysisId: number, format: 'PDF' | 'XLSX') =>
      request<Report>('/reports/generate/', {
        method: 'POST',
        body: JSON.stringify({ analysis: analysisId, format }),
      }),
  },

  advisor: {
    ask: (question: string) =>
      request<{ answer: string }>('/advisor/', {
        method: 'POST',
        body: JSON.stringify({ question }),
      }),
  },
};

// ── Type definitions ────────────────────────────────────────────────────────

export interface ProjectSummary {
  id: number;
  title: string;
  slug: string;
  type: string;
  genre: string;
  total_budget: string;
  currency: string;
  status: string;
  budget_count: number;
  latest_analysis_status: string | null;
  vetting_status?: string;
  created_at: string;
}

export interface ProjectDetail extends ProjectSummary {
  synopsis: string;
  language: string;
  shoot_start_date: string | null;
  shoot_end_date: string | null;
  shoot_duration_days: number | null;
  script_file: string | null;
  shooting_plan_file: string | null;
  cast_crew_info: Record<string, unknown>;
  spend_estimates: Record<string, number>;
  production_timeline: Record<string, string>;
  vetting_notes: string;
  vetting_reviewed_at: string | null;
  budgets: Budget[];
}

export interface Budget {
  id: number;
  project: number;
  file_name: string;
  file_type: string;
  extraction_status: string;
  confidence_score: string | null;
  extracted_at: string | null;
  line_items: BudgetLineItem[];
  line_item_count: number;
  created_at: string;
}

export interface BudgetLineItem {
  id: number;
  description: string;
  category: string;
  amount: string;
  currency: string;
  is_above_the_line: boolean;
  is_local_eligible: boolean;
}

export interface Territory {
  id: number;
  name: string;
  country_code: string;
  region: string;
  incentive_type: string;
  base_percentage: string;
  provincial_percentage: string;
  is_stackable: boolean;
  min_spend: string | null;
  max_rebate_cap: string | null;
  is_capped: boolean;
  currency: string;
  status: string;
  rebate_timing_months_min: number;
  rebate_timing_months_max: number;
  loan_against_rebate_available: boolean;
  documentary_eligible: boolean;
  animation_eligible: boolean;
  streaming_eligible: boolean;
  sci_fi_eligible: boolean;
  official_url: string;
  last_verified_at: string | null;
  latitude: string | null;
  longitude: string | null;
  film_commission: string;
  film_commission_url: string;
}

export interface TerritoryDetail extends Territory {
  rules: TerritoryRule[];
  compliance_items: ComplianceItem[];
  genre_profiles: GenreProfile[];
  partners: TerritoryPartner[];
  description: string;
  government_support: string;
  local_associations: { name: string; url: string }[];
}

export interface TerritoryRule {
  id: number;
  rule_type: string;
  configuration: Record<string, unknown>;
  priority: number;
}

export interface ComplianceItem {
  id: number;
  item_type: string;
  description: string;
  deadline_type: string;
  is_mandatory: boolean;
  notes: string;
}

export interface GenreProfile {
  id: number;
  genre: string;
  bonus_percentage: string;
  eligibility_notes: string;
}

export interface TerritoryPartner {
  id: number;
  name: string;
  partner_type: string;
  email: string;
  phone: string;
  website: string;
  bio: string;
  is_vetted: boolean;
}

export interface PolicyAlert {
  id: number;
  territory: number | null;
  territory_name: string | null;
  title: string;
  description: string;
  change_type: string;
  previous_value: string;
  new_value: string;
  effective_date: string | null;
  is_active: boolean;
  created_at: string;
}

export interface FinanceSnapshot {
  currency: string;
  total_budget: number;
  top_territory: string;
  top_territory_id: number;
  estimated_incentive: number;
  financing_pv: number;
  net_benefit: number;
  finance_gap: number;
  incentive_pct_of_budget: number;
  gap_pct_of_budget: number;
  rebate_timing_months: number;
  loan_against_rebate_available: boolean;
}

export interface RiskFlag {
  key: string;
  category: string;
  level: 'low' | 'medium' | 'high';
  tone: string;
  label: string;
  detail: string;
}

export interface Analysis {
  id: number;
  project: number;
  project_title: string;
  project_currency: string;
  budget: number;
  status: string;
  triggered_by: string;
  started_at: string | null;
  completed_at: string | null;
  results: AnalysisResult[];
  finance_snapshot: FinanceSnapshot | null;
  created_at: string;
}

export interface AnalysisResult {
  id: number;
  territory: number;
  territory_name: string;
  territory_country: string;
  territory_percentage: string;
  territory_region: string;
  territory_incentive_type: string;
  rank: number;
  qualified_spend_total: string;
  estimated_rebate: string;
  estimated_rebate_pct: string;
  logistics_premium: string;
  net_benefit: string;
  payback_timeline_months: number;
  confidence_score: string;
  currency: string;
  rebate_timing_months: number;
  loan_against_rebate_available: boolean;
  financing_benefit_estimate: string;
  recoupment_priority: string;
  risk_flags: RiskFlag[];
  risk_level: 'low' | 'medium' | 'high';
  details: {
    category_breakdown: Record<string, { qualified: number; total: number }>;
    checklist_items: ComplianceItem[];
    effective_percentage: number;
    base_percentage: number;
    provincial_percentage: number;
    genre_bonus: number;
    treaty_bonus: number;
    total_budget: number;
  };
}

export interface Report {
  id: number;
  analysis: number;
  project_title: string;
  format: string;
  file_url: string | null;
  file_size: number | null;
  generated_at: string;
  download_count: number;
  expiry_date: string | null;
}
