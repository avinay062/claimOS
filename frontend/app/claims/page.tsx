'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import Link from 'next/link';
import api from '@/lib/api';
import { Plus } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700', 'Legal Review': 'bg-yellow-100 text-yellow-700',
  'Regulatory Review': 'bg-purple-100 text-purple-700', Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700', Retired: 'bg-gray-100 text-gray-500',
};

export default function ClaimsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', statement: '', product: '', notes: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['claims', status],
    queryFn: () => api.get('/claims', { params: { status, limit: 50 } }).then(r => r.data),
  });

  const { data: statements } = useQuery({
    queryKey: ['statements-inuse'],
    queryFn: () => api.get('/statements', { params: { status: 'In Use', limit: 100 } }).then(r => r.data.data),
    enabled: showModal,
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/products', { params: { limit: 100 } }).then(r => r.data.data),
    enabled: showModal,
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/claims', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['claims'] }); setShowModal(false); setForm({ title: '', statement: '', product: '', notes: '' }); },
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Claims</h1>
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowModal(true)}>
            <Plus size={16} /> New Claim
          </button>
        </div>
        <div className="flex gap-3">
          <select className="input w-52" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {['Draft', 'Legal Review', 'Regulatory Review', 'Approved', 'Rejected', 'Retired'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        {isLoading ? <div className="text-gray-500">Loading...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="pb-3 font-medium text-gray-500">Title</th>
                  <th className="pb-3 font-medium text-gray-500">Product</th>
                  <th className="pb-3 font-medium text-gray-500">Status</th>
                  <th className="pb-3 font-medium text-gray-500">Created By</th>
                  <th className="pb-3 font-medium text-gray-500">Updated</th>
                </tr>
              </thead>
              <tbody>
                {data?.data?.map((c: any) => (
                  <tr key={c._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 pr-4">
                      <Link href={`/claims/${c._id}`} className="font-medium text-blue-600 hover:underline">{c.title}</Link>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{c.statement?.text}</p>
                    </td>
                    <td className="py-3 pr-4 text-gray-700">{c.product?.name || '—'}</td>
                    <td className="py-3 pr-4">
                      <span className={`badge ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                    </td>
                    <td className="py-3 pr-4 text-gray-500">{c.createdBy?.name}</td>
                    <td className="py-3 text-gray-500">{new Date(c.updatedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data?.data?.length === 0 && <p className="text-gray-500 text-center py-8">No claims found.</p>}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">New Claim</h2>
            <div className="space-y-3">
              <div>
                <label className="label">Title *</label>
                <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="label">Statement (In Use) *</label>
                <select className="input" value={form.statement} onChange={e => setForm({ ...form, statement: e.target.value })}>
                  <option value="">Select statement...</option>
                  {statements?.map((s: any) => <option key={s._id} value={s._id}>{s.text.slice(0, 80)}...</option>)}
                </select>
              </div>
              <div>
                <label className="label">Product *</label>
                <select className="input" value={form.product} onChange={e => setForm({ ...form, product: e.target.value })}>
                  <option value="">Select product...</option>
                  {products?.map((p: any) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
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
