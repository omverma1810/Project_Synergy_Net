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
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    const fetchAlerts = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) return;
      try {
        const res = await fetch('/api/territories/alerts/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setAlertCount(Array.isArray(data) ? data.length : data.count || 0);
        }
      } catch {}
    };
    fetchAlerts();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-synergy-dark">
      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-synergy-card/95 backdrop-blur-xl border-r border-synergy-border/50 lg:hidden"
            >
              <div className="flex h-16 items-center justify-between px-6 border-b border-synergy-border/50">
                <LogoMark />
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
        <div className="flex grow flex-col bg-synergy-card/80 backdrop-blur-xl border-r border-synergy-border/50">
          <div className="flex h-16 items-center px-6 border-b border-synergy-border/50">
            <LogoMark />
          </div>
          <SidebarNav pathname={pathname} onLogout={handleLogout} />
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 items-center gap-x-4 border-b border-synergy-border/50 bg-synergy-dark/80 backdrop-blur-lg px-4 sm:px-6 lg:px-8">
          <button
            className="lg:hidden text-synergy-muted hover:text-synergy-text transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          <div className="flex flex-1 items-center justify-end gap-x-3">
            {/* Alert bell */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative text-synergy-muted hover:text-synergy-text transition-colors"
              onClick={() => router.push('/territories?tab=alerts')}
            >
              <BellIcon className="h-5 w-5" />
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center rounded-full bg-synergy-cyan text-synergy-dark text-[9px] font-bold">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </motion.button>

            <div className="h-4 w-px bg-synergy-border" />

            {/* User avatar */}
            <div className="h-8 w-8 rounded-full bg-synergy-cyan/20 border border-synergy-cyan/30 flex items-center justify-center text-synergy-cyan text-sm font-bold">
              P
            </div>
          </div>
        </div>

        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}

function LogoMark() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-7 w-7 rounded-lg bg-synergy-cyan/20 border border-synergy-cyan/40 flex items-center justify-center">
        <div className="h-3 w-3 rounded-sm bg-synergy-cyan" />
      </div>
      <span className="text-synergy-text font-bold text-base tracking-wide">
        SYNERGY <span className="text-synergy-cyan">NET</span>
      </span>
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
                ? 'text-synergy-cyan bg-synergy-cyan/10 border border-synergy-cyan/20'
                : 'text-synergy-muted hover:text-synergy-text hover:bg-white/5',
            ].join(' ')}
          >
            {isActive && (
              <motion.div
                layoutId="activeNav"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-synergy-cyan rounded-r-full"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <item.icon className="h-5 w-5 shrink-0" />
            {item.name}
          </Link>
        );
      })}

      <div className="mt-auto pt-4 border-t border-synergy-border/50">
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
