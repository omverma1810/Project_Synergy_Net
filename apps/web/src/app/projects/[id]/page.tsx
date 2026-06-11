'use client';
import { useEffect, useState, use } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChartBarIcon,
  DocumentArrowDownIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { api, ProjectDetail, Analysis, AnalysisResult } from '@/lib/api';
import Layout from '@/components/Layout';

const TABS = ['Overview', 'Budget', 'Analysis', 'Reports'];

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

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingReport, setGeneratingReport] = useState<'PDF' | 'XLSX' | null>(null);

  useEffect(() => {
    const pid = parseInt(id);
    Promise.all([
      api.projects.get(pid),
      api.analysis.list(pid).catch(() => [] as Analysis[]),
    ]).then(([p, a]) => {
      setProject(p);
      setAnalyses(Array.isArray(a) ? a : []);
    }).finally(() => setLoading(false));
  }, [id]);

  const handleAnalyze = async () => {
    if (!project) return;
    const budget = project.budgets?.[project.budgets.length - 1];
    if (!budget) { alert('No budget found. Please upload a budget file or add spend estimates.'); return; }
    setAnalyzing(true);
    try {
      const analysis = await api.analysis.create(project.id, budget.id);
      router.push(`/analysis?id=${analysis.id}`);
    } catch (e: unknown) {
      alert((e as Error).message || 'Failed to start analysis');
      setAnalyzing(false);
    }
  };

  const handleReport = async (format: 'PDF' | 'XLSX', analysisId: number) => {
    setGeneratingReport(format);
    try {
      const report = await api.reports.generate(analysisId, format);
      if (report.file_url) window.open(report.file_url, '_blank');
    } catch (e: unknown) {
      alert((e as Error).message || 'Report generation failed');
    } finally {
      setGeneratingReport(null);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-60 bg-synergy-card rounded-lg" />
          <div className="h-48 bg-synergy-card rounded-2xl" />
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
            <span className={STATUS_BADGES[project.status] || 'badge-muted'}>{project.status}</span>
          </div>
          <p className="text-synergy-muted text-sm mt-1">{project.type} · {project.genre} · {project.language}</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={handleAnalyze}
          disabled={analyzing}
          className="btn-primary flex items-center gap-2 shrink-0"
        >
          {analyzing
            ? <span className="h-4 w-4 border-2 border-synergy-dark/30 border-t-synergy-dark rounded-full animate-spin" />
            : <ChartBarIcon className="h-4 w-4" />
          }
          Run Analysis
        </motion.button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-synergy-card/50 rounded-xl p-1 w-fit">
        {TABS.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)}
            className={[
              'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              activeTab === i ? 'bg-synergy-cyan text-synergy-dark' : 'text-synergy-muted hover:text-synergy-text',
            ].join(' ')}
          >
            {tab}
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
