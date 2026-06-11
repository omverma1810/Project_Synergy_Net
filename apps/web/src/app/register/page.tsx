'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { api } from '@/lib/api';

const schema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Enter a valid email'),
  company_name: z.string().min(1, 'Company name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine(d => d.password === d.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
});
type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
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
      await api.auth.register({
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        company_name: data.company_name,
        password: data.password,
      });
      // Auto-login after register
      const tokens = await api.auth.login(data.email, data.password);
      localStorage.setItem('auth_token', tokens.access);
      localStorage.setItem('refresh_token', tokens.refresh);
      document.cookie = `auth_token=${tokens.access}; path=/; SameSite=Lax`;
      router.push('/');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-synergy-dark flex items-center justify-center px-4 py-12">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 right-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -left-20 w-80 h-80 bg-synergy-cyan/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
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

        <div className="glass-card p-8">
          <h1 className="text-xl font-semibold text-synergy-text mb-6">Create your account</h1>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">First name</label>
                <input {...register('first_name')} type="text" placeholder="Alex" className="form-input" />
                {errors.first_name && <p className="mt-1 text-xs text-synergy-red">{errors.first_name.message}</p>}
              </div>
              <div>
                <label className="form-label">Last name</label>
                <input {...register('last_name')} type="text" placeholder="Producer" className="form-input" />
                {errors.last_name && <p className="mt-1 text-xs text-synergy-red">{errors.last_name.message}</p>}
              </div>
            </div>

            <div>
              <label className="form-label">Email address</label>
              <input {...register('email')} type="email" placeholder="you@company.com" className="form-input" />
              {errors.email && <p className="mt-1 text-xs text-synergy-red">{errors.email.message}</p>}
            </div>

            <div>
              <label className="form-label">Company / Production Company</label>
              <input {...register('company_name')} type="text" placeholder="Acme Films Ltd" className="form-input" />
              {errors.company_name && <p className="mt-1 text-xs text-synergy-red">{errors.company_name.message}</p>}
            </div>

            <div>
              <label className="form-label">Password</label>
              <input {...register('password')} type="password" placeholder="At least 8 characters" className="form-input" />
              {errors.password && <p className="mt-1 text-xs text-synergy-red">{errors.password.message}</p>}
            </div>

            <div>
              <label className="form-label">Confirm password</label>
              <input {...register('confirm_password')} type="password" placeholder="••••••••" className="form-input" />
              {errors.confirm_password && <p className="mt-1 text-xs text-synergy-red">{errors.confirm_password.message}</p>}
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
                  Creating account…
                </>
              ) : (
                'Create Account'
              )}
            </motion.button>
          </form>

          <p className="mt-6 text-center text-sm text-synergy-muted">
            Already have an account?{' '}
            <Link href="/login" className="text-synergy-cyan hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
