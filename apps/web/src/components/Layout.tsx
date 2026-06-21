'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HomeIcon,
  FolderIcon,
  GlobeAltIcon,
  ChartBarIcon,
  DocumentTextIcon,
  CogIcon,
  Bars3Icon,
  XMarkIcon,
  BellIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { SynergyWordmark } from './Brand';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Projects', href: '/projects', icon: FolderIcon },
  { name: 'Territories', href: '/territories', icon: GlobeAltIcon },
  { name: 'Analysis', href: '/analysis', icon: ChartBarIcon },
  { name: 'Reports', href: '/reports', icon: DocumentTextIcon },
  { name: 'Settings', href: '/settings', icon: CogIcon },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [userInitial, setUserInitial] = useState('P');
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) router.push('/login');
  }, [router]);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) return;
    fetch('/api/territories/alerts/', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setAlertCount(Array.isArray(data) ? data.length : data.count || 0);
      })
      .catch(() => {});
    fetch('/api/auth/me/', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((u) => {
        if (u) setUserInitial((u.first_name?.[0] || u.email?.[0] || 'P').toUpperCase());
      })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    document.cookie = 'auth_token=; path=/; max-age=0';
    router.push('/login');
  };

  return (
    <div className="min-h-screen">
      {/* Mobile sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: -288 }}
              animate={{ x: 0 }}
              exit={{ x: -288 }}
              transition={{ type: 'spring', damping: 26, stiffness: 240 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-synergy-card/95 backdrop-blur-xl border-r border-synergy-border/60 lg:hidden"
            >
              <div className="flex h-16 items-center justify-between px-6 border-b border-synergy-border/50">
                <SynergyWordmark size="sm" />
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-synergy-muted hover:text-synergy-text transition-colors"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <SidebarNav pathname={pathname} onClose={() => setSidebarOpen(false)} onLogout={handleLogout} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col bg-synergy-card/50 backdrop-blur-xl border-r border-synergy-border/50">
          <div className="flex h-16 items-center px-6 border-b border-synergy-border/40">
            <SynergyWordmark size="sm" />
          </div>
          <SidebarNav pathname={pathname} onLogout={handleLogout} />
        </div>
      </div>

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-x-4 border-b border-synergy-border/40 bg-synergy-dark/70 backdrop-blur-xl px-4 sm:px-6 lg:px-8">
          <button
            className="lg:hidden text-synergy-muted hover:text-synergy-text transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          <div className="flex flex-1 items-center justify-end gap-x-3">
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              className="relative text-synergy-muted hover:text-synergy-cyan transition-colors p-1"
              onClick={() => router.push('/territories?tab=alerts')}
              aria-label="Policy alerts"
            >
              <BellIcon className="h-5 w-5" />
              {alertCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-gradient-cyan text-synergy-darker text-[9px] font-bold shadow-glow-cyan">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </motion.button>

            <div className="h-5 w-px bg-synergy-border" />

            <button
              onClick={handleLogout}
              className="h-9 w-9 rounded-full bg-gradient-cyan flex items-center justify-center text-synergy-darker text-sm font-bold shadow-glow-cyan transition-transform hover:scale-105"
              title="Sign out"
            >
              {userInitial}
            </button>
          </div>
        </header>

        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function SidebarNav({
  pathname,
  onClose,
  onLogout,
}: {
  pathname: string;
  onClose?: () => void;
  onLogout: () => void;
}) {
  return (
    <nav className="flex flex-1 flex-col px-4 py-6 gap-1">
      {navigation.map((item) => {
        const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onClose}
            className={[
              'group relative flex items-center gap-x-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
              isActive
                ? 'text-synergy-cyan bg-synergy-cyan/10'
                : 'text-synergy-muted hover:text-synergy-text hover:bg-white/5',
            ].join(' ')}
          >
            {isActive && (
              <motion.div
                layoutId="activeNav"
                className="absolute inset-0 rounded-xl border border-synergy-cyan/25 bg-synergy-cyan/5"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            {isActive && (
              <motion.div
                layoutId="activeNavBar"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-gradient-cyan rounded-r-full shadow-glow-cyan"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <item.icon className="relative h-5 w-5 shrink-0 transition-transform group-hover:scale-110" />
            <span className="relative">{item.name}</span>
          </Link>
        );
      })}

      <div className="mt-auto pt-4">
        <div className="divider mb-4" />
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-x-3 rounded-xl px-3 py-2.5 text-sm font-medium text-synergy-muted hover:text-synergy-red hover:bg-synergy-red/5 transition-all duration-200"
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5 shrink-0" />
          Sign Out
        </button>
      </div>
    </nav>
  );
}
