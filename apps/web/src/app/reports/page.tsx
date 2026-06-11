'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { DocumentArrowDownIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { api, Report } from '@/lib/api';
import Layout from '@/components/Layout';

const FORMAT_COLORS: Record<string, string> = {
  PDF: 'badge-red',
  XLSX: 'badge-green',
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.reports.list()
      .then(data => setReports(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-40 bg-synergy-card rounded-lg" />
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-synergy-card rounded-2xl" />)}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="text-synergy-muted text-sm mt-1">Generated analysis reports</p>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <DocumentTextIcon className="h-10 w-10 text-synergy-muted mx-auto mb-4" />
          <p className="text-synergy-muted mb-2">No reports generated yet.</p>
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
              className="glass-card p-4 flex items-center gap-4 hover:border-synergy-cyan/20 transition-all"
            >
              <div className="h-10 w-10 rounded-xl bg-synergy-cyan/10 flex items-center justify-center shrink-0">
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
                <motion.a
                  href={report.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="btn-secondary flex items-center gap-2 shrink-0"
                >
                  <DocumentArrowDownIcon className="h-4 w-4" />
                  Download
                </motion.a>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </Layout>
  );
}
