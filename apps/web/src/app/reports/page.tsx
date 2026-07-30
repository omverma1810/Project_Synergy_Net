'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { toast } from 'sonner';
import { DocumentArrowDownIcon, DocumentTextIcon, FolderIcon } from '@heroicons/react/24/outline';
import { api, Report, ProjectSummary } from '@/lib/api';
import Layout from '@/components/Layout';

async function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const DELIVERABLES: { key: 'financialModel' | 'businessPlan' | 'pitchDeck'; label: string; file: string }[] = [
  { key: 'financialModel', label: 'Financial Model', file: 'financial_model' },
  { key: 'businessPlan', label: 'Business Plan', file: 'business_plan' },
  { key: 'pitchDeck', label: 'Pitch Deck', file: 'pitch_deck' },
];

function ProjectDeliverables({ project }: { project: ProjectSummary }) {
  const [busy, setBusy] = useState<string | null>(null);

  const handleDownload = async (key: 'financialModel' | 'businessPlan' | 'pitchDeck', file: string) => {
    setBusy(key);
    try {
      const blob = key === 'financialModel'
        ? await api.analysis.financialModelPdf(project.id)
        : key === 'businessPlan'
        ? await api.analysis.businessPlanPdf(project.id)
        : await api.analysis.pitchDeckPdf(project.id);
      await downloadBlob(blob, `synergy_${file}_${project.id}.pdf`);
      toast.success(`${DELIVERABLES.find(d => d.key === key)?.label} PDF ready`);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'PDF generation failed — add a budget or spend estimates first');
    } finally {
      setBusy(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 flex items-center gap-4 flex-wrap transition-all duration-300 hover:border-synergy-cyan/30 hover:shadow-glow-cyan"
    >
      <div className="h-11 w-11 rounded-xl bg-synergy-cyan/10 flex items-center justify-center shrink-0">
        <FolderIcon className="h-5 w-5 text-synergy-cyan" />
      </div>
      <div className="flex-1 min-w-[140px]">
        <Link href={`/projects/${project.id}`} className="font-medium text-synergy-text hover:text-synergy-cyan transition-colors">
          {project.title}
        </Link>
        <p className="text-xs text-synergy-muted mt-0.5">{project.type} · {project.genre}</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {DELIVERABLES.map(d => (
          <motion.button
            key={d.key}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => handleDownload(d.key, d.file)}
            disabled={busy !== null}
            className="btn-secondary flex items-center gap-1.5 text-xs px-3"
          >
            {busy === d.key
              ? <span className="h-3.5 w-3.5 border-2 border-synergy-muted/30 border-t-synergy-muted rounded-full animate-spin" />
              : <DocumentArrowDownIcon className="h-3.5 w-3.5" />}
            {d.label}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

async function downloadReport(report: Report) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const res = await fetch(report.file_url!, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `synergy_report_${report.id}.${report.format === 'PDF' ? 'pdf' : 'xlsx'}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const FORMAT_COLORS: Record<string, string> = {
  PDF: 'badge-red',
  XLSX: 'badge-green',
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.reports.list().catch(() => [] as Report[]),
      api.projects.list().catch(() => [] as ProjectSummary[]),
    ]).then(([r, p]) => {
      setReports(Array.isArray(r) ? r : []);
      setProjects(Array.isArray(p) ? p : []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="h-8 w-40 skeleton mb-2" />
        <div className="h-4 w-56 skeleton mb-8" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 skeleton rounded-2xl" />)}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="eyebrow mb-1.5">Deliverables</p>
          <h1 className="page-title">Reports</h1>
          <p className="text-synergy-muted text-sm mt-1.5">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'} · {reports.length} exported {reports.length === 1 ? 'report' : 'reports'}
          </p>
        </div>
      </div>

      {/* Investor deliverables — generated on demand per project, no upload needed */}
      <div className="mb-10">
        <h2 className="section-title mb-1">Investor Deliverables</h2>
        <p className="text-synergy-muted text-sm mb-4">
          One-click PDFs generated live from each project&apos;s financial model — no need to run an analysis first.
        </p>
        {projects.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <FolderIcon className="h-8 w-8 text-synergy-muted mx-auto mb-3" />
            <p className="text-synergy-muted text-sm mb-3">No projects yet.</p>
            <Link href="/projects/new" className="btn-primary inline-flex">Create a Project</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map(p => <ProjectDeliverables key={p.id} project={p} />)}
          </div>
        )}
      </div>

      {/* Legacy analysis reports (PDF/XLSX export from a completed analysis) */}
      <h2 className="section-title mb-1">Analysis Reports</h2>
      <p className="text-synergy-muted text-sm mb-4">Exported from a completed territory analysis.</p>
      {reports.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <DocumentTextIcon className="h-10 w-10 text-synergy-muted mx-auto mb-4" />
          <p className="text-synergy-muted mb-2">No analysis reports generated yet.</p>
          <p className="text-xs text-synergy-muted">Run an analysis and export PDF or Excel from the project page.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report, i) => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group glass-card p-4 flex items-center gap-4 transition-all duration-300 hover:border-synergy-cyan/30 hover:shadow-glow-cyan hover:-translate-y-0.5"
            >
              <div className="h-11 w-11 rounded-xl bg-synergy-cyan/10 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                <DocumentTextIcon className="h-5 w-5 text-synergy-cyan" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-synergy-text truncate">{report.project_title}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-synergy-muted">
                  <span className={FORMAT_COLORS[report.format] || 'badge-muted'}>{report.format}</span>
                  <span>{new Date(report.generated_at).toLocaleDateString()}</span>
                  {report.file_size && <span>· {Math.round(report.file_size / 1024)} KB</span>}
                  <span>· {report.download_count} downloads</span>
                </div>
              </div>
              {report.file_url && (
                <motion.button
                  onClick={() => downloadReport(report)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="btn-secondary flex items-center gap-2 shrink-0"
                >
                  <DocumentArrowDownIcon className="h-4 w-4" />
                  Download
                </motion.button>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </Layout>
  );
}
