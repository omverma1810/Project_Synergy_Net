'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  FolderIcon,
  GlobeAltIcon,
  ChartBarIcon,
  DocumentTextIcon,
  CogIcon,
  Bars3Icon,
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
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-synergy-dark">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 bg-synergy-card border-r border-synergy-border">
            <SidebarContent pathname={pathname} onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-synergy-card border-r border-synergy-border px-6 pb-4">
          <SidebarContent pathname={pathname} />
        </div>
      </div>

      {/* Main content area */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 items-center gap-x-4 border-b border-synergy-border bg-synergy-dark px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            className="lg:hidden -m-2.5 p-2.5 text-synergy-muted"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-x-4">
            <span className="text-synergy-cyan font-bold text-lg">SYNERGY NET</span>
          </div>
        </div>

        <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  pathname,
  onClose,
}: {
  pathname: string;
  onClose?: () => void;
}) {
  return (
    <>
      <div className="flex h-16 shrink-0 items-center">
        <span className="text-synergy-cyan font-bold text-xl">SYNERGY NET</span>
      </div>
      <nav className="flex flex-1 flex-col">
        <ul className="flex flex-1 flex-col gap-y-1">
          {navigation.map((item) => (
            <li key={item.name}>
              <Link
                href={item.href}
                onClick={onClose}
                className={[
                  'group flex gap-x-3 rounded-md p-3 text-sm font-semibold leading-6 transition-colors',
                  pathname === item.href
                    ? 'bg-synergy-cyan/10 text-synergy-cyan'
                    : 'text-synergy-muted hover:text-synergy-text hover:bg-white/5',
                ].join(' ')}
              >
                <item.icon className="h-6 w-6 shrink-0" />
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
