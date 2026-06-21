'use client';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card grain max-w-md w-full p-8 text-center"
      >
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-synergy-red/10 mb-4">
          <ExclamationTriangleIcon className="h-7 w-7 text-synergy-red" />
        </div>
        <h1 className="text-xl font-bold text-synergy-text mb-2">Something went wrong</h1>
        <p className="text-sm text-synergy-muted mb-6">
          An unexpected error occurred while loading this view. You can retry, or head back to the dashboard.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={reset} className="btn-primary">
            <ArrowPathIcon className="h-4 w-4" />
            Try again
          </button>
          <a href="/" className="btn-secondary">Go to dashboard</a>
        </div>
      </motion.div>
    </div>
  );
}
