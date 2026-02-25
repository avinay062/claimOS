'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import { ArrowLeft, Wand2, Copy, CheckCircle, XCircle, Clock, Globe } from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  proposed: 'badge-gray', in_review: 'badge-yellow',
  approved: 'badge-green', rejected: 'badge-red', withdrawn: 'badge-gray',
};

const TRANSITIONS: Record<string, Array<{ label: string; next: string; cls: string }>> = {
  proposed:   [{ label: 'Submit for Review', next: 'in_review',  cls: 'btn-primary' }],
  in_review:  [{ label: 'Approve', next: 'approved', cls: 'btn-primary' }, { label: 'Reject', next: 'rejected', cls: 'btn-danger' }],
  rejected:   [{ label: 'Return to Draft', next: 'proposed', cls: 'btn-secondary' }],
  approved:   [{ label: 'Withdraw', next: 'withdrawn', cls: 'btn-secondary' }],
  withdrawn:  [],
};

const CHANNELS = ['tv','digital','print','packaging','social_media','point_of_sale','radio','outdoor','email','influencer'];

export default function LocalAdaptationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [editing, setEditing]         = useState(false);
  const [localText, setLocalText]     = useState('');
  const [channels, setChannels]       = useState<string[]>([]);
  const [notes, setNotes]             = useState('');
  const [comment, setComment]         = useState('');
  const [showCopy, setShowCopy]       = useState(false);
  const [copyTo, setCopyTo]           = useState({ locationCode: '', locale: '' });
  const [autoTranslateMsg, setAutoTranslateMsg] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['local-adaptation', id],
    queryFn: async () => { const { data } = await api.get(`/local-adaptations/${id}`); return data.data; },
    onSuccess: (d: any) => {
      if (!editing) { setLocalText(d.localText); setChannels(d.permittedChannels || []); setNotes(d.notes || ''); }
    },
  } as any);

  const { data: locationsData } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => { const { data } = await api.get('/locations'); return data.data; },
    enabled: showCopy,
  });

  const updateMutation = useMutation({
    mutationFn: () => api.put(`/local-adaptations/${id}`, { localText, permittedChannels: channels, notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['local-adaptation', id] }); setEditing(false); },
  });

  const transitionMutation = useMutation({
    mutationFn: ({ status, comment }: any) => api.post(`/local-adaptations/${id}/transition`, { status, comment }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['local-adaptation', id] }); setComment(''); },
  });

  const autoTranslateMutation = useMutation({
    mutationFn: () => api.post(`/local-adaptations/${id}/auto-translate`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['local-adaptation', id] });
      setLocalText(res.data.data.localText);
      setAutoTranslateMsg(`✓ Populated from ${res.data.translationSource} translation in statement library`);
      setTimeout(() => setAutoTranslateMsg(''), 4000);
    },
    onError: (e: any) => setAutoTranslateMsg(`✗ ${e.response?.data?.message || 'No matching translation found'}`),
  });

  const copyMutation = useMutation({
    mutationFn: () => api.post(`/local-adaptations/${id}/copy`, copyTo),
    onSuccess: (res) => { router.push(`/local-adaptations/${res.data.data._id}`); },
  });

  const getLocales = (code: string) =>
    locationsData?.find((l: any) => l.code === code)?.languages || [];

  if (isLoading) return <AppLayout><div className="p-8 text-center text-gray-400 mt-20">Loading...</div></AppLayout>;
  if (!data) return <AppLayout><div className="p-8 text-red-500">Not found.</div></AppLayout>;

  const a = data;
  const actions = TRANSITIONS[a.status] || [];

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
          <ArrowLeft className="w-4 h-4" /> Back to Local Adaptations
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main */}
          <div className="lg:col-span-2 space-y-5">
            {/* Header card */}
            <div className="card p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className="w-4 h-4 text-blue-500" />
                    <span className="font-semibold text-gray-900">{a.locationName || a.locationCode}</span>
                    <span className="text-xs text-gray-400">({a.locale})</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    Based on: <span className="font-medium">{a.claimId?.statementId?.name}</span>
                    {a.claimId?.productId?.name && <span> / {a.claimId.productId.name}</span>}
                  </p>
                  {a.sourcedFromId && (
                    <p className="text-xs text-gray-400 mt-1">Copied from {a.sourcedFromId.locationCode} ({a.sourcedFromId.locale})</p>
                  )}
                </div>
                <span className={`badge ${STATUS_BADGE[a.status] || 'badge-gray'} flex-shrink-0`}>
                  {a.status.replace('_',' ')}
                </span>
              </div>

              {/* Localised text */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Adapted claim text</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { autoTranslateMutation.mutate(); }}
                      disabled={autoTranslateMutation.isPending || a.status === 'approved'}
                      className="btn-ghost text-xs py-1">
                      <Wand2 className="w-3.5 h-3.5" />
                      {autoTranslateMutation.isPending ? 'Looking up...' : 'Auto-translate'}
                    </button>
                    {!editing && a.status !== 'approved' && (
                      <button onClick={() => setEditing(true)} className="btn-ghost text-xs py-1">Edit</button>
                    )}
                  </div>
                </div>
                {autoTranslateMsg && (
                  <p className={`text-xs mb-2 ${autoTranslateMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
                    {autoTranslateMsg}
                  </p>
                )}
                {editing ? (
                  <textarea
                    className="input resize-none"
                    rows={4}
                    value={localText}
                    onChange={e => setLocalText(e.target.value)}
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-800 leading-relaxed">{a.localText}</div>
                )}
              </div>

              {/* Permitted channels */}
              <div className="mt-4">
                <label className="label text-xs">Permitted channels</label>
                {editing ? (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {CHANNELS.map(ch => (
                      <button key={ch} type="button"
                        onClick={() => setChannels(p => p.includes(ch) ? p.filter(c => c !== ch) : [...p, ch])}
                        className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                          channels.includes(ch) ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-500'
                        }`}>
                        {ch.replace('_',' ')}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {(a.permittedChannels || []).length === 0
                      ? <span className="text-xs text-gray-400">No channels specified</span>
                      : a.permittedChannels.map((ch: string) => (
                        <span key={ch} className="badge badge-blue text-xs">{ch.replace('_',' ')}</span>
                      ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              {(editing || a.notes) && (
                <div className="mt-4">
                  <label className="label text-xs">Notes</label>
                  {editing
                    ? <input className="input text-sm" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." />
                    : <p className="text-sm text-gray-600">{a.notes}</p>}
                </div>
              )}

              {editing && (
                <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
                  <button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="btn-primary flex-1">
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button onClick={() => { setEditing(false); setLocalText(a.localText); setChannels(a.permittedChannels || []); setNotes(a.notes || ''); }}
                    className="btn-secondary flex-1">Discard</button>
                </div>
              )}
            </div>

            {/* Copy to another country */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                  <Copy className="w-4 h-4 text-gray-400" /> Copy to Another Country
                </h3>
                <button onClick={() => setShowCopy(v => !v)} className="btn-ghost text-xs py-1">
                  {showCopy ? 'Collapse' : 'Expand'}
                </button>
              </div>
              {showCopy && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">Creates a new adaptation with the same text, pre-filled for a different country.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs">Target country</label>
                      <select className="input text-sm"
                        value={copyTo.locationCode}
                        onChange={e => {
                          const code = e.target.value;
                          const loc = locationsData?.find((l: any) => l.code === code);
                          const def = loc?.languages?.find((l: any) => l.isDefault);
                          setCopyTo({ locationCode: code, locale: def?.locale || '' });
                        }}>
                        <option value="">Select country...</option>
                        {(locationsData || []).filter((l: any) => l.code !== a.locationCode).map((l: any) => (
                          <option key={l.code} value={l.code}>{l.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label text-xs">Locale</label>
                      <select className="input text-sm" value={copyTo.locale}
                        onChange={e => setCopyTo(p => ({ ...p, locale: e.target.value }))}>
                        <option value="">Select locale...</option>
                        {getLocales(copyTo.locationCode).map((l: any) => (
                          <option key={l.locale} value={l.locale}>{l.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={() => copyMutation.mutate()}
                    disabled={copyMutation.isPending || !copyTo.locationCode || !copyTo.locale}
                    className="btn-secondary text-sm">
                    <Copy className="w-4 h-4" />
                    {copyMutation.isPending ? 'Copying...' : 'Copy & Navigate'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Actions */}
            {actions.length > 0 && (
              <div className="card p-5">
                <h3 className="font-semibold text-gray-900 mb-3 text-sm">Actions</h3>
                <textarea className="input text-sm resize-none mb-3" rows={2}
                  value={comment} onChange={e => setComment(e.target.value)}
                  placeholder="Optional comment..." />
                <div className="space-y-2">
                  {actions.map(({ label, next, cls }) => (
                    <button key={next}
                      onClick={() => transitionMutation.mutate({ status: next, comment })}
                      disabled={transitionMutation.isPending}
                      className={`${cls} w-full text-sm`}>
                      {next === 'approved' && <CheckCircle className="w-4 h-4" />}
                      {next === 'rejected' && <XCircle className="w-4 h-4" />}
                      {transitionMutation.isPending ? 'Saving...' : label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Meta */}
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">Details</h3>
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <dt className="text-gray-400">Country</dt>
                  <dd className="text-gray-800 font-medium">{a.locationName} ({a.locationCode})</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-400">Locale</dt>
                  <dd className="text-gray-800">{a.locale}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-400">Created by</dt>
                  <dd className="text-gray-800">{a.createdBy?.firstName} {a.createdBy?.lastName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-400">Created</dt>
                  <dd className="text-gray-800">{new Date(a.createdAt).toLocaleDateString()}</dd>
                </div>
              </dl>
            </div>

            {/* Workflow history */}
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" /> History
              </h3>
              {!a.workflowHistory?.length ? (
                <p className="text-xs text-gray-400">No history yet.</p>
              ) : (
                <div className="space-y-3">
                  {[...a.workflowHistory].reverse().map((e: any, i: number) => (
                    <div key={i} className="text-xs border-l-2 border-gray-100 pl-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="badge badge-gray text-xs">{e.fromStatus?.replace('_',' ') || 'created'}</span>
                        <span className="text-gray-400">→</span>
                        <span className={`badge ${STATUS_BADGE[e.toStatus] || 'badge-gray'} text-xs`}>
                          {e.toStatus?.replace('_',' ')}
                        </span>
                      </div>
                      <p className="text-gray-500 mt-1">
                        {e.performedBy?.firstName} {e.performedBy?.lastName} · {new Date(e.timestamp).toLocaleDateString()}
                      </p>
                      {e.comment && <p className="text-gray-400 italic mt-0.5">"{e.comment}"</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
