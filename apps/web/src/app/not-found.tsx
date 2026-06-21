import Link from 'next/link';
import { SynergyMark } from '@/components/Brand';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass-card grain max-w-md w-full p-10 text-center">
        <div className="inline-flex mb-6 animate-float">
          <SynergyMark size={44} animate={false} />
        </div>
        <p className="text-6xl font-bold gradient-text mb-2">404</p>
        <h1 className="text-lg font-semibold text-synergy-text mb-2">Scene not found</h1>
        <p className="text-sm text-synergy-muted mb-6">
          This page didn&apos;t make the final cut. Let&apos;s get you back on set.
        </p>
        <Link href="/" className="btn-primary">Back to dashboard</Link>
      </div>
    </div>
  );
}
