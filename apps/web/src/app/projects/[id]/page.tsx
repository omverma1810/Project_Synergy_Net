'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-synergy-text">Project #{id}</h1>
        <p className="text-synergy-muted mt-1">
          Project detail view — coming soon.{' '}
          <Link href="/projects" className="text-synergy-cyan hover:underline">
            Back to projects
          </Link>
        </p>
      </div>
    </div>
  );
}
