'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import Link from 'next/link';
import api from '@/lib/api';
import { Plus, Copy, Globe, Package } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  in_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  published: 'bg-blue-100 text-blue-700',
  withdrawn: 'bg-red-100 text-red-700',
};

const LEVELS = ['primary', 'secondary', 'tertiary'];

export default function PackCopyPage() {
  const qc = useQueryClient();
  const [isGlobal, setIsGlobal] = useState('true');
  const [status, setStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', product: '', packagingLevel: 'primary', isGlobal: true, notes: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['pack-copies', isGlobal, status],
    queryFn: () => api.get('/pack-copy', { params: { isGlobal, status, limit: 50 } }).then(r => r.data),
  });

  const { data: products } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => api.get('/products', { params: { limit: 100 } }).then(r => r.data.data),
    enabled: showModal,
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/pack-copy', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pack-copies'] }); setShowModal(false); },
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Copy size={22} className="text-blue-600" /> Pack Copy
            </h1>
            <p className="text-sm text-gray-500 mt-1">Packaging label content — global masters and local copies</p>
          </div>
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowModal(true)}>
            <Plus size={16} /> New Pack Copy
          </button>
        </div>

        <div className="flex gap-3">
          <select className="input w-40" value={isGlobal} onChange={e => setIsGlobal(e.target.value)}>
            <option value="">All</option>
            <option value="true">Global Masters</option>
            <option value="false">Local Copies</option>
          </select>
          <select className="input w-40" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {['draft', 'in_review', 'approved', 'published', 'withdrawn'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        {isLoading ? <div className="text-gray-500 text-sm">Loading...</div> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.data?.map((pc: any) => (
              <Link key={pc._id} href={`/pack-copy/${pc._id}`}
                className="card hover:shadow-md transition-shadow cursor-pointer group">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">{pc.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{pc.product?.name}</p>
                  </div>
                  <span className={`badge shrink-0 ${STATUS_COLORS[pc.status]}`}>{pc.status}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {pc.isGlobal ? (
                    <span className="flex items-center gap-1 text-blue-600 font-medium"><Globe size={11}/> Global Master</span>
                  ) : (
                    <span className="flex items-center gap-1"><Package size={11}/> {pc.locationCode} · {pc.locale}</span>
                  )}
                  <span className="capitalize">{pc.packagingLevel}</span>
                  <span>{pc.elements?.length ?? 0} elements</span>
                </div>
              </Link>
            ))}
            {data?.data?.length === 0 && (
              <div className="col-span-3 text-center py-12 text-gray-400">
                <Copy size={32} className="mx-auto mb-2 opacity-30" />
                <p>No pack copies found. Create a global master to get started.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">New Pack Copy</h2>
            <div className="space-y-3">
              <div>
                <label className="label">Name *</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Premium Moisturiser — Primary" />
              </div>
              <div>
                <label className="label">Product *</label>
                <select className="input" value={form.product} onChange={e => setForm({ ...form, product: e.target.value })}>
                  <option value="">Select product...</option>
                  {products?.map((p: any) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Packaging Level *</label>
                <select className="input" value={form.packagingLevel} onChange={e => setForm({ ...form, packagingLevel: e.target.value })}>
                  {LEVELS.map(l => <option key={l} className="capitalize">{l}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <input type="checkbox" id="isGlobal" checked={form.isGlobal}
                  onChange={e => setForm({ ...form, isGlobal: e.target.checked })} className="w-4 h-4" />
                <label htmlFor="isGlobal" className="text-sm font-medium cursor-pointer">
                  Global Master Template
                  <p className="text-xs text-gray-400 font-normal">Global masters are used to generate country-specific local copies</p>
                </label>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-primary" disabled={createMutation.isPending || !form.name || !form.product}
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
