'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon, DocumentArrowDownIcon, ClockIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from 'recharts';
import { api, Analysis, AnalysisResult } from '@/lib/api';

const COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

function fmt(n: string | number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(n));
}

function RankBadge({ rank }: { rank: number }) {
  const cls = rank === 1 ? 'rank-badge-1' : rank === 2 ? 'rank-badge-2' : rank === 3 ? 'rank-badge-3' : 'rank-badge-other';
  return <span className={cls}>#{rank}</span>;
}

export default function AnalysisResults() {
  const params = useSearchParams();
  const analysisId = params.get('id');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [generatingReport, setGeneratingReport] = useState<'PDF' | 'XLSX' | null>(null);

  useEffect(() => {
    if (!analysisId) { setLoading(false); return; }
    const load = async () => {
      try {
        const a = await api.analysis.get(parseInt(analysisId));
        setAnalysis(a);
      } finally {
        setLoading(false);
      }
    };
    load();
    // Poll if still running
    const interval = setInterval(async () => {
      const a = await api.analysis.get(parseInt(analysisId)).catch(() => null);
      if (a) {
        setAnalysis(a);
        if (a.status === 'COMPLETE' || a.status === 'FAILED') clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [analysisId]);

  const handleReport = async (format: 'PDF' | 'XLSX') => {
    if (!analysis) return;
    setGeneratingReport(format);
    try {
      const report = await api.reports.generate(analysis.id, format);
      if (report.file_url) window.open(report.file_url, '_blank');
    } catch (e: unknown) {
      alert((e as Error).message || 'Report generation failed');
    } finally {
      setGeneratingReport(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-64 bg-synergy-card rounded-lg" />
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-synergy-card rounded-2xl" />)}
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="glass-card p-12 text-center">
        <p className="text-synergy-muted">No analysis selected. Run an analysis from a project page.</p>
      </div>
    );
  }

  if (analysis.status === 'RUNNING' || analysis.status === 'PENDING') {
    return (
      <div className="glass-card p-12 text-center">
        <div className="h-10 w-10 border-2 border-synergy-cyan/30 border-t-synergy-cyan rounded-full animate-spin mx-auto mb-4" />
        <p className="text-synergy-text font-medium">Analysis running…</p>
        <p className="text-synergy-muted text-sm mt-1">Ranking territories by net economic yield</p>
      </div>
    );
  }

  if (analysis.status === 'FAILED') {
    return (
      <div className="glass-card p-12 text-center">
        <p className="text-synergy-red font-medium">Analysis failed.</p>
        <p className="text-synergy-muted text-sm mt-1">Please try running the analysis again.</p>
      </div>
    );
  }

  const results = analysis.results || [];
  const top5 = results.slice(0, 5);

  // Chart data
  const barData = top5.map(r => ({
    name: r.territory_name.split('—')[0].trim().split(' ')[0],
    net: parseFloat(r.net_benefit),
    rebate: parseFloat(r.estimated_rebate),
  }));

  const radarData = ['rebate %', 'confidence', 'timing'].map(key => ({
    subject: key,
    ...Object.fromEntries(top5.map(r => [
      r.territory_name.split(' ')[0],
      key === 'rebate %' ? parseFloat(r.estimated_rebate_pct) :
      key === 'confidence' ? parseFloat(r.confidence_score) * 100 :
      Math.max(0, 100 - r.rebate_timing_months * 3),
    ])),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">{analysis.project_title}</h1>
          <p className="text-synergy-muted text-sm mt-1">
            {results.length} territories ranked · {analysis.completed_at ? new Date(analysis.completed_at).toLocaleDateString() : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {(['PDF', 'XLSX'] as const).map(f => (
            <motion.button key={f}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => handleReport(f)}
              disabled={!!generatingReport}
              className="btn-secondary flex items-center gap-2"
            >
              {generatingReport === f
                ? <span className="h-4 w-4 border-2 border-synergy-muted/30 border-t-synergy-muted rounded-full animate-spin" />
                : <DocumentArrowDownIcon className="h-4 w-4" />
              }
              {f}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Charts */}
      {top5.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="glass-card p-6">
            <h2 className="section-title mb-4">Net Benefit Comparison</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} barSize={28}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [fmt(v), '']}
                />
                <Bar dataKey="net" name="Net Benefit" radius={[4, 4, 0, 0]}>
                  {barData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card p-6">
            <h2 className="section-title mb-4">Multi-Dimension Comparison</h2>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                {top5.slice(0, 3).map((r, i) => (
                  <Radar key={r.id}
                    name={r.territory_name.split(' ')[0]}
                    dataKey={r.territory_name.split(' ')[0]}
                    stroke={COLORS[i]}
                    fill={COLORS[i]}
                    fillOpacity={0.1}
                  />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Results list */}
      <div className="space-y-3">
        {results.map((r: AnalysisResult) => (
          <motion.div key={r.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: r.rank * 0.04 }}
            className="glass-card overflow-hidden hover:border-synergy-cyan/20 transition-all"
          >
            <div className="p-5 flex items-center gap-4 cursor-pointer" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
              <RankBadge rank={r.rank} />

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-synergy-text">{r.territory_name}</p>
                <p className="text-xs text-synergy-muted">{r.territory_region} · {r.territory_incentive_type.replace('_', ' ')}</p>
              </div>

              <div className="hidden sm:grid grid-cols-3 gap-6 text-right">
                <div>
                  <p className="font-semibold text-synergy-cyan">{parseFloat(r.estimated_rebate_pct).toFixed(1)}%</p>
                  <p className="text-xs text-synergy-muted">rate</p>
                </div>
                <div>
                  <p className="font-semibold text-synergy-text">{fmt(r.estimated_rebate, r.currency)}</p>
                  <p className="text-xs text-synergy-muted">rebate</p>
                </div>
                <div>
                  <p className="font-semibold text-synergy-green">{fmt(r.net_benefit, r.currency)}</p>
                  <p className="text-xs text-synergy-muted">net benefit</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-synergy-muted">{Math.round(parseFloat(r.confidence_score) * 100)}%</span>
                <motion.div animate={{ rotate: expanded === r.id ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDownIcon className="h-4 w-4 text-synergy-muted" />
                </motion.div>
              </div>
            </div>

            <AnimatePresence>
              {expanded === r.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden border-t border-synergy-border/50"
                >
                  <div className="p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Financials */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-synergy-text mb-2">Financial Breakdown</p>
                      {[
                        ['Qualified Spend', fmt(r.qualified_spend_total, r.currency)],
                        ['Gross Rebate', fmt(r.estimated_rebate, r.currency)],
                        ['Logistics Premium', `−${fmt(r.logistics_premium, r.currency)}`],
                        ['Net Benefit', fmt(r.net_benefit, r.currency)],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between text-xs">
                          <span className="text-synergy-muted">{label}</span>
                          <span className="text-synergy-text font-medium">{value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Financing */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-synergy-text mb-2">Financing & Recoupment</p>
                      <div className="flex items-center gap-2 text-xs">
                        <ClockIcon className="h-4 w-4 text-synergy-muted" />
                        <span className="text-synergy-muted">Payout timeline:</span>
                        <span className="text-synergy-text font-medium">{r.rebate_timing_months} months</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <BanknotesIcon className="h-4 w-4 text-synergy-muted" />
                        <span className="text-synergy-muted">Financing PV:</span>
                        <span className="text-synergy-text font-medium">{fmt(r.financing_benefit_estimate, r.currency)}</span>
                      </div>
                      {r.loan_against_rebate_available && (
                        <span className="badge-green text-[10px]">Loan Against Rebate Available</span>
                      )}
                      <div className="text-xs">
                        <span className="text-synergy-muted">Recoupment: </span>
                        <span className="text-synergy-text capitalize">{r.recoupment_priority}</span>
                      </div>
                    </div>

                    {/* Compliance checklist */}
                    {r.details?.checklist_items?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-synergy-text mb-2">Compliance Checklist</p>
                        <div className="space-y-1.5">
                          {r.details.checklist_items.slice(0, 4).map((item, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              <span className={`badge shrink-0 mt-0.5 ${item.is_mandatory ? 'badge-red' : 'badge-muted'} text-[10px]`}>
                                {item.deadline_type?.replace(/_/g, ' ').toLowerCase()}
                              </span>
                              <span className="text-synergy-muted">{item.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
