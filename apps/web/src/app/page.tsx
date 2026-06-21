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
} from '@heroicons/react/24/outline';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api, ProjectSummary, PolicyAlert, Analysis } from '@/lib/api';
import Layout from '@/components/Layout';

const COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

function fmt(n: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [alerts, setAlerts] = useState<PolicyAlert[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, []);

  const completedAnalyses = analyses.filter(a => a.status === 'COMPLETE');
  const activeAnalyses = analyses.filter(a => a.status === 'RUNNING' || a.status === 'PENDING').length;

  const territoryMap: Record<string, { name: string; total: number; count: number }> = {};
  completedAnalyses.forEach(a => {
    (a.results || []).slice(0, 5).forEach(r => {
      const key = r.territory_name;
      if (!territoryMap[key]) territoryMap[key] = { name: r.territory_name, total: 0, count: 0 };
      territoryMap[key].total += parseFloat(r.net_benefit);
      territoryMap[key].count += 1;
    });
  });
  const chartData = Object.values(territoryMap)
    .map(t => ({ name: t.name.split('—')[0].trim().split(' ')[0], avg: Math.round(t.total / t.count) }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 6);

  const topTerritory = chartData[0]?.name || '—';
  const totalRebateProjected = completedAnalyses
    .flatMap(a => a.results || [])
    .filter(r => r.rank === 1)
    .reduce((sum, r) => sum + parseFloat(r.estimated_rebate), 0);

  const stats = [
    { label: 'Total Projects', value: projects.length, sub: `${projects.filter(p => p.status !== 'ARCHIVED').length} active`, icon: FolderIcon },
    { label: 'Active Analyses', value: activeAnalyses, sub: `${completedAnalyses.length} completed`, icon: ChartBarIcon },
    { label: 'Top Territory', value: topTerritory, sub: 'by avg net benefit', icon: GlobeAltIcon },
    { label: 'Total Rebate Projected', value: fmt(totalRebateProjected), sub: 'across all projects', icon: ArrowTrendingUpIcon },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6 animate-pulse">
          <div className="h-8 w-48 bg-synergy-card rounded-lg" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-synergy-card rounded-2xl" />)}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-synergy-muted text-sm mt-1">Production Finance Intelligence</p>
        </div>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Link href="/projects/new" className="btn-primary flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            New Project
          </Link>
        </motion.div>
      </div>

      {alerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card-cyan p-4 mb-6 flex items-start gap-3"
        >
          <BellAlertIcon className="h-5 w-5 text-synergy-cyan shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-synergy-text">{alerts[0].title}</p>
            <p className="text-xs text-synergy-muted truncate">{alerts[0].description}</p>
          </div>
          {alerts.length > 1 && <span className="badge-cyan shrink-0">+{alerts.length - 1} more</span>}
        </motion.div>
      )}

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        {stats.map((stat) => (
          <motion.div key={stat.label} variants={item} className="stat-card">
            <div className="flex items-start justify-between mb-3">
              <stat.icon className="h-5 w-5 text-synergy-cyan" />
              <span className="text-xs text-synergy-muted">{stat.sub}</span>
            </div>
            <div className="text-2xl font-bold text-synergy-text truncate">{stat.value}</div>
            <div className="text-xs text-synergy-muted mt-1">{stat.label}</div>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 glass-card p-6"
        >
          <h2 className="section-title mb-4">Territory Performance</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barSize={32}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#f8fafc' }}
                  formatter={(v) => [fmt(Number(v)), 'Avg Net Benefit']}
                />
                <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-synergy-muted text-sm">
              Run your first analysis to see territory performance
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="glass-card p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Recent Projects</h2>
            <Link href="/projects" className="text-synergy-cyan text-xs hover:underline flex items-center gap-1">
              View all <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {projects.slice(0, 5).map(p => (
              <Link key={p.id} href={`/projects/${p.id}`}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors group"
              >
                <div className="h-8 w-8 rounded-lg bg-synergy-cyan/10 flex items-center justify-center shrink-0">
                  <FolderIcon className="h-4 w-4 text-synergy-cyan" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-synergy-text truncate group-hover:text-synergy-cyan transition-colors">
                    {p.title}
                  </p>
                  <p className="text-xs text-synergy-muted">{p.type} · {p.status}</p>
                </div>
              </Link>
            ))}
            {projects.length === 0 && (
              <div className="text-center py-6">
                <p className="text-synergy-muted text-sm mb-3">No projects yet</p>
                <Link href="/projects/new" className="btn-primary text-xs">Create first project</Link>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {alerts.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-6"
        >
          <h2 className="section-title mb-4">Policy Alerts</h2>
          <div className="space-y-3">
            {alerts.slice(0, 4).map(alert => (
              <div key={alert.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/5">
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
