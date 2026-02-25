'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, FileText, ClipboardList, Package,
  ShieldCheck, CheckSquare, Bell, LogOut, ChevronRight, Menu, X
} from 'lucide-react';
import { useAuthStore } from '@/lib/authStore';
import api from '@/lib/api';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/statements', label: 'Statements', icon: FileText },
  { href: '/claims', label: 'Claims', icon: ClipboardList },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/substantiations', label: 'Substantiations', icon: ShieldCheck },
  { href: '/tasks', label: 'My Tasks', icon: CheckSquare },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser, logout } = useAuthStore();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.push('/auth/login'); return; }
    if (!user) {
      api.get('/auth/me').then(({ data }) => setUser(data.user)).catch(() => {
        logout(); router.push('/auth/login');
      });
    }
    api.get('/notifications/unread-count').then(({ data }) => setUnread(data.count)).catch(() => {});
  }, []);

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try { await api.post('/auth/logout', { refreshToken }); } catch {}
    logout();
    router.push('/auth/login');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white flex flex-col transform transition-transform lg:relative lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-700">
          <span className="text-xl font-bold text-blue-400">ClaimsOS</span>
          <button className="lg:hidden" onClick={() => setOpen(false)}><X size={20} /></button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${pathname === href || pathname?.startsWith(href + '/') ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-gray-700">
          {user && (
            <div className="mb-3 px-3">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-gray-400 truncate">{user.role}</p>
            </div>
          )}
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {open && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button className="lg:hidden" onClick={() => setOpen(true)}><Menu size={22} /></button>
          <div className="flex items-center gap-3 ml-auto">
            <Link href="/notifications" className="relative p-2 rounded-lg hover:bg-gray-100">
              <Bell size={20} />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>
              )}
            </Link>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
