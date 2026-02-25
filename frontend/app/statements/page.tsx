'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import { Plus, Search } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700', 'In Review': 'bg-yellow-100 text-yellow-700',
  'In Use': 'bg-green-100 text-green-700', Retired: 'bg-red-100 text-red-700',
};

export default function StatementsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ text: '', category: '', tags: '', status: 'Draft' });

  const { data, isLoading } = useQuery({
    queryKey: ['statements', search, status],
    queryFn: () => api.get('/statements', { params: { search, status, limit: 50 } }).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/statements', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['statements'] }); setShowModal(false); setForm({ text: '', category: '', tags: '', status: 'Draft' }); },
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, to }: { id: string; to: string }) => api.post(`/statements/${id}/transition`, { to }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['statements'] }),
  });

  const TRANSITIONS: Record<string, string[]> = {
    Draft: ['In Review'], 'In Review': ['In Use', 'Draft'], 'In Use': ['Retired'], Retired: [],
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Statements</h1>
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowModal(true)}>
            <Plus size={16} /> New Statement
          </button>
        </div>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input w-40" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {['Draft', 'In Review', 'In Use', 'Retired'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        {isLoading ? <div className="text-gray-500">Loading...</div> : (
          <div className="space-y-3">
            {data?.data?.map((s: any) => (
              <div key={s._id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{s.text}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-gray-500">{s.category}</span>
                      {s.tags?.map((t: string) => (
                        <span key={t} className="badge bg-blue-50 text-blue-700">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`badge ${STATUS_COLORS[s.status]}`}>{s.status}</span>
                    {TRANSITIONS[s.status]?.map(to => (
                      <button key={to} className="btn-secondary text-xs py-1"
                        onClick={() => transitionMutation.mutate({ id: s._id, to })}>
                        → {to}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {data?.data?.length === 0 && <p className="text-gray-500 text-sm text-center py-8">No statements found.</p>}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">New Statement</h2>
            <div className="space-y-3">
              <div>
                <label className="label">Statement Text *</label>
                <textarea className="input" rows={3} value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} />
              </div>
              <div>
                <label className="label">Category *</label>
                <input className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
              </div>
              <div>
                <label className="label">Tags (comma separated)</label>
                <input className="input" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-primary" disabled={createMutation.isPending}
                onClick={() => createMutation.mutate({ ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) })}>
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
