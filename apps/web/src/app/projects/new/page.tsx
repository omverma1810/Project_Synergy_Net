'use client';
import Link from 'next/link';

export default function NewProjectPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-synergy-text">New Project</h1>
        <p className="text-synergy-muted mt-1">
          Project creation form — coming soon.{' '}
          <Link href="/projects" className="text-synergy-cyan hover:underline">
            Back to projects
          </Link>
        </p>
      </div>
    </div>
  );
}
