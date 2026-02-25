'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import { Plus, Globe, ChevronRight, Wand2 } from 'lucide-react';
import Link from 'next/link';

const STATUS_BADGE: Record<string, string> = {
  proposed: 'badge-gray', in_review: 'badge-yellow',
  approved: 'badge-green', rejected: 'badge-red', withdrawn: 'badge-gray',
};

const CHANNELS = ['tv','digital','print','packaging','social_media','point_of_sale','radio','outdoor','email','influencer'];

export default function LocalAdaptationsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter]     = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [showCreate, setShowCreate]         = useState(false);
  const [showBulk, setShowBulk]             = useState(false);
  const [error, setError]                   = useState('');

  // Single create form
  const [form, setForm] = useState({
    claimId: '', locationCode: '', locale: '', localText: '',
    permittedChannels: [] as string[], notes: '',
  });

  // Bulk create — one claim × many locations
  const [bulkClaimId, setBulkClaimId] = useState('');
  const [bulkRows, setBulkRows] = useState([{ locationCode: '', locale: '', localText: '' }]);

  const { data, isLoading } = useQuery({
    queryKey: ['local-adaptations', statusFilter, locationFilter],
    queryFn: async () => {
      const params: any = { limit: 60 };
      if (statusFilter)  params.status       = statusFilter;
      if (locationFilter) params.locationCode = locationFilter;
      const { data } = await api.get('/local-adaptations', { params });
      return data;
    },
  });

  const { data: locationsData } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => { const { data } = await api.get('/locations'); return data.data; },
  });

  const { data: claimsData } = useQuery({
    queryKey: ['claims-approved'],
    queryFn: async () => {
      const { data } = await api.get('/claims', { params: { status: 'approved', limit: 100 } });
      return data.data;
    },
    enabled: showCreate || showBulk,
  });

  // Auto-populate locale when location changes
  useEffect(() => {
    if (!form.locationCode || !locationsData) return;
    const loc = locationsData.find((l: any) => l.code === form.locationCode);
    const defaultLang = loc?.languages?.find((l: any) => l.isDefault);
    if (defaultLang) setForm(p => ({ ...p, locale: defaultLang.locale }));
  }, [form.locationCode, locationsData]);

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/local-adaptations', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['local-adaptations'] }); setShowCreate(false); resetForm(); },
    onError: (e: any) => setError(e.response?.data?.message || 'Failed to create'),
  });

  const bulkMutation = useMutation({
    mutationFn: () => api.post('/local-adaptations/bulk-create', {
      claimId: bulkClaimId,
      locations: bulkRows.filter(r => r.locationCode && r.locale && r.localText),
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['local-adaptations'] });
      setShowBulk(false);
      setBulkRows([{ locationCode: '', locale: '', localText: '' }]);
      const r = res.data.results;
      alert(`Done! Created: ${r.created}, Skipped: ${r.skipped}, Failed: ${r.failed}`);
    },
    onError: (e: any) => setError(e.response?.data?.message || 'Bulk create failed'),
  });

  const resetForm = () => setForm({ claimId: '', locationCode: '', locale: '', localText: '', permittedChannels: [], notes: '' });

  const toggleChannel = (ch: string) =>
    setForm(p => ({
      ...p,
      permittedChannels: p.permittedChannels.includes(ch)
        ? p.permittedChannels.filter(c => c !== ch)
        : [...p.permittedChannels, ch],
    }));

  const getLocalesForCode = (code: string) =>
    locationsData?.find((l: any) => l.code === code)?.languages || [];

  const adaptations = data?.data || [];
  const uniqueCountries = [...new Set(adaptations.map((a: any) => a.locationCode))].sort();

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Local Adaptations</h1>
            <p className="text-sm text-gray-500 mt-1">{data?.pagination?.total ?? '—'} country-level variants</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowBulk(true); setError(''); }} className="btn-secondary">
              <Wand2 className="w-4 h-4" /> Bulk Create
            </button>
            <button onClick={() => { setShowCreate(true); setError(''); }} className="btn-primary">
              <Plus className="w-4 h-4" /> New Adaptation
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-4 mb-5 flex flex-wrap gap-3">
          <select className="input text-sm w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {['proposed','in_review','approved','rejected','withdrawn'].map(s => (
              <option key={s} value={s}>{s.replace('_',' ')}</option>
            ))}
          </select>
          <select className="input text-sm w-44" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
            <option value="">All countries</option>
            {(locationsData || []).map((l: any) => (
              <option key={l.code} value={l.code}>{l.name} ({l.code})</option>
            ))}
          </select>
        </div>

        {/* Create single modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">New Local Adaptation</h2>
              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
              <div className="space-y-4">
                <div>
                  <label className="label">Claim (approved) <span className="text-red-500">*</span></label>
                  <select className="input" value={form.claimId} onChange={e => setForm(p => ({ ...p, claimId: e.target.value }))}>
                    <option value="">Select a claim...</option>
                    {claimsData?.map((c: any) => (
                      <option key={c._id} value={c._id}>{c.statementId?.name} / {c.productId?.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Country <span className="text-red-500">*</span></label>
                    <select className="input" value={form.locationCode} onChange={e => setForm(p => ({ ...p, locationCode: e.target.value }))}>
                      <option value="">Select country...</option>
                      {(locationsData || []).map((l: any) => (
                        <option key={l.code} value={l.code}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Locale <span className="text-red-500">*</span></label>
                    <select className="input" value={form.locale} onChange={e => setForm(p => ({ ...p, locale: e.target.value }))}>
                      <option value="">Select locale...</option>
                      {getLocalesForCode(form.locationCode).map((l: any) => (
                        <option key={l.locale} value={l.locale}>{l.label} ({l.locale})</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Adapted claim text <span className="text-red-500">*</span></label>
                  <textarea className="input resize-none" rows={3}
                    value={form.localText} onChange={e => setForm(p => ({ ...p, localText: e.target.value }))}
                    placeholder="Translated or locally adapted claim text..." />
                </div>
                <div>
                  <label className="label">Permitted channels</label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {CHANNELS.map(ch => (
                      <button key={ch} type="button"
                        onClick={() => toggleChannel(ch)}
                        className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                          form.permittedChannels.includes(ch)
                            ? 'bg-blue-100 border-blue-300 text-blue-700'
                            : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}>
                        {ch.replace('_',' ')}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Notes</label>
                  <input className="input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional note..." />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => { setError(''); createMutation.mutate(form); }}
                  disabled={createMutation.isPending || !form.claimId || !form.locationCode || !form.locale || !form.localText}
                  className="btn-primary flex-1">
                  {createMutation.isPending ? 'Creating...' : 'Create Adaptation'}
                </button>
                <button onClick={() => { setShowCreate(false); resetForm(); setError(''); }} className="btn-secondary flex-1">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk create modal */}
        {showBulk && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="card w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Bulk Create Adaptations</h2>
              <p className="text-sm text-gray-500 mb-4">Select one claim and add multiple country rows.</p>
              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
              <div className="mb-4">
                <label className="label">Base claim</label>
                <select className="input" value={bulkClaimId} onChange={e => setBulkClaimId(e.target.value)}>
                  <option value="">Select a claim...</option>
                  {claimsData?.map((c: any) => (
                    <option key={c._id} value={c._id}>{c.statementId?.name} / {c.productId?.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 mb-3">
                {bulkRows.map((row, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2 items-start">
                    <select className="input text-xs" value={row.locationCode}
                      onChange={e => {
                        const updated = [...bulkRows];
                        updated[i].locationCode = e.target.value;
                        // auto locale
                        const loc = locationsData?.find((l: any) => l.code === e.target.value);
                        updated[i].locale = loc?.languages?.find((l: any) => l.isDefault)?.locale || '';
                        setBulkRows(updated);
                      }}>
                      <option value="">Country...</option>
                      {(locationsData || []).map((l: any) => <option key={l.code} value={l.code}>{l.name}</option>)}
                    </select>
                    <select className="input text-xs" value={row.locale}
                      onChange={e => { const u = [...bulkRows]; u[i].locale = e.target.value; setBulkRows(u); }}>
                      <option value="">Locale...</option>
                      {getLocalesForCode(row.locationCode).map((l: any) => (
                        <option key={l.locale} value={l.locale}>{l.label}</option>
                      ))}
                    </select>
                    <input className="input text-xs" placeholder="Adapted text..."
                      value={row.localText}
                      onChange={e => { const u = [...bulkRows]; u[i].localText = e.target.value; setBulkRows(u); }} />
                  </div>
                ))}
              </div>
              <button onClick={() => setBulkRows(r => [...r, { locationCode: '', locale: '', localText: '' }])}
                className="btn-ghost text-xs py-1.5 mb-4">
                <Plus className="w-3.5 h-3.5" /> Add row
              </button>
              <div className="flex gap-3">
                <button onClick={() => bulkMutation.mutate()}
                  disabled={bulkMutation.isPending || !bulkClaimId || !bulkRows.some(r => r.localText)}
                  className="btn-primary flex-1">
                  {bulkMutation.isPending ? 'Creating...' : `Create ${bulkRows.filter(r => r.localText).length} Adaptations`}
                </button>
                <button onClick={() => { setShowBulk(false); setBulkRows([{ locationCode: '', locale: '', localText: '' }]); setError(''); }}
                  className="btn-secondary flex-1">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : adaptations.length === 0 ? (
          <div className="card p-12 text-center">
            <Globe className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 mb-4">No local adaptations yet.</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary mx-auto">
              <Plus className="w-4 h-4" /> Create first adaptation
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Claim</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-32">Country</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">Locale</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-28">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">Channels</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {adaptations.map((a: any) => (
                  <tr key={a._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 truncate max-w-xs">{a.claimId?.statementId?.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5 truncate">{a.localText}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-800">{a.locationName || a.locationCode}</span>
                      <span className="ml-1 text-xs text-gray-400">({a.locationCode})</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{a.locale}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${STATUS_BADGE[a.status] || 'badge-gray'}`}>
                        {a.status.replace('_',' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {a.permittedChannels?.length > 0 ? `${a.permittedChannels.length} ch.` : '—'}
                    </td>
                    <td className="px-2 py-3">
                      <Link href={`/local-adaptations/${a._id}`}>
                        <ChevronRight className="w-4 h-4 text-gray-400 hover:text-gray-700" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
