'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AuthShell } from '@/components/AuthShell';

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
      const json = await api.auth.login(data.email, data.password);
      localStorage.setItem('auth_token', json.access);
      localStorage.setItem('refresh_token', json.refresh);
      document.cookie = `auth_token=${json.access}; path=/; SameSite=Lax`;
      router.push('/');
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message || 'Invalid credentials');
      } else {
        setError('Network error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="glass-card grain p-5 sm:p-8">
        <p className="eyebrow mb-2">Welcome back</p>
        <h1 className="text-2xl font-bold text-synergy-text mb-1">Sign in to Synergy Net</h1>
        <p className="text-sm text-synergy-muted mb-6">Continue optimising your global production finance.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="form-label">Email address</label>
            <input {...register('email')} type="email" autoComplete="email" placeholder="you@company.com" className="form-input" />
            {errors.email && <p className="mt-1 text-xs text-synergy-red">{errors.email.message}</p>}
          </div>

          <div>
            <label className="form-label">Password</label>
            <input {...register('password')} type="password" autoComplete="current-password" placeholder="••••••••" className="form-input" />
            {errors.password && <p className="mt-1 text-xs text-synergy-red">{errors.password.message}</p>}
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg bg-synergy-red/10 border border-synergy-red/25 px-3 py-2 text-sm text-synergy-red"
            >
              {error}
            </motion.div>
          )}

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5 mt-2"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 border-2 border-synergy-darker/30 border-t-synergy-darker rounded-full animate-spin" />
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

        <div className="mt-4 pt-4 border-t border-synergy-border/40 text-center">
          <p className="text-xs text-synergy-subtle">Demo · demo@synergy.net / demo123</p>
        </div>
      </div>
    </AuthShell>
  );
}
