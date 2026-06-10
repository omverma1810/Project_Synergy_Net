'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { projects, territories } from '@/lib/api';
import { FolderIcon, GlobeAltIcon, ChartBarIcon } from '@heroicons/react/24/outline';

interface Project {
  id: number;
  title: string;
  type: string;
  status: string;
  genre?: string;
  total_budget?: string;
  currency: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState({ projects: 0, territories: 0, analyses: 0 });
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [pData, tData] = await Promise.all([projects.list(), territories.list()]);
        setStats({
          projects: pData.count || 0,
          territories: tData.count || tData.length || 0,
          analyses: 0,
        });
        setRecentProjects(pData.results?.slice(0, 5) || []);
      } catch (e) {
        console.error(e);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-synergy-text">Dashboard</h1>
        <p className="text-synergy-muted mt-1">Overview of your production finance intelligence</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Projects" value={stats.projects} icon={FolderIcon} color="cyan" />
        <StatCard title="Territories" value={stats.territories} icon={GlobeAltIcon} color="green" />
        <StatCard title="Analyses" value={stats.analyses} icon={ChartBarIcon} color="orange" />
      </div>

      {/* Recent Projects */}
      <div className="bg-synergy-card rounded-lg border border-synergy-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-synergy-text">Recent Projects</h2>
          <Link href="/projects" className="text-synergy-cyan text-sm hover:underline">
            View all
          </Link>
        </div>
        {recentProjects.length === 0 ? (
          <p className="text-synergy-muted text-sm">
            No projects yet. Create your first project to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {recentProjects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between py-3 border-b border-synergy-border last:border-0"
              >
                <div>
                  <p className="text-synergy-text font-medium">{project.title}</p>
                  <p className="text-synergy-muted text-sm">
                    {project.type} &bull; {project.status}
                  </p>
                </div>
                <Link
                  href={`/projects/${project.id}`}
                  className="text-synergy-cyan text-sm hover:underline"
                >
                  View
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: 'cyan' | 'green' | 'orange';
}) {
  const colors = {
    cyan: 'bg-synergy-cyan/10 text-synergy-cyan',
    green: 'bg-synergy-green/10 text-synergy-green',
    orange: 'bg-synergy-orange/10 text-synergy-orange',
  } as const;

  return (
    <div className="bg-synergy-card rounded-lg border border-synergy-border p-6">
      <div className="flex items-center gap-x-4">
        <div className={`rounded-lg p-3 ${colors[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-synergy-muted text-sm">{title}</p>
          <p className="text-2xl font-bold text-synergy-text">{value}</p>
        </div>
      </div>
    </div>
  );
}
