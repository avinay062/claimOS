'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, FileText, ClipboardList, Package, ShieldCheck,
  CheckSquare, Bell, LogOut, Menu, X, Globe, FolderKanban,
  Copy, BarChart3, Search, Settings, ChevronDown, ChevronRight, AlertTriangle
} from 'lucide-react';
import { useAuthStore } from '@/lib/authStore';
import api from '@/lib/api';

const NAV_SECTIONS = [
  {
    label: 'Core',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/statements', label: 'Statements', icon: FileText },
      { href: '/claims', label: 'Claims', icon: ClipboardList },
      { href: '/products', label: 'Products', icon: Package },
      { href: '/substantiations', label: 'Substantiations', icon: ShieldCheck },
    ],
  },
  {
    label: 'Phase 3 — Localization',
    items: [
      { href: '/projects', label: 'Projects', icon: FolderKanban },
      { href: '/local-adaptations', label: 'Local Adaptations', icon: Globe },
    ],
  },
  {
    label: 'Phase 4 — Pack Copy',
    items: [
      { href: '/pack-copy', label: 'Pack Copy', icon: Copy },
    ],
  },
  {
    label: 'Workflow & Insights',
    items: [
      { href: '/tasks', label: 'My Tasks', icon: CheckSquare },
      { href: '/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/search', label: 'Global Search', icon: Search },
    ],
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser, logout } = useAuthStore();
  const [unread, setUnread] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.push('/auth/login'); return; }
    if (!user) {
      api.get('/auth/me').then(({ data }) => setUser(data.user)).catch(() => {
        logout(); router.push('/auth/login');
      });
    }
    const fetchUnread = () => api.get('/notifications/unread-count').then(({ data }) => setUnread(data.count)).catch(() => {});
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try { await api.post('/auth/logout', { refreshToken }); } catch {}
    logout(); router.push('/auth/login');
  };

  const isActive = (href: string) => pathname === href || (href !== '/dashboard' && pathname?.startsWith(href));

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 flex flex-col transition-transform duration-200 lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/60">
          <div>
            <div className="text-lg font-bold text-blue-400 tracking-tight">ClaimsOS</div>
            <div className="text-xs text-gray-500 mt-0.5">v5.0 · All Phases</div>
          </div>
          <button className="lg:hidden text-gray-400 hover:text-white" onClick={() => setSidebarOpen(false)}><X size={18}/></button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 space-y-5">
          {NAV_SECTIONS.map(section => (
            <div key={section.label}>
              <p className="px-4 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-600">{section.label}</p>
              {section.items.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href}
                  className={`flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors rounded-none border-l-2 ${
                    isActive(href)
                      ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                      : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  }`}>
                  <Icon size={15} className="shrink-0" />
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-gray-700/60 px-4 py-3">
          {user && (
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {user.name?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-200 truncate">{user.name}</p>
                <p className="text-[10px] text-gray-500 capitalize">{user.role?.replace(/_/g, ' ')}</p>
              </div>
            </div>
          )}
          <button onClick={handleLogout}
            className="flex items-center gap-2 px-2 py-1.5 w-full text-xs text-gray-500 hover:text-gray-300 rounded transition-colors">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-1.5 rounded hover:bg-gray-100" onClick={() => setSidebarOpen(true)}>
              <Menu size={18} />
            </button>
            {/* Quick search */}
            <form onSubmit={e => { e.preventDefault(); if (searchQuery.trim()) router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`); }}
              className="hidden sm:flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5 w-56">
              <Search size={14} className="text-gray-400 shrink-0" />
              <input className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none w-full"
                placeholder="Search everything..." value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)} />
            </form>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/notifications" className="relative p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
            {user?.role === 'admin' && (
              <Link href="/admin" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">
                <Settings size={18} />
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
