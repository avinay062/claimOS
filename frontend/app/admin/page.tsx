'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import { Settings, Users, AlertTriangle, Plus, Trash2, Shield } from 'lucide-react';

const ROLES = ['admin', 'brand_manager', 'legal_reviewer', 'regulatory_approver', 'read_only'];
const RISK_LEVELS = ['low', 'medium', 'high'];

export default function AdminPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'users' | 'risk'>('users');
  const [newWord, setNewWord] = useState({ word: '', riskLevel: 'high', category: '', notes: '' });

  // Users
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => api.put(`/users/${id}/role`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.put(`/users/${id}/status`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  // Risk words
  const { data: riskWords } = useQuery({
    queryKey: ['risk-words'],
    queryFn: () => api.get('/risk').then(r => r.data),
  });

  const createWordMutation = useMutation({
    mutationFn: (payload: any) => api.post('/risk', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['risk-words'] }); setNewWord({ word: '', riskLevel: 'high', category: '', notes: '' }); },
  });

  const deleteWordMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/risk/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['risk-words'] }),
  });

  const seedDefaultsMutation = useMutation({
    mutationFn: () => api.post('/risk/seed-defaults'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['risk-words'] }),
  });

  const RISK_COLORS: Record<string, string> = { low: 'bg-green-100 text-green-700', medium: 'bg-yellow-100 text-yellow-700', high: 'bg-red-100 text-red-700' };

  return (
    <AppLayout>
      <div className="space-y-5 max-w-5xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Settings size={22} /> Admin Panel</h1>
          <p className="text-sm text-gray-500 mt-1">Manage users, roles, and system configuration</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          {([['users', 'Users & Roles', Users], ['risk', 'Risk Words', AlertTriangle]] as any[]).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* Users tab */}
        {activeTab === 'users' && (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((u: any) => (
                  <tr key={u._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{u.name}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <select className="input py-1 text-xs" value={u.role}
                        onChange={e => updateRoleMutation.mutate({ id: u._id, role: e.target.value })}>
                        {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActiveMutation.mutate({ id: u._id, isActive: !u.isActive })}
                        className={`badge cursor-pointer transition-opacity hover:opacity-70 ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {u.isActive ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Risk words tab */}
        {activeTab === 'risk' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                High-risk words are automatically detected when claims are created or updated, assigning a risk rating.
              </p>
              <button className="btn-secondary text-sm" onClick={() => seedDefaultsMutation.mutate()}>
                {seedDefaultsMutation.isPending ? 'Seeding...' : 'Seed Defaults'}
              </button>
            </div>

            {/* Add new word */}
            <div className="card bg-blue-50 border border-blue-100">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Plus size={14} /> Add Risk Word</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <input className="input col-span-2" placeholder="Word or phrase..." value={newWord.word}
                  onChange={e => setNewWord({ ...newWord, word: e.target.value })} />
                <select className="input" value={newWord.riskLevel} onChange={e => setNewWord({ ...newWord, riskLevel: e.target.value })}>
                  {RISK_LEVELS.map(l => <option key={l}>{l}</option>)}
                </select>
                <input className="input" placeholder="Category (optional)" value={newWord.category}
                  onChange={e => setNewWord({ ...newWord, category: e.target.value })} />
              </div>
              <button className="btn-primary text-sm mt-3" disabled={createWordMutation.isPending || !newWord.word}
                onClick={() => createWordMutation.mutate(newWord)}>
                {createWordMutation.isPending ? 'Adding...' : 'Add Word'}
              </button>
            </div>

            {/* Word list */}
            <div className="card overflow-hidden p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Word / Phrase</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Risk</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Category</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {riskWords?.map((w: any) => (
                    <tr key={w._id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-gray-800">{w.word}</td>
                      <td className="px-4 py-2.5">
                        <span className={`badge ${RISK_COLORS[w.riskLevel]}`}>{w.riskLevel}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">{w.category || '—'}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => deleteWordMutation.mutate(w._id)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {riskWords?.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No risk words configured. Click "Seed Defaults" to add industry defaults.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
