'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ChevronDownIcon, DocumentArrowDownIcon, ClockIcon, BanknotesIcon, TrophyIcon, MapPinIcon, ShieldExclamationIcon, ScaleIcon } from '@heroicons/react/24/outline';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie,
} from 'recharts';
import { api, Analysis, AnalysisResult, RiskFlag } from '@/lib/api';
import { SynergyMark } from '@/components/Brand';

const COLORS = ['#22d3ee', '#3b82f6', '#a78bfa', '#34d399', '#fbbf24', '#f87171'];
const RISK_STYLES: Record<string, string> = {
  low: 'bg-synergy-green/10 text-synergy-green border border-synergy-green/30',
  medium: 'bg-synergy-gold/10 text-synergy-gold border border-synergy-gold/30',
  high: 'bg-synergy-red/10 text-synergy-red border border-synergy-red/30',
};

function RiskPill({ level }: { level: string }) {
  return (
    <span className={`badge ${RISK_STYLES[level] || RISK_STYLES.medium} text-[10px] capitalize`}>
      {level} risk
    </span>
  );
}

function fmtPct(n: string | number) {
  return `${parseFloat(String(n)).toFixed(1)}%`;
}

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
      if (report.file_url) {
        window.open(report.file_url, '_blank');
        toast.success(`${format} report ready`);
      } else {
        toast.success(`${format} report queued`);
      }
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Report generation failed');
    } finally {
      setGeneratingReport(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 skeleton mb-2" />
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="h-56 skeleton rounded-2xl" />
          <div className="h-56 skeleton rounded-2xl" />
        </div>
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 skeleton rounded-2xl" />)}
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="glass-card p-12 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-synergy-cyan/10 mb-4">
          <MapPinIcon className="h-6 w-6 text-synergy-cyan" />
        </div>
        <p className="text-synergy-muted">No analysis selected. Run an analysis from a project page.</p>
      </div>
    );
  }

  if (analysis.status === 'RUNNING' || analysis.status === 'PENDING') {
    return (
      <div className="glass-card grain p-16 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-aurora opacity-50 pointer-events-none" />
        <div className="relative">
          <div className="inline-flex animate-float mb-6">
            <SynergyMark size={56} animate={false} />
          </div>
          <p className="text-synergy-text font-semibold text-lg">Engineering your finance map…</p>
          <p className="text-synergy-muted text-sm mt-2">Mapping qualified spend, applying treaties &amp; stacking, ranking by net yield.</p>
          <div className="mt-6 flex items-center justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-2 w-2 rounded-full bg-synergy-cyan"
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </div>
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
  const snapshot = analysis.finance_snapshot;
  const compare = results.slice(0, 4);

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

  const winner = results.find((r) => r.rank === 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="eyebrow mb-1.5">Optimised Output</p>
          <h1 className="page-title">{analysis.project_title}</h1>
          <p className="text-synergy-muted text-sm mt-1.5">
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

      {/* Winner spotlight */}
      {winner && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-2xl border border-synergy-gold/30 bg-synergy-card/70 backdrop-blur-xl p-6 grain"
        >
          <div className="absolute -top-16 -right-10 h-48 w-48 rounded-full bg-synergy-gold/15 blur-3xl pointer-events-none" />
          <div className="relative flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-gold shadow-glow-gold">
                <TrophyIcon className="h-5 w-5 sm:h-6 sm:w-6 text-synergy-darker" />
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-synergy-gold/80 font-semibold">Recommended Territory</p>
                <p className="text-lg sm:text-xl font-bold text-synergy-text truncate">{winner.territory_name}</p>
                <p className="text-xs text-synergy-muted">{winner.territory_region} · {winner.territory_incentive_type.replace('_', ' ').toLowerCase()}</p>
              </div>
            </div>
            <div className="flex-1 hidden sm:block" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6 w-full sm:w-auto">
              <div>
                <p className="text-xl sm:text-2xl font-bold gradient-text-gold">{fmtPct(winner.estimated_rebate_pct)}</p>
                <p className="text-xs text-synergy-muted">effective rate</p>
              </div>
              <div className="hidden sm:block">
                <p className="text-xl sm:text-2xl font-bold text-synergy-text">{fmt(winner.estimated_rebate, winner.currency)}</p>
                <p className="text-xs text-synergy-muted">gross rebate</p>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-synergy-green">{fmt(winner.net_benefit, winner.currency)}</p>
                <p className="text-xs text-synergy-muted">net benefit</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Finance snapshot */}
      {snapshot && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-card p-5 sm:p-6"
        >
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <BanknotesIcon className="h-5 w-5 text-synergy-cyan" />
              <h2 className="section-title">Finance Snapshot</h2>
            </div>
            <span className="badge-muted">vs. {fmt(snapshot.total_budget, snapshot.currency)} budget · {snapshot.top_territory}</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 items-center">
            {/* Donut: budget composition */}
            <div className="flex items-center gap-4">
              <div className="relative h-[160px] w-[160px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Incentive-covered', value: snapshot.estimated_incentive },
                        { name: 'Finance gap', value: snapshot.finance_gap },
                      ]}
                      dataKey="value"
                      innerRadius={52}
                      outerRadius={76}
                      paddingAngle={2}
                      stroke="none"
                      startAngle={90}
                      endAngle={-270}
                    >
                      <Cell fill="#22d3ee" />
                      <Cell fill="#f59e0b" />
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(20,30,51,0.95)', border: '1px solid #27324a', borderRadius: 10, fontSize: 12 }}
                      formatter={(v) => fmt(Number(v), snapshot.currency)}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold gradient-text">{snapshot.incentive_pct_of_budget}%</span>
                  <span className="text-[10px] text-synergy-muted">covered</span>
                </div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm bg-synergy-cyan" />
                  <span className="text-synergy-muted">Incentive</span>
                  <span className="text-synergy-text font-medium ml-auto">{fmt(snapshot.estimated_incentive, snapshot.currency)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm bg-synergy-gold" />
                  <span className="text-synergy-muted">Finance gap</span>
                  <span className="text-synergy-text font-medium ml-auto">{fmt(snapshot.finance_gap, snapshot.currency)}</span>
                </div>
              </div>
            </div>

            {/* Metric tiles */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Budget', value: fmt(snapshot.total_budget, snapshot.currency), tone: 'text-synergy-text' },
                { label: 'Est. Incentive', value: fmt(snapshot.estimated_incentive, snapshot.currency), tone: 'text-synergy-cyan' },
                { label: 'Finance Gap', value: fmt(snapshot.finance_gap, snapshot.currency), tone: 'text-synergy-gold' },
                { label: `Rebate PV (${snapshot.rebate_timing_months}mo)`, value: fmt(snapshot.financing_pv, snapshot.currency), tone: 'text-synergy-green' },
              ].map((m) => (
                <div key={m.label} className="glass-card-light p-3">
                  <p className="text-[10px] text-synergy-muted uppercase tracking-wide">{m.label}</p>
                  <p className={`text-base font-bold mt-1 ${m.tone} truncate`}>{m.value}</p>
                </div>
              ))}
            </div>
          </div>
          {snapshot.loan_against_rebate_available && (
            <p className="mt-4 text-xs text-synergy-muted flex items-center gap-1.5">
              <span className="badge-green text-[10px]">Financing</span>
              A loan against the rebate is available in {snapshot.top_territory} to bridge the {snapshot.rebate_timing_months}-month payout.
            </p>
          )}
        </motion.div>
      )}

      {/* Side-by-side comparison matrix */}
      {top5.length > 1 && (
        <div className="glass-card p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <ScaleIcon className="h-5 w-5 text-synergy-cyan" />
            <h2 className="section-title">Territory Comparison</h2>
          </div>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="text-left py-2 pr-3 text-synergy-muted font-medium text-xs sticky left-0 bg-synergy-card/0">Metric</th>
                  {compare.map((r, i) => (
                    <th key={r.id} className="py-2 px-3 text-center min-w-[110px]">
                      <div className="flex flex-col items-center gap-1">
                        <span className={i === 0 ? 'rank-badge-1' : i === 1 ? 'rank-badge-2' : i === 2 ? 'rank-badge-3' : 'rank-badge-other'}>#{r.rank}</span>
                        <span className="text-xs font-semibold text-synergy-text leading-tight">{r.territory_name.split('—')[0].trim()}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {([
                  ['Effective rate', (r: AnalysisResult) => `${parseFloat(r.estimated_rebate_pct).toFixed(1)}%`, 'text-synergy-cyan'],
                  ['Gross rebate', (r: AnalysisResult) => fmt(r.estimated_rebate, r.currency), 'text-synergy-text'],
                  ['Logistics premium', (r: AnalysisResult) => `−${fmt(r.logistics_premium, r.currency)}`, 'text-synergy-muted'],
                  ['Net benefit', (r: AnalysisResult) => fmt(r.net_benefit, r.currency), 'text-synergy-green'],
                  ['Payout', (r: AnalysisResult) => `${r.rebate_timing_months} mo`, 'text-synergy-text'],
                  ['Rebate PV', (r: AnalysisResult) => fmt(r.financing_benefit_estimate, r.currency), 'text-synergy-text'],
                  ['Confidence', (r: AnalysisResult) => `${Math.round(parseFloat(r.confidence_score) * 100)}%`, 'text-synergy-text'],
                ] as [string, (r: AnalysisResult) => string, string][]).map(([label, accessor, tone]) => (
                  <tr key={label}>
                    <td className="py-2 pr-3 text-synergy-muted text-xs whitespace-nowrap border-t border-synergy-border/30">{label}</td>
                    {compare.map((r) => (
                      <td key={r.id} className={`py-2 px-3 text-center font-medium ${tone} border-t border-synergy-border/30`}>{accessor(r)}</td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td className="py-2 pr-3 text-synergy-muted text-xs border-t border-synergy-border/30">Overall risk</td>
                  {compare.map((r) => (
                    <td key={r.id} className="py-2 px-3 text-center border-t border-synergy-border/30">
                      <RiskPill level={r.risk_level} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Charts */}
      {top5.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="glass-card p-6">
            <h2 className="section-title mb-4">Net Benefit Comparison</h2>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={barData} barSize={30}>
                <defs>
                  {COLORS.map((c, i) => (
                    <linearGradient key={i} id={`abar-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={c} stopOpacity={0.35} />
                    </linearGradient>
                  ))}
                </defs>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  cursor={{ fill: 'rgba(34,211,238,0.06)' }}
                  contentStyle={{ backgroundColor: 'rgba(20,30,51,0.95)', border: '1px solid #27324a', borderRadius: 10, fontSize: 12, backdropFilter: 'blur(8px)' }}
                  formatter={(v) => [fmt(Number(v)), 'Net Benefit']}
                />
                <Bar dataKey="net" name="Net Benefit" radius={[6, 6, 0, 0]}>
                  {barData.map((_, i) => <Cell key={i} fill={`url(#abar-${i % COLORS.length})`} />)}
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
            className={`glass-card overflow-hidden transition-all duration-300 ${
              r.rank === 1
                ? 'border-synergy-gold/30 hover:shadow-glow-gold'
                : 'hover:border-synergy-cyan/30 hover:shadow-glow-cyan'
            }`}
          >
            <div className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4 cursor-pointer" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
              <RankBadge rank={r.rank} />

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-synergy-text">{r.territory_name}</p>
                <p className="text-xs text-synergy-muted">{r.territory_region} · {r.territory_incentive_type.replace('_', ' ')}</p>
              </div>

              {/* Mobile: compact rate + net */}
              <div className="sm:hidden flex flex-col items-end shrink-0 gap-0.5">
                <p className="text-sm font-semibold text-synergy-cyan">{parseFloat(r.estimated_rebate_pct).toFixed(1)}%</p>
                <p className="text-xs font-semibold text-synergy-green">{fmt(r.net_benefit, r.currency)}</p>
              </div>

              {/* Desktop: full 3-col */}
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

              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-xs text-synergy-muted hidden sm:inline">{Math.round(parseFloat(r.confidence_score) * 100)}%</span>
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

                    {/* Risk & considerations */}
                    {r.risk_flags?.length > 0 && (
                      <div className="sm:col-span-2 lg:col-span-3">
                        <p className="text-xs font-semibold text-synergy-text mb-2 flex items-center gap-1.5">
                          <ShieldExclamationIcon className="h-4 w-4 text-synergy-muted" />
                          Risk &amp; Considerations
                        </p>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {r.risk_flags.map((flag: RiskFlag) => (
                            <div key={flag.key} className="rounded-lg bg-white/[0.03] border border-synergy-border/40 p-2.5">
                              <div className="flex items-center gap-2 mb-1">
                                <RiskPill level={flag.level} />
                                <span className="text-[11px] font-medium text-synergy-text">{flag.category}</span>
                              </div>
                              <p className="text-[11px] text-synergy-text/90">{flag.label}</p>
                              <p className="text-[10px] text-synergy-muted mt-0.5 leading-snug">{flag.detail}</p>
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
