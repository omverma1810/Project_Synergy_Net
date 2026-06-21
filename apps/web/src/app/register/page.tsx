'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { AuthShell } from '@/components/AuthShell';

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
      const res = await fetch('/api/auth/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          company_name: data.company_name,
          password: data.password,
        }),
      });
      const json: Record<string, unknown> = await res.json();
      if (!res.ok) {
        const firstVal = Object.values(json)[0];
        const fromArray = Array.isArray(firstVal) ? firstVal[0] : undefined;
        const emailErr = Array.isArray(json.email) ? json.email[0] : undefined;
        const msg = String(emailErr || json.detail || fromArray || 'Registration failed');
        setError(msg);
        return;
      }
      // Auto-login after register
      const loginRes = await fetch('/api/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });
      if (loginRes.ok) {
        const tokens = await loginRes.json();
        localStorage.setItem('auth_token', tokens.access);
        localStorage.setItem('refresh_token', tokens.refresh);
        document.cookie = `auth_token=${tokens.access}; path=/; SameSite=Lax`;
        router.push('/');
      } else {
        router.push('/login');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="glass-card grain p-8">
          <p className="eyebrow mb-2">Get started free</p>
          <h1 className="text-2xl font-bold text-synergy-text mb-1">Create your account</h1>
          <p className="text-sm text-synergy-muted mb-6">Join producers optimising shoots across 16+ territories.</p>

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
              className="btn-primary w-full py-2.5 mt-2"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 border-2 border-synergy-darker/30 border-t-synergy-darker rounded-full animate-spin" />
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
    </AuthShell>
  );
}
