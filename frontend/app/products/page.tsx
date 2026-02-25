'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import { Plus } from 'lucide-react';

export default function ProductsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', sku: '', category: '', description: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/products').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/products', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setShowModal(false); setForm({ name: '', sku: '', category: '', description: '' }); },
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Products</h1>
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowModal(true)}>
            <Plus size={16} /> New Product
          </button>
        </div>
        {isLoading ? <div className="text-gray-500">Loading...</div> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.data?.map((p: any) => (
              <div key={p._id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{p.name}</h3>
                    {p.sku && <p className="text-xs text-gray-500 mt-0.5">SKU: {p.sku}</p>}
                    {p.category && <p className="text-xs text-gray-400">{p.category}</p>}
                  </div>
                  <span className={`badge ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {p.description && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{p.description}</p>}
              </div>
            ))}
            {data?.data?.length === 0 && <p className="text-gray-500 col-span-3 text-center py-8">No products yet.</p>}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">New Product</h2>
            <div className="space-y-3">
              <div>
                <label className="label">Name *</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">SKU</label>
                <input className="input" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div>
                <label className="label">Category</label>
                <input className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
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
