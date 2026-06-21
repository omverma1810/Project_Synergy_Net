'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PlusIcon,
  TrashIcon,
  ChartBarIcon,
  EyeIcon,
  FolderIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { api, ProjectSummary } from '@/lib/api';
import Layout from '@/components/Layout';
import { RowSkeleton } from '@/components/ui/Skeleton';

const STATUS_BADGES: Record<string, string> = {
  DRAFT: 'badge-muted',
  UPLOADED: 'badge-cyan',
  ANALYZING: 'badge-orange',
  REVIEW: 'badge-orange',
  COMPLETE: 'badge-green',
  ARCHIVED: 'badge-muted',
};

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    api.projects.list()
      .then(data => setProjects(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = projects.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.type.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await api.projects.delete(id);
      setProjects(prev => prev.filter(p => p.id !== id));
      toast.success('Project deleted');
    } catch {
      toast.error('Could not delete project');
    } finally {
      setDeleting(null);
    }
  };

  const handleAnalyze = async (project: ProjectSummary) => {
    const t = toast.loading(`Starting analysis for ${project.title}…`);
    try {
      const detail = await api.projects.get(project.id);
      if (!detail.budgets?.length) {
        toast.error('Upload a budget or add spend estimates first.', { id: t });
        return;
      }
      const budget = detail.budgets[detail.budgets.length - 1];
      const analysis = await api.analysis.create(project.id, budget.id);
      toast.success('Analysis started', { id: t });
      router.push(`/analysis?id=${analysis.id}`);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Failed to start analysis', { id: t });
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="h-8 w-40 skeleton mb-2" />
        <div className="h-4 w-32 skeleton mb-8" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <RowSkeleton key={i} />)}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="eyebrow mb-1.5">Your Slate</p>
          <h1 className="page-title">Projects</h1>
          <p className="text-synergy-muted text-sm mt-1.5">{projects.length} total {projects.length === 1 ? 'project' : 'projects'}</p>
        </div>
        <Link href="/projects/new" className="btn-primary">
          <PlusIcon className="h-4 w-4" />
          New Project
        </Link>
      </div>

      <div className="relative mb-6">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-synergy-muted" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search projects…"
          className="form-input pl-10"
        />
      </div>

      {filtered.length === 0 && (
        <div className="glass-card p-12 text-center">
          <FolderIcon className="h-10 w-10 text-synergy-muted mx-auto mb-4" />
          <p className="text-synergy-muted mb-4">
            {search ? 'No projects match your search.' : 'No projects yet.'}
          </p>
          {!search && (
            <Link href="/projects/new" className="btn-primary inline-flex items-center gap-2">
              <PlusIcon className="h-4 w-4" /> Create Project
            </Link>
          )}
        </div>
      )}

      <div className="space-y-3">
        <AnimatePresence>
          {filtered.map((project) => (
            <motion.div
              key={project.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
              className="group glass-card p-4 sm:p-5 transition-all duration-300 hover:border-synergy-cyan/30 hover:shadow-glow-cyan hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-synergy-cyan/10 border border-synergy-cyan/20 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                  <FolderIcon className="h-4 w-4 sm:h-5 sm:w-5 text-synergy-cyan" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/projects/${project.id}`}
                      className="font-semibold text-synergy-text hover:text-synergy-cyan transition-colors truncate"
                    >
                      {project.title}
                    </Link>
                    <span className={STATUS_BADGES[project.status] || 'badge-muted'}>{project.status?.toLowerCase()}</span>
                    {project.vetting_status === 'APPROVED' && <span className="badge-green">vetted</span>}
                    {project.vetting_status === 'FLAGGED' && <span className="badge-red">flagged</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-synergy-muted flex-wrap">
                    <span>{project.type}</span>
                    {project.genre && <><span>·</span><span>{project.genre}</span></>}
                    {project.total_budget && (
                      <><span className="hidden sm:inline">·</span>
                      <span className="hidden sm:inline">{parseFloat(project.total_budget).toLocaleString('en-US', {
                        style: 'currency', currency: project.currency, maximumFractionDigits: 0
                      })}</span></>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <motion.button
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => handleAnalyze(project)}
                    className="btn-secondary flex items-center gap-1.5 text-xs px-2.5 sm:px-4"
                  >
                    <ChartBarIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Analyze</span>
                  </motion.button>
                  <Link href={`/projects/${project.id}`} className="btn-secondary flex items-center gap-1.5 text-xs px-2.5 sm:px-4">
                    <EyeIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">View</span>
                  </Link>
                  <motion.button
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => handleDelete(project.id)}
                    disabled={deleting === project.id}
                    className="btn-danger flex items-center gap-1.5 text-xs px-2.5 sm:px-4"
                  >
                    {deleting === project.id
                      ? <span className="h-4 w-4 border-2 border-synergy-red/30 border-t-synergy-red rounded-full animate-spin" />
                      : <TrashIcon className="h-4 w-4" />
                    }
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
