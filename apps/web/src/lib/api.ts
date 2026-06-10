const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function api(endpoint: string, options: RequestInit = {}) {
  const url = `${API_URL}/api${endpoint}`;

  const token =
    typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  const isFormData = options.body instanceof FormData;

  const response = await fetch(url, {
    ...options,
    headers: {
      ...(!isFormData && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || error.error || 'API request failed');
  }

  return response.json();
}

export const auth = {
  login: (email: string, password: string) =>
    api('/auth/login/', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data: Record<string, unknown>) =>
    api('/auth/register/', { method: 'POST', body: JSON.stringify(data) }),
  me: () => api('/auth/me/'),
};

export const projects = {
  list: () => api('/projects/'),
  create: (data: Record<string, unknown>) =>
    api('/projects/', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: number) => api(`/projects/${id}/`),
  uploadBudget: (id: number, formData: FormData) =>
    api(`/projects/${id}/upload-budget/`, { method: 'POST', body: formData }),
};

export const territories = {
  list: () => api('/territories/'),
};

export const analysis = {
  trigger: (projectId: number) =>
    api(`/analysis/trigger/${projectId}/`, { method: 'POST' }),
  results: (analysisId: number) => api(`/analysis/${analysisId}/results/`),
};

export const reports = {
  list: () => api('/reports/'),
  generate: (analysisId: number, format: 'PDF' | 'EXCEL') =>
    api(`/reports/generate/${analysisId}/`, {
      method: 'POST',
      body: JSON.stringify({ format }),
    }),
  download: (reportId: number) => api(`/reports/download/${reportId}/`),
};
