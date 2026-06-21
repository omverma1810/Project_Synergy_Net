'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  FolderIcon,
  ChartBarIcon,
  GlobeAltIcon,
  ArrowTrendingUpIcon,
  PlusIcon,
  ArrowRightIcon,
  BellAlertIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api, ProjectSummary, PolicyAlert, Analysis } from '@/lib/api';
import Layout from '@/components/Layout';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { SpotlightCard, stagger } from '@/components/ui/Motion';
import { StatSkeleton } from '@/components/ui/Skeleton';

const COLORS = ['#22d3ee', '#3b82f6', '#a78bfa', '#34d399', '#fbbf24', '#f87171'];

function fmt(n: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [alerts, setAlerts] = useState<PolicyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState('');

  useEffect(() => {
    Promise.all([
      api.projects.list().catch(() => [] as ProjectSummary[]),
      api.analysis.list().catch(() => [] as Analysis[]),
      api.territories.alerts().catch(() => [] as PolicyAlert[]),
    ]).then(([p, a, al]) => {
      setProjects(Array.isArray(p) ? p : []);
      setAnalyses(Array.isArray(a) ? a : []);
      setAlerts(Array.isArray(al) ? al : []);
      setLoading(false);
    });
    api.auth.me().then((u) => setFirstName(u.first_name || '')).catch(() => {});
  }, []);

  const completedAnalyses = analyses.filter((a) => a.status === 'COMPLETE');
  const activeAnalyses = analyses.filter((a) => a.status === 'RUNNING' || a.status === 'PENDING').length;

  const territoryMap: Record<string, { name: string; total: number; count: number }> = {};
  completedAnalyses.forEach((a) => {
    (a.results || []).slice(0, 5).forEach((r) => {
      const key = r.territory_name;
      if (!territoryMap[key]) territoryMap[key] = { name: r.territory_name, total: 0, count: 0 };
      territoryMap[key].total += parseFloat(r.net_benefit);
      territoryMap[key].count += 1;
    });
  });
  const chartData = Object.values(territoryMap)
    .map((t) => ({ name: t.name.split('—')[0].trim().split(' ')[0], avg: Math.round(t.total / t.count) }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 6);

  const topTerritory = chartData[0]?.name || '—';
  const totalRebateProjected = completedAnalyses
    .flatMap((a) => a.results || [])
    .filter((r) => r.rank === 1)
    .reduce((sum, r) => sum + parseFloat(r.estimated_rebate), 0);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const stats = [
    { label: 'Total Projects', value: projects.length, display: <AnimatedNumber value={projects.length} />, sub: `${projects.filter((p) => p.status !== 'ARCHIVED').length} active`, icon: FolderIcon, tone: 'text-synergy-cyan', bg: 'bg-synergy-cyan/10' },
    { label: 'Active Analyses', value: activeAnalyses, display: <AnimatedNumber value={activeAnalyses} />, sub: `${completedAnalyses.length} completed`, icon: ChartBarIcon, tone: 'text-synergy-violet', bg: 'bg-synergy-violet/10' },
    { label: 'Top Territory', value: 0, display: <span className="truncate">{topTerritory}</span>, sub: 'by avg net benefit', icon: GlobeAltIcon, tone: 'text-synergy-green', bg: 'bg-synergy-green/10' },
    { label: 'Rebate Projected', value: totalRebateProjected, display: <AnimatedNumber value={totalRebateProjected} format={(n) => fmt(n)} />, sub: 'across all projects', icon: ArrowTrendingUpIcon, tone: 'text-synergy-gold', bg: 'bg-synergy-gold/10' },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="h-8 w-56 skeleton mb-2" />
        <div className="h-4 w-72 skeleton mb-8" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <StatSkeleton key={i} />)}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Hero */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="eyebrow mb-1.5">Production Finance Intelligence</p>
          <h1 className="text-3xl font-bold tracking-tight text-synergy-text">
            {greeting}{firstName ? <>, <span className="gradient-text">{firstName}</span></> : ''}
          </h1>
          <p className="text-synergy-muted text-sm mt-1.5">Here&apos;s your global incentive overview.</p>
        </div>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Link href="/projects/new" className="btn-primary">
            <PlusIcon className="h-4 w-4" />
            New Project
          </Link>
        </motion.div>
      </div>

      {/* Alert banner */}
      {alerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card-cyan p-4 mb-6 flex items-start gap-3 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-aurora opacity-40 pointer-events-none" />
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-synergy-cyan/15">
            <BellAlertIcon className="h-4 w-4 text-synergy-cyan" />
          </div>
          <div className="relative flex-1 min-w-0">
            <p className="text-sm font-medium text-synergy-text">{alerts[0].title}</p>
            <p className="text-xs text-synergy-muted truncate">{alerts[0].description}</p>
          </div>
          {alerts.length > 1 && <span className="relative badge-cyan shrink-0">+{alerts.length - 1} more</span>}
        </motion.div>
      )}

      {/* Stat cards */}
      <motion.div variants={stagger.container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <motion.div key={stat.label} variants={stagger.item}>
            <SpotlightCard className="stat-card h-full">
              <div className="flex items-start justify-between mb-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.tone}`} />
                </div>
                <span className="text-[11px] text-synergy-muted text-right max-w-[60%]">{stat.sub}</span>
              </div>
              <div className="text-2xl font-bold text-synergy-text truncate">{stat.display}</div>
              <div className="text-xs text-synergy-muted mt-1">{stat.label}</div>
            </SpotlightCard>
          </motion.div>
        ))}
      </motion.div>

      {/* Chart + recent */}
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Territory Performance</h2>
            <span className="badge-muted">Avg net benefit</span>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barSize={34}>
                <defs>
                  {COLORS.map((c, i) => (
                    <linearGradient key={i} id={`bar-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={c} stopOpacity={0.35} />
                    </linearGradient>
                  ))}
                </defs>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)} />
                <Tooltip
                  cursor={{ fill: 'rgba(34,211,238,0.06)' }}
                  contentStyle={{ backgroundColor: 'rgba(20,30,51,0.95)', border: '1px solid #27324a', borderRadius: 10, fontSize: 12, backdropFilter: 'blur(8px)' }}
                  labelStyle={{ color: '#f1f5f9' }}
                  formatter={(v) => [fmt(Number(v)), 'Avg Net Benefit']}
                />
                <Bar dataKey="avg" radius={[6, 6, 0, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={`url(#bar-${i % COLORS.length})`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Recent Projects</h2>
            <Link href="/projects" className="text-synergy-cyan text-xs hover:underline flex items-center gap-1">
              View all <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {projects.slice(0, 5).map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors group">
                <div className="h-9 w-9 rounded-lg bg-synergy-cyan/10 flex items-center justify-center shrink-0 group-hover:bg-synergy-cyan/20 transition-colors">
                  <FolderIcon className="h-4 w-4 text-synergy-cyan" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-synergy-text truncate group-hover:text-synergy-cyan transition-colors">{p.title}</p>
                  <p className="text-xs text-synergy-muted capitalize">{p.type?.toLowerCase()} · {p.status?.toLowerCase()}</p>
                </div>
                <ArrowRightIcon className="h-4 w-4 text-synergy-subtle opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </Link>
            ))}
            {projects.length === 0 && (
              <div className="text-center py-8">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-synergy-cyan/10 mb-3">
                  <SparklesIcon className="h-6 w-6 text-synergy-cyan" />
                </div>
                <p className="text-synergy-muted text-sm mb-3">No projects yet</p>
                <Link href="/projects/new" className="btn-primary text-xs">Create first project</Link>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Policy alerts detail */}
      {alerts.length > 1 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card p-6">
          <h2 className="section-title mb-4">Policy Alerts</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {alerts.slice(0, 4).map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-synergy-border/40 hover:border-synergy-cyan/30 transition-colors">
                <span className={alert.change_type === 'RATE_CHANGE' ? 'badge-cyan' : 'badge-orange'}>
                  {alert.change_type === 'RATE_CHANGE' ? 'Rate' : 'Rule'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-synergy-text">{alert.title}</p>
                  {alert.territory_name && <p className="text-xs text-synergy-muted">{alert.territory_name}</p>}
                </div>
                {alert.previous_value && alert.new_value && (
                  <div className="text-xs text-synergy-muted whitespace-nowrap">
                    <span className="line-through">{alert.previous_value}</span>
                    {' → '}
                    <span className="text-synergy-cyan font-medium">{alert.new_value}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </Layout>
  );
}

function EmptyChart() {
  return (
    <div className="flex flex-col items-center justify-center h-52 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-synergy-cyan/10 mb-3 animate-float">
        <ChartBarIcon className="h-6 w-6 text-synergy-cyan" />
      </div>
      <p className="text-synergy-muted text-sm">Run your first analysis to see territory performance</p>
      <Link href="/projects/new" className="btn-secondary text-xs mt-3">Get started</Link>
    </div>
  );
}
