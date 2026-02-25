'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import { Plus, FolderKanban, ChevronRight, Target, CheckCircle } from 'lucide-react';
import Link from 'next/link';

const STATUS_BADGE: Record<string, string> = {
  active: 'badge-green', on_hold: 'badge-yellow', completed: 'badge-blue', cancelled: 'badge-red',
};

export default function ProjectsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', targetLaunchDate: '' });
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['projects', statusFilter],
    queryFn: async () => {
      const params: any = { limit: 50 };
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/projects', { params });
      return data;
    },
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => { const { data } = await api.get('/users'); return data.data; },
    enabled: showCreate,
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/projects', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setShowCreate(false); setForm({ name: '', description: '', targetLaunchDate: '' }); },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to create project'),
  });

  const projects = data?.data || [];
  const upd = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [f]: e.target.value }));

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
            <p className="text-sm text-gray-500 mt-1">{data?.pagination?.total ?? '—'} projects</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>

        {/* Filters */}
        <div className="card p-4 mb-5 flex gap-3">
          <select className="input text-sm w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {['active','on_hold','completed','cancelled'].map(s => (
              <option key={s} value={s}>{s.replace('_',' ')}</option>
            ))}
          </select>
        </div>

        {/* Create modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="card w-full max-w-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">New Project</h2>
              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
              <form onSubmit={e => { e.preventDefault(); setError(''); createMutation.mutate(form); }} className="space-y-4">
                <div>
                  <label className="label">Project name <span className="text-red-500">*</span></label>
                  <input className="input" required value={form.name} onChange={upd('name')} placeholder="e.g. Q4 Hydration Campaign" />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea className="input resize-none" rows={2} value={form.description} onChange={upd('description')} placeholder="What is this project about?" />
                </div>
                <div>
                  <label className="label">Target launch date</label>
                  <input type="date" className="input" value={form.targetLaunchDate} onChange={upd('targetLaunchDate')} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1">
                    {createMutation.isPending ? 'Creating...' : 'Create Project'}
                  </button>
                  <button type="button" onClick={() => { setShowCreate(false); setError(''); }} className="btn-secondary flex-1">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : projects.length === 0 ? (
          <div className="card p-12 text-center">
            <FolderKanban className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 mb-4">No projects yet.</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary mx-auto"><Plus className="w-4 h-4" /> Create first project</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map((p: any) => {
              const pct = p.claimsCount > 0 ? Math.round((p.approvedClaimsCount / p.claimsCount) * 100) : 0;
              const overdue = p.targetLaunchDate && new Date(p.targetLaunchDate) < new Date() && p.status === 'active';
              return (
                <Link key={p._id} href={`/projects/${p._id}`}
                  className="card p-5 hover:shadow-md transition-shadow cursor-pointer block group">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">{p.name}</h3>
                      {p.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{p.description}</p>}
                    </div>
                    <span className={`badge ${STATUS_BADGE[p.status] || 'badge-gray'} flex-shrink-0 text-xs`}>
                      {p.status.replace('_',' ')}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>{p.approvedClaimsCount || 0} / {p.claimsCount || 0} claims approved</span>
                      <span className="font-medium">{pct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-50">
                    <span className="flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      {p.targetLaunchDate
                        ? <span className={overdue ? 'text-red-500 font-medium' : ''}>{new Date(p.targetLaunchDate).toLocaleDateString()}</span>
                        : 'No deadline'}
                    </span>
                    {p.managerId && (
                      <span>{p.managerId.firstName} {p.managerId.lastName}</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
