'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { projects } from '@/lib/api';
import { PlusIcon } from '@heroicons/react/24/outline';

interface Project {
  id: number;
  title: string;
  type: string;
  status: string;
  genre?: string;
  total_budget?: string;
  currency: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-synergy-muted/10 text-synergy-muted',
  UPLOADED: 'bg-synergy-blue/10 text-synergy-blue',
  ANALYZING: 'bg-synergy-orange/10 text-synergy-orange',
  REVIEW: 'bg-synergy-orange/10 text-synergy-orange',
  COMPLETE: 'bg-synergy-green/10 text-synergy-green',
  ARCHIVED: 'bg-synergy-muted/10 text-synergy-muted',
};

export default function ProjectsPage() {
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    projects
      .list()
      .then((data) => setProjectList(data.results || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-synergy-muted">Loading projects...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-synergy-text">Projects</h1>
          <p className="text-synergy-muted mt-1">Manage your production projects</p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-x-2 rounded-lg bg-synergy-cyan px-4 py-2.5 text-sm font-semibold text-white hover:bg-synergy-cyan/80 transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          New Project
        </Link>
      </div>

      {projectList.length === 0 ? (
        <div className="bg-synergy-card rounded-lg border border-synergy-border p-12 text-center">
          <p className="text-synergy-muted">
            No projects yet.{' '}
            <Link href="/projects/new" className="text-synergy-cyan hover:underline">
              Create your first project
            </Link>
          </p>
        </div>
      ) : (
        <div className="bg-synergy-card rounded-lg border border-synergy-border overflow-hidden">
          <table className="min-w-full divide-y divide-synergy-border">
            <thead className="bg-synergy-dark">
              <tr>
                {['Project', 'Type', 'Budget', 'Status', ''].map((h) => (
                  <th
                    key={h}
                    className={`px-6 py-3 text-xs font-medium text-synergy-muted uppercase tracking-wider ${h === '' ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-synergy-border">
              {projectList.map((project) => (
                <tr key={project.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-synergy-text">{project.title}</div>
                    {project.genre && (
                      <div className="text-sm text-synergy-muted">{project.genre}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-synergy-muted">{project.type}</td>
                  <td className="px-6 py-4 text-sm text-synergy-muted">
                    {project.total_budget
                      ? `${project.total_budget} ${project.currency}`
                      : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={project.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/projects/${project.id}`}
                      className="text-synergy-cyan text-sm hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? STATUS_COLORS.DRAFT;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}
