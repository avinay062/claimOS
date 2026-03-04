'use client';
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import Link from 'next/link';
import api from '@/lib/api';
import { Search, FileText, ClipboardList, ShieldCheck, FolderKanban, Package } from 'lucide-react';

const TYPE_CONFIG: Record<string, { label: string; icon: any; href: (id: string) => string; color: string }> = {
  statement:      { label: 'Statement',      icon: FileText,      href: (id) => `/statements`,               color: 'bg-blue-100 text-blue-700' },
  claim:          { label: 'Claim',          icon: ClipboardList, href: (id) => `/claims/${id}`,             color: 'bg-purple-100 text-purple-700' },
  substantiation: { label: 'Substantiation', icon: ShieldCheck,   href: (id) => `/substantiations/${id}`,    color: 'bg-green-100 text-green-700' },
  project:        { label: 'Project',        icon: FolderKanban,  href: (id) => `/projects/${id}`,           color: 'bg-yellow-100 text-yellow-700' },
  product:        { label: 'Product',        icon: Package,       href: (id) => `/products`,                 color: 'bg-gray-100 text-gray-700' },
};

const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600', 'In Use': 'bg-green-100 text-green-700',
  Approved: 'bg-green-100 text-green-700', active: 'bg-green-100 text-green-700',
  'In Review': 'bg-yellow-100 text-yellow-700', Rejected: 'bg-red-100 text-red-700',
  Retired: 'bg-gray-100 text-gray-500',
};

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [inputVal, setInputVal] = useState(query);
  const [typeFilter, setTypeFilter] = useState('');

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['global-search', query, typeFilter],
    queryFn: () => api.get('/search', { params: { q: query, types: typeFilter || undefined, limit: 50 } }).then(r => r.data),
    enabled: query.length >= 2,
  });

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) { setQuery(q); setInputVal(q); }
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim().length >= 2) {
      setQuery(inputVal.trim());
      router.push(`/search?q=${encodeURIComponent(inputVal.trim())}`);
    }
  };

  const grouped = data?.results?.reduce((acc: any, r: any) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {}) ?? {};

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold">Global Search</h1>
          <p className="text-sm text-gray-500 mt-1">Search across statements, claims, substantiations, projects, and products</p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9 text-base" placeholder="Type at least 2 characters..."
              value={inputVal} onChange={e => setInputVal(e.target.value)} autoFocus />
          </div>
          <select className="input w-44" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            {Object.keys(TYPE_CONFIG).map(t => <option key={t} value={`${t}s`}>{TYPE_CONFIG[t].label}s</option>)}
          </select>
          <button type="submit" className="btn-primary px-6">Search</button>
        </form>

        {query.length >= 2 && (
          <div>
            {isLoading || isFetching ? (
              <div className="text-gray-500 text-sm">Searching...</div>
            ) : data?.total === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Search size={32} className="mx-auto mb-3 opacity-30" />
                <p>No results found for "<span className="font-medium">{query}</span>"</p>
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-sm text-gray-500">{data?.total} result{data?.total !== 1 ? 's' : ''} for "<span className="font-medium">{query}</span>"</p>
                {Object.entries(grouped).map(([type, results]: [string, any]) => {
                  const cfg = TYPE_CONFIG[type];
                  if (!cfg) return null;
                  const Icon = cfg.icon;
                  return (
                    <div key={type} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`badge ${cfg.color} flex items-center gap-1`}>
                          <Icon size={11} /> {cfg.label}s
                        </span>
                        <span className="text-xs text-gray-400">{results.length} result{results.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="space-y-1">
                        {results.map((r: any) => (
                          <Link key={r.id} href={cfg.href(r.id)}
                            className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                              {r.subtitle && <p className="text-xs text-gray-500 truncate mt-0.5">{r.subtitle}</p>}
                            </div>
                            {r.status && (
                              <span className={`badge text-xs shrink-0 ml-3 ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>{r.status}</span>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {query.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Search size={40} className="mx-auto mb-4 opacity-20" />
            <p className="text-sm">Enter a search term to find records across the system</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
