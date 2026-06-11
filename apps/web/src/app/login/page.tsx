'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import Link from 'next/link';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.detail || json.non_field_errors?.[0] || 'Invalid credentials');
        return;
      }
      localStorage.setItem('auth_token', json.access);
      localStorage.setItem('refresh_token', json.refresh);
      document.cookie = `auth_token=${json.access}; path=/; SameSite=Lax`;
      router.push('/');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-synergy-dark flex items-center justify-center px-4">
      {/* Background radial gradient */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-synergy-cyan/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="h-9 w-9 rounded-xl bg-synergy-cyan/20 border border-synergy-cyan/40 flex items-center justify-center">
              <div className="h-4 w-4 rounded-sm bg-synergy-cyan" />
            </div>
            <span className="text-xl font-bold text-synergy-text tracking-wide">
              SYNERGY <span className="text-synergy-cyan">NET</span>
            </span>
          </div>
          <p className="text-synergy-muted text-sm">Production Finance Intelligence Platform</p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <h1 className="text-xl font-semibold text-synergy-text mb-6">Sign in to your account</h1>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="form-label">Email address</label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                className="form-input"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-synergy-red">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="form-label">Password</label>
              <input
                {...register('password')}
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="form-input"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-synergy-red">{errors.password.message}</p>
              )}
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg bg-synergy-red/10 border border-synergy-red/20 px-3 py-2 text-sm text-synergy-red"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center flex items-center gap-2 py-2.5 mt-2"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 border-2 border-synergy-dark/30 border-t-synergy-dark rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </motion.button>
          </form>

          <p className="mt-6 text-center text-sm text-synergy-muted">
            No account yet?{' '}
            <Link href="/register" className="text-synergy-cyan hover:underline font-medium">
              Create one
            </Link>
          </p>

          <div className="mt-4 pt-4 border-t border-synergy-border/50 text-center">
            <p className="text-xs text-synergy-muted">Demo: demo@synergy.net / demo123</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
