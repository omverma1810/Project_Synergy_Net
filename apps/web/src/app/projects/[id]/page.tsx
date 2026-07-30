'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChartBarIcon,
  DocumentArrowDownIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { api, ProjectDetail, Analysis, AnalysisResult, FinancialModel } from '@/lib/api';
import Layout from '@/components/Layout';

const TABS = ['Overview', 'Budget', 'Analysis', 'Financials', 'Reports'];

const STATUS_BADGES: Record<string, string> = {
  DRAFT: 'badge-muted', UPLOADED: 'badge-cyan', ANALYZING: 'badge-orange',
  REVIEW: 'badge-orange', COMPLETE: 'badge-green', ARCHIVED: 'badge-muted',
};

function fmt(n: string | number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(n));
}

function RankBadge({ rank }: { rank: number }) {
  const cls = rank === 1 ? 'rank-badge-1' : rank === 2 ? 'rank-badge-2' : rank === 3 ? 'rank-badge-3' : 'rank-badge-other';
  return <span className={cls}>#{rank}</span>;
}

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingReport, setGeneratingReport] = useState<'PDF' | 'XLSX' | null>(null);
  const [finModel, setFinModel] = useState<FinancialModel | null>(null);
  const [finLoading, setFinLoading] = useState(false);
  const [finError, setFinError] = useState('');
  const [finPdf, setFinPdf] = useState(false);
  const [bizPdf, setBizPdf] = useState(false);
  const [deckPdf, setDeckPdf] = useState(false);
  const [editRev, setEditRev] = useState(false);
  const [revRows, setRevRows] = useState<{ name: string; floor: string; base: string; breakout: string }[]>([]);
  const [savingRev, setSavingRev] = useState(false);

  useEffect(() => {
    const pid = parseInt(id);
    Promise.all([
      api.projects.get(pid),
      api.analysis.list(pid).catch(() => [] as Analysis[]),
    ]).then(([p, a]) => {
      setProject(p);
      setAnalyses(a);
    }).finally(() => setLoading(false));
  }, [id]);

  const handleAnalyze = async () => {
    if (!project) return;
    const budget = project.budgets?.[project.budgets.length - 1];
    if (!budget) { toast.error('No budget found. Upload a budget file or add spend estimates.'); return; }
    setAnalyzing(true);
    const t = toast.loading('Starting analysis…');
    try {
      const analysis = await api.analysis.create(project.id, budget.id);
      toast.success('Analysis started', { id: t });
      router.push(`/analysis?id=${analysis.id}`);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to start analysis', { id: t });
      setAnalyzing(false);
    }
  };

  // Lazily load the financial model when the Financials tab is first opened.
  useEffect(() => {
    if (activeTab !== 3 || finModel || finLoading || finError) return;
    setFinLoading(true);
    api.analysis.financialModel(parseInt(id))
      .then(setFinModel)
      .catch((e: unknown) => setFinError((e as Error).message || 'Could not build the financial model.'))
      .finally(() => setFinLoading(false));
  }, [activeTab, id, finModel, finLoading, finError]);

  const handleFinancialPdf = async () => {
    setFinPdf(true);
    try {
      const blob = await api.analysis.financialModelPdf(parseInt(id));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `synergy_financial_model_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Financial model PDF ready');
    } catch (e: unknown) {
      toast.error((e as Error).message || 'PDF generation failed');
    } finally {
      setFinPdf(false);
    }
  };

  const startEditRevenue = () => {
    setRevRows((finModel?.revenue_windows || []).map(w => ({
      name: w.name, floor: String(w.floor), base: String(w.base), breakout: String(w.breakout),
    })));
    setEditRev(true);
  };

  const reloadModel = () => { setFinModel(null); setFinError(''); };

  const saveRevenue = async () => {
    setSavingRev(true);
    try {
      const revenue_overrides = revRows.map(r => ({
        name: r.name,
        floor: parseFloat(r.floor) || 0,
        base: parseFloat(r.base) || 0,
        breakout: parseFloat(r.breakout) || 0,
      }));
      await api.projects.update(parseInt(id), { revenue_overrides });
      toast.success('Revenue inputs saved');
      setEditRev(false);
      reloadModel();
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Could not save revenue inputs');
    } finally {
      setSavingRev(false);
    }
  };

  const resetRevenue = async () => {
    setSavingRev(true);
    try {
      await api.projects.update(parseInt(id), { revenue_overrides: [] });
      toast.success('Reset to modelled defaults');
      setEditRev(false);
      reloadModel();
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Could not reset');
    } finally {
      setSavingRev(false);
    }
  };

  const downloadPdf = async (
    fetcher: () => Promise<Blob>,
    filename: string,
    setBusy: (b: boolean) => void,
    okMsg: string,
  ) => {
    setBusy(true);
    try {
      const blob = await fetcher();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(okMsg);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'PDF generation failed');
    } finally {
      setBusy(false);
    }
  };

  const handleBusinessPlan = () =>
    downloadPdf(() => api.analysis.businessPlanPdf(parseInt(id)), `synergy_business_plan_${id}.pdf`, setBizPdf, 'Business plan PDF ready');
  const handlePitchDeck = () =>
    downloadPdf(() => api.analysis.pitchDeckPdf(parseInt(id)), `synergy_pitch_deck_${id}.pdf`, setDeckPdf, 'Pitch deck PDF ready');

  const handleReport = async (format: 'PDF' | 'XLSX', analysisId: number) => {
    setGeneratingReport(format);
    try {
      const report = await api.reports.generate(analysisId, format);
      if (report.file_url) {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        const res = await fetch(report.file_url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `synergy_report_${report.id}.${format.toLowerCase()}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }
      toast.success(`${format} report ready`);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Report generation failed');
    } finally {
      setGeneratingReport(null);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="h-8 w-60 skeleton mb-2" />
        <div className="h-4 w-40 skeleton mb-6" />
        <div className="h-10 w-72 skeleton mb-6 rounded-xl" />
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="h-56 skeleton rounded-2xl" />
          <div className="h-56 skeleton rounded-2xl" />
        </div>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-synergy-muted mb-4">Project not found.</p>
          <Link href="/projects" className="btn-primary">Back to Projects</Link>
        </div>
      </Layout>
    );
  }

  const latestAnalysis = analyses.find(a => a.status === 'COMPLETE') || analyses[0];

  return (
    <Layout>
      <div className="flex items-start gap-4 mb-6">
        <Link href="/projects" className="text-synergy-muted hover:text-synergy-text transition-colors mt-1">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="page-title">{project.title}</h1>
            <span className={STATUS_BADGES[project.status] || 'badge-muted'}>{project.status?.toLowerCase()}</span>
            {project.vetting_status === 'APPROVED' && <span className="badge-green">vetted</span>}
            {project.vetting_status === 'FLAGGED' && <span className="badge-red">flagged</span>}
          </div>
          <p className="text-synergy-muted text-sm mt-1 capitalize">{project.type?.toLowerCase()} · {project.genre} · {project.language}</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={handleAnalyze}
          disabled={analyzing}
          className="btn-primary flex items-center gap-2 shrink-0"
        >
          {analyzing
            ? <span className="h-4 w-4 border-2 border-synergy-darker/30 border-t-synergy-darker rounded-full animate-spin" />
            : <ChartBarIcon className="h-4 w-4" />
          }
          <span className="hidden sm:inline">Run Analysis</span>
        </motion.button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-synergy-card/40 border border-synergy-border/40 rounded-xl p-1 w-full sm:w-fit overflow-x-auto">
        {TABS.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)}
            className={[
              'relative px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors duration-200 whitespace-nowrap flex-1 sm:flex-none',
              activeTab === i ? 'text-synergy-darker' : 'text-synergy-muted hover:text-synergy-text',
            ].join(' ')}
          >
            {activeTab === i && (
              <motion.span layoutId="projectTab" className="absolute inset-0 rounded-lg bg-gradient-cyan shadow-glow-cyan"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
            )}
            <span className="relative">{tab}</span>
          </button>
        ))}
      </div>

      <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {activeTab === 0 && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="glass-card p-6 space-y-3">
              <h2 className="section-title">Project Details</h2>
              {[
                ['Total Budget', project.total_budget ? fmt(project.total_budget, project.currency) : '—'],
                ['Currency', project.currency],
                ['Shoot Start', project.shoot_start_date || '—'],
                ['Shoot End', project.shoot_end_date || '—'],
                ['Duration', project.shoot_duration_days ? `${project.shoot_duration_days} days` : '—'],
                ['Vetting', project.vetting_status || 'PENDING'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-synergy-muted">{k}</span>
                  <span className="text-synergy-text font-medium">{v}</span>
                </div>
              ))}
            </div>
            {project.synopsis && (
              <div className="glass-card p-6">
                <h2 className="section-title mb-3">Synopsis</h2>
                <p className="text-sm text-synergy-muted leading-relaxed">{project.synopsis}</p>
              </div>
            )}
            {Object.keys(project.spend_estimates || {}).length > 0 && (
              <div className="glass-card p-6 lg:col-span-2">
                <h2 className="section-title mb-4">Spend Estimates</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(project.spend_estimates).map(([cat, amt]) => (
                    <div key={cat} className="glass-card-light p-3">
                      <p className="text-xs text-synergy-muted">{cat}</p>
                      <p className="text-sm font-semibold text-synergy-text mt-1">{fmt(amt, project.currency)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 1 && (
          <div className="glass-card p-6">
            <h2 className="section-title mb-4">Budget Line Items</h2>
            {!project.budgets?.length ? (
              <p className="text-synergy-muted text-sm">No budget uploaded yet.</p>
            ) : project.budgets.map(budget => (
              <div key={budget.id} className="mb-6">
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <span className="text-sm font-medium text-synergy-text">{budget.file_name}</span>
                  <span className={`badge ${budget.extraction_status === 'EXTRACTED' ? 'badge-green' : 'badge-orange'}`}>
                    {budget.extraction_status}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-synergy-border">
                        <th className="text-left py-2 px-3 text-synergy-muted font-medium">Description</th>
                        <th className="text-left py-2 px-3 text-synergy-muted font-medium">Category</th>
                        <th className="text-right py-2 px-3 text-synergy-muted font-medium">Amount</th>
                        <th className="text-center py-2 px-3 text-synergy-muted font-medium">Local</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budget.line_items.map(item => (
                        <tr key={item.id} className="border-b border-synergy-border/30 hover:bg-white/5 transition-colors">
                          <td className="py-2 px-3 text-synergy-text">{item.description}</td>
                          <td className="py-2 px-3 text-synergy-muted">{item.category}</td>
                          <td className="py-2 px-3 text-right text-synergy-text font-mono">{fmt(item.amount, item.currency)}</td>
                          <td className="py-2 px-3 text-center">
                            {item.is_local_eligible
                              ? <CheckCircleIcon className="h-4 w-4 text-synergy-green mx-auto" />
                              : <span className="text-synergy-muted">—</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 2 && (
          <div className="space-y-3">
            {latestAnalysis?.results?.length ? (
              <>
                <div className="glass-card p-4 flex items-center gap-3 flex-wrap">
                  <span className="badge-green">COMPLETE</span>
                  <span className="text-sm text-synergy-muted">{latestAnalysis.results.length} territories ranked</span>
                  <Link href={`/analysis?id=${latestAnalysis.id}`} className="ml-auto text-synergy-cyan text-sm hover:underline">
                    Full Analysis →
                  </Link>
                </div>
                {latestAnalysis.results.slice(0, 5).map((r: AnalysisResult) => (
                  <motion.div key={r.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    className="glass-card p-4 flex items-center gap-4"
                  >
                    <RankBadge rank={r.rank} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-synergy-text">{r.territory_name}</p>
                      <p className="text-xs text-synergy-muted">{r.territory_region}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-synergy-green">{fmt(r.net_benefit, r.currency)}</p>
                      <p className="text-xs text-synergy-muted">net benefit</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-synergy-cyan">{parseFloat(r.estimated_rebate_pct).toFixed(1)}%</p>
                      <p className="text-xs text-synergy-muted">rate</p>
                    </div>
                  </motion.div>
                ))}
              </>
            ) : (
              <div className="glass-card p-12 text-center">
                <ChartBarIcon className="h-10 w-10 text-synergy-muted mx-auto mb-4" />
                <p className="text-synergy-muted mb-4">No analysis run yet.</p>
                <button onClick={handleAnalyze} disabled={analyzing} className="btn-primary inline-flex items-center gap-2">
                  <ChartBarIcon className="h-4 w-4" /> Run Analysis
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 3 && (
          <div className="space-y-6">
            {finLoading && (
              <div className="grid sm:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => <div key={i} className="h-24 skeleton rounded-2xl" />)}
              </div>
            )}

            {finError && !finLoading && (
              <div className="glass-card p-8 text-center">
                <p className="text-synergy-muted text-sm">{finError}</p>
                <p className="text-synergy-subtle text-xs mt-2">Add a budget or spend estimates, then reopen this tab.</p>
              </div>
            )}

            {finModel && !finLoading && (() => {
              const cur = finModel.currency;
              const cs = finModel.capital_stack;
              const inc = finModel.incentive;
              const scenarios = (['floor', 'base', 'breakout'] as const).map(k => finModel.revenue_scenarios[k]).filter(Boolean);
              const complianceRows = Object.entries(inc.compliance).filter(
                ([, v]) => typeof v === 'object'
              ) as [string, { threshold: number; value: number; status: string }][];
              return (
                <>
                  {/* Hero: Gross → Tax Shield → Net Exposure */}
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="glass-card p-5">
                      <p className="text-xs text-synergy-muted uppercase tracking-wide">Gross Budget</p>
                      <p className="text-2xl font-bold text-synergy-text mt-1">{fmt(cs.gross_budget, cur)}</p>
                    </div>
                    <div className="glass-card p-5 border-synergy-green/30">
                      <p className="text-xs text-synergy-muted uppercase tracking-wide">Tax Shield (rebate)</p>
                      <p className="text-2xl font-bold text-synergy-green mt-1">{fmt(cs.tax_shield, cur)}</p>
                    </div>
                    <div className="glass-card p-5 border-synergy-cyan/30">
                      <p className="text-xs text-synergy-muted uppercase tracking-wide">Net Cash Exposure</p>
                      <p className="text-2xl font-bold text-synergy-cyan mt-1">{fmt(cs.net_cash_exposure, cur)}</p>
                    </div>
                  </div>

                  {/* Capital-stack waterline */}
                  <div className="glass-card p-6">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <h2 className="section-title">Capital Stack</h2>
                      <span className="text-xs text-synergy-muted">
                        {finModel.program?.territory} · {finModel.program?.mode} rebate
                      </span>
                    </div>
                    <div className="flex h-7 rounded-lg overflow-hidden">
                      <div className="bg-synergy-green h-full flex items-center justify-center" style={{ width: `${cs.buffer_pct}%` }}>
                        <span className="text-[10px] font-bold text-synergy-darker">{cs.buffer_pct.toFixed(0)}%</span>
                      </div>
                      <div className="bg-synergy-cyan h-full flex items-center justify-center" style={{ width: `${cs.investor_pct}%` }}>
                        <span className="text-[10px] font-bold text-synergy-darker">{cs.investor_pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <p className="text-xs text-synergy-muted mt-3">
                      The {fmt(cs.tax_shield, cur)} incentive is a first-loss buffer protecting ~{cs.buffer_pct.toFixed(0)}% of the
                      gross budget. The true investor hurdle is <span className="text-synergy-text font-medium">{fmt(cs.net_cash_exposure, cur)}</span> — below the gross budget.
                    </p>
                    <div className="flex flex-wrap gap-3 mt-4">
                      <motion.button
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={handleFinancialPdf} disabled={finPdf}
                        className="btn-primary flex items-center gap-2"
                      >
                        {finPdf
                          ? <span className="h-4 w-4 border-2 border-synergy-darker/30 border-t-synergy-darker rounded-full animate-spin" />
                          : <DocumentArrowDownIcon className="h-4 w-4" />}
                        Financial Model PDF
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={handleBusinessPlan} disabled={bizPdf}
                        className="btn-secondary flex items-center gap-2"
                      >
                        {bizPdf
                          ? <span className="h-4 w-4 border-2 border-synergy-muted/30 border-t-synergy-muted rounded-full animate-spin" />
                          : <DocumentArrowDownIcon className="h-4 w-4" />}
                        Full Business Plan PDF
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={handlePitchDeck} disabled={deckPdf}
                        className="btn-secondary flex items-center gap-2"
                      >
                        {deckPdf
                          ? <span className="h-4 w-4 border-2 border-synergy-muted/30 border-t-synergy-muted rounded-full animate-spin" />
                          : <DocumentArrowDownIcon className="h-4 w-4" />}
                        Pitch Deck PDF
                      </motion.button>
                    </div>
                  </div>

                  {/* Incentive calculation */}
                  <div className="glass-card p-6">
                    <h2 className="section-title mb-4">Incentive Calculation</h2>
                    <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                      {[
                        ['Gross Production Budget', fmt(inc.gross_budget, cur)],
                        ['Eligible Spend (after haircuts)', fmt(inc.eligible_spend, cur)],
                        ['Estimated Rebate', fmt(inc.rebate, cur)],
                        ['Blended Rebate Rate', `${inc.blended_rate.toFixed(1)}%`],
                        ['Eligible / Gross', `${inc.eligible_of_gross.toFixed(1)}%`],
                        ['Net Cash Exposure', fmt(inc.net_cash_exposure, cur)],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between border-b border-synergy-border/30 py-1.5">
                          <span className="text-synergy-muted">{k}</span>
                          <span className="text-synergy-text font-medium font-mono">{v}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {complianceRows.map(([k, v]) => (
                        <span key={k} className={
                          v.status === 'PASS' ? 'badge-green' : v.status === 'CAPPED' ? 'badge-orange' : 'badge-red'
                        }>
                          {k.replace(/_/g, ' ')}: {v.status}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Revenue scenarios */}
                  <div className="glass-card p-6">
                    <h2 className="section-title mb-4">Revenue Scenarios</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-synergy-border text-synergy-muted">
                            <th className="text-left py-2 px-3 font-medium">Scenario</th>
                            <th className="text-right py-2 px-3 font-medium">Worldwide Gross</th>
                            <th className="text-right py-2 px-3 font-medium">Net Revenue</th>
                            <th className="text-right py-2 px-3 font-medium">Coverage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scenarios.map(s => (
                            <tr key={s.scenario} className={`border-b border-synergy-border/30 ${s.covers_exposure ? 'bg-synergy-green/5' : ''}`}>
                              <td className="py-2 px-3 capitalize text-synergy-text">{s.scenario}</td>
                              <td className="py-2 px-3 text-right font-mono text-synergy-text">{fmt(s.worldwide_gross, cur)}</td>
                              <td className="py-2 px-3 text-right font-mono text-synergy-text">{fmt(s.net_project_revenue, cur)}</td>
                              <td className={`py-2 px-3 text-right font-mono font-semibold ${s.covers_exposure ? 'text-synergy-green' : 'text-synergy-muted'}`}>
                                {s.coverage_multiple.toFixed(1)}x
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-synergy-muted mt-3">
                      Coverage = Net Project Revenue ÷ Net Cash Exposure (≥ 1.0x returns investor cash). Gross is before the 30% distribution haircut; replace with sales-agent quotes when available.
                    </p>
                  </div>

                  {/* Editable revenue inputs */}
                  <div className="glass-card p-6">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <h2 className="section-title">Revenue Inputs</h2>
                      <span className={`text-xs ${finModel.revenue_source === 'custom' ? 'text-synergy-green' : 'text-synergy-muted'}`}>
                        {finModel.revenue_source === 'custom' ? '● Your sales-agent quotes' : '○ Modelled benchmark defaults'}
                      </span>
                    </div>
                    {!editRev ? (
                      <>
                        <p className="text-xs text-synergy-muted mb-4">
                          Per-window Floor / Base / Breakout revenue. Replace the modelled defaults with real sales-agent quotes to sharpen every scenario, PDF and coverage multiple.
                        </p>
                        <button onClick={startEditRevenue} className="btn-secondary text-sm">Edit revenue inputs</button>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-synergy-border text-synergy-muted">
                                <th className="text-left py-2 px-2 font-medium">Window / Region</th>
                                <th className="text-right py-2 px-2 font-medium">Floor</th>
                                <th className="text-right py-2 px-2 font-medium">Base</th>
                                <th className="text-right py-2 px-2 font-medium">Breakout</th>
                              </tr>
                            </thead>
                            <tbody>
                              {revRows.map((r, i) => (
                                <tr key={i} className="border-b border-synergy-border/30">
                                  <td className="py-1.5 px-2 text-synergy-text">{r.name}</td>
                                  {(['floor', 'base', 'breakout'] as const).map(k => (
                                    <td key={k} className="py-1.5 px-2">
                                      <input
                                        type="number"
                                        value={r[k]}
                                        onChange={e => setRevRows(prev => prev.map((row, j) => j === i ? { ...row, [k]: e.target.value } : row))}
                                        className="form-input w-28 text-right py-1 text-xs"
                                      />
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <motion.button whileTap={{ scale: 0.98 }} onClick={saveRevenue} disabled={savingRev}
                            className="btn-primary flex items-center gap-2 text-sm">
                            {savingRev && <span className="h-4 w-4 border-2 border-synergy-darker/30 border-t-synergy-darker rounded-full animate-spin" />}
                            Save &amp; recompute
                          </motion.button>
                          <button onClick={() => setEditRev(false)} className="btn-secondary text-sm" disabled={savingRev}>Cancel</button>
                          <button onClick={resetRevenue} className="btn-secondary text-sm ml-auto" disabled={savingRev}>Reset to defaults</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sensitivity */}
                  <div className="glass-card p-6">
                    <h2 className="section-title mb-4">Budget Sensitivity</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-synergy-border text-synergy-muted">
                            <th className="text-left py-2 px-3 font-medium">Scenario</th>
                            <th className="text-right py-2 px-3 font-medium">Gross</th>
                            <th className="text-right py-2 px-3 font-medium">Rebate</th>
                            <th className="text-right py-2 px-3 font-medium">Net Exposure</th>
                          </tr>
                        </thead>
                        <tbody>
                          {finModel.sensitivity.map(r => (
                            <tr key={r.scenario} className="border-b border-synergy-border/30">
                              <td className="py-2 px-3 text-synergy-text">{r.scenario}</td>
                              <td className="py-2 px-3 text-right font-mono text-synergy-muted">{fmt(r.gross_budget, cur)}</td>
                              <td className="py-2 px-3 text-right font-mono text-synergy-muted">{fmt(r.rebate, cur)}</td>
                              <td className="py-2 px-3 text-right font-mono text-synergy-text">{fmt(r.net_cash_exposure, cur)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {activeTab === 4 && (
          <div className="glass-card p-6">
            <h2 className="section-title mb-4">Generate Reports</h2>
            {latestAnalysis ? (
              <div className="flex gap-3 flex-wrap">
                {(['PDF', 'XLSX'] as const).map(fmt => (
                  <motion.button key={fmt}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => handleReport(fmt, latestAnalysis.id)}
                    disabled={!!generatingReport}
                    className="btn-secondary flex items-center gap-2"
                  >
                    {generatingReport === fmt
                      ? <span className="h-4 w-4 border-2 border-synergy-muted/30 border-t-synergy-muted rounded-full animate-spin" />
                      : <DocumentArrowDownIcon className="h-4 w-4" />
                    }
                    Export {fmt}
                  </motion.button>
                ))}
              </div>
            ) : (
              <p className="text-synergy-muted text-sm">Run an analysis first to generate reports.</p>
            )}
          </div>
        )}
      </motion.div>
    </Layout>
  );
}
