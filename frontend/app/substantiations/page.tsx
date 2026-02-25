'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import Link from 'next/link';
import api from '@/lib/api';
import { Plus } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700', 'Under Review': 'bg-yellow-100 text-yellow-700',
  Approved: 'bg-green-100 text-green-700', Expired: 'bg-red-100 text-red-700',
};
const TYPES = ['Clinical Study', 'Consumer Research', 'Expert Opinion', 'Regulatory Filing', 'Internal Test', 'Other'];

export default function SubstantiationsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'Clinical Study', description: '', expiryDate: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['substantiations', status],
    queryFn: () => api.get('/substantiations', { params: { status, limit: 50 } }).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/substantiations', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['substantiations'] }); setShowModal(false); },
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Substantiations</h1>
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowModal(true)}>
            <Plus size={16} /> New Substantiation
          </button>
        </div>
        <div className="flex gap-3">
          <select className="input w-48" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {['Draft', 'Under Review', 'Approved', 'Expired'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        {isLoading ? <div className="text-gray-500">Loading...</div> : (
          <div className="space-y-3">
            {data?.data?.map((s: any) => (
              <div key={s._id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link href={`/substantiations/${s._id}`} className="font-medium text-blue-600 hover:underline">{s.title}</Link>
                    <p className="text-sm text-gray-500 mt-0.5">{s.type}</p>
                    {s.expiryDate && <p className="text-xs text-gray-400">Expires: {new Date(s.expiryDate).toLocaleDateString()}</p>}
                  </div>
                  <span className={`badge ${STATUS_COLORS[s.status]} shrink-0`}>{s.status}</span>
                </div>
              </div>
            ))}
            {data?.data?.length === 0 && <p className="text-gray-500 text-center py-8">No substantiations found.</p>}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">New Substantiation</h2>
            <div className="space-y-3">
              <div>
                <label className="label">Title *</label>
                <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="label">Type *</label>
                <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label className="label">Expiry Date</label>
                <input type="date" className="input" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-primary" disabled={createMutation.isPending}
                onClick={() => createMutation.mutate(form)}>
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
