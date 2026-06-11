'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { api } from '@/lib/api';
import Layout from '@/components/Layout';

const profileSchema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  company_name: z.string().optional(),
});
const passwordSchema = z.object({
  old_password: z.string().min(1, 'Required'),
  new_password: z.string().min(8, 'At least 8 characters'),
});
type ProfileData = z.infer<typeof profileSchema>;
type PasswordData = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const profileForm = useForm<ProfileData>({ resolver: zodResolver(profileSchema) });
  const passwordForm = useForm<PasswordData>({ resolver: zodResolver(passwordSchema) });

  useEffect(() => {
    api.auth.me().then(user => {
      profileForm.reset({ first_name: user.first_name, last_name: user.last_name, company_name: (user as { company_name?: string }).company_name || '' });
    }).catch(() => {});
  }, []);

  const onProfileSubmit = async (data: ProfileData) => {
    setProfileError('');
    setProfileSuccess(false);
    try {
      await api.auth.updateProfile(data);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (e: unknown) {
      setProfileError((e as Error).message || 'Update failed');
    }
  };

  const onPasswordSubmit = async (data: PasswordData) => {
    setPasswordError('');
    setPasswordSuccess(false);
    try {
      const res = await fetch('/api/auth/change-password/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Password change failed');
      }
      setPasswordSuccess(true);
      passwordForm.reset();
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (e: unknown) {
      setPasswordError((e as Error).message || 'Password change failed');
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl">
        <div className="mb-8">
          <h1 className="page-title">Settings</h1>
          <p className="text-synergy-muted text-sm mt-1">Manage your account and preferences</p>
        </div>

        <div className="space-y-6">
          {/* Profile */}
          <div className="glass-card p-6">
            <h2 className="section-title mb-4">Profile</h2>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">First name</label>
                  <input {...profileForm.register('first_name')} className="form-input" />
                  {profileForm.formState.errors.first_name && (
                    <p className="mt-1 text-xs text-synergy-red">{profileForm.formState.errors.first_name.message}</p>
                  )}
                </div>
                <div>
                  <label className="form-label">Last name</label>
                  <input {...profileForm.register('last_name')} className="form-input" />
                </div>
              </div>
              <div>
                <label className="form-label">Company / Production Company</label>
                <input {...profileForm.register('company_name')} className="form-input" placeholder="Acme Films Ltd" />
              </div>

              {profileError && (
                <div className="rounded-lg bg-synergy-red/10 border border-synergy-red/20 px-3 py-2 text-sm text-synergy-red">{profileError}</div>
              )}
              {profileSuccess && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-sm text-synergy-green">
                  <CheckCircleIcon className="h-4 w-4" /> Profile updated successfully
                </motion.div>
              )}

              <div className="flex justify-end">
                <button type="submit" disabled={profileForm.formState.isSubmitting} className="btn-primary">
                  {profileForm.formState.isSubmitting ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Password */}
          <div className="glass-card p-6">
            <h2 className="section-title mb-4">Change Password</h2>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
              <div>
                <label className="form-label">Current password</label>
                <input {...passwordForm.register('old_password')} type="password" className="form-input" placeholder="••••••••" />
                {passwordForm.formState.errors.old_password && (
                  <p className="mt-1 text-xs text-synergy-red">{passwordForm.formState.errors.old_password.message}</p>
                )}
              </div>
              <div>
                <label className="form-label">New password</label>
                <input {...passwordForm.register('new_password')} type="password" className="form-input" placeholder="At least 8 characters" />
                {passwordForm.formState.errors.new_password && (
                  <p className="mt-1 text-xs text-synergy-red">{passwordForm.formState.errors.new_password.message}</p>
                )}
              </div>

              {passwordError && (
                <div className="rounded-lg bg-synergy-red/10 border border-synergy-red/20 px-3 py-2 text-sm text-synergy-red">{passwordError}</div>
              )}
              {passwordSuccess && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-sm text-synergy-green">
                  <CheckCircleIcon className="h-4 w-4" /> Password changed successfully
                </motion.div>
              )}

              <div className="flex justify-end">
                <button type="submit" disabled={passwordForm.formState.isSubmitting} className="btn-primary">
                  {passwordForm.formState.isSubmitting ? 'Changing…' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>

          {/* App info */}
          <div className="glass-card p-6">
            <h2 className="section-title mb-3">About</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-synergy-muted">Platform</span>
                <span className="text-synergy-text">Synergy Net</span>
              </div>
              <div className="flex justify-between">
                <span className="text-synergy-muted">Version</span>
                <span className="text-synergy-text">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-synergy-muted">Territories</span>
                <span className="text-synergy-text">15+ active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
