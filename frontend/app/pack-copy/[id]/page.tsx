'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import Link from 'next/link';
import api from '@/lib/api';
import { ArrowLeft, Plus, Trash2, Globe, ChevronDown, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const PANELS = ['front', 'back', 'left', 'right', 'top', 'bottom', 'inner'];
const ELEMENT_TYPES = ['claim', 'text', 'legal', 'ingredient', 'warning'];
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700', in_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700', published: 'bg-blue-100 text-blue-700', withdrawn: 'bg-red-100 text-red-700',
};
const TRANSITIONS: Record<string, string[]> = {
  draft: ['in_review'], in_review: ['approved', 'draft'], approved: ['published', 'withdrawn'], published: ['withdrawn'], withdrawn: [],
};

export default function PackCopyDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [showAddEl, setShowAddEl] = useState(false);
  const [showGenLocal, setShowGenLocal] = useState(false);
  const [elForm, setElForm] = useState({ panel: 'front', elementType: 'claim', claimId: '', freeText: '', specialInstructions: '', isRequired: false });
  const [localForm, setLocalForm] = useState({ locationCode: '', locale: '', name: '' });
  const [activePanel, setActivePanel] = useState('front');

  const { data: pc, isLoading } = useQuery({
    queryKey: ['pack-copy', id],
    queryFn: () => api.get(`/pack-copy/${id}`).then(r => r.data),
  });
  const { data: localCopies } = useQuery({
    queryKey: ['pack-copy-locals', id],
    queryFn: () => api.get(`/pack-copy/${id}/local-copies`).then(r => r.data),
    enabled: !!pc?.isGlobal,
  });
  const { data: approvedClaims } = useQuery({
    queryKey: ['claims-approved'],
    queryFn: () => api.get('/claims', { params: { status: 'Approved', limit: 100 } }).then(r => r.data.data),
    enabled: showAddEl,
  });

  const addElementMutation = useMutation({
    mutationFn: (payload: any) => api.post(`/pack-copy/${id}/elements`, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pack-copy', id] }); setShowAddEl(false); setElForm({ panel: 'front', elementType: 'claim', claimId: '', freeText: '', specialInstructions: '', isRequired: false }); },
  });
  const removeElementMutation = useMutation({
    mutationFn: (elId: string) => api.delete(`/pack-copy/${id}/elements/${elId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pack-copy', id] }),
  });
  const transitionMutation = useMutation({
    mutationFn: ({ to, comment }: any) => api.post(`/pack-copy/${id}/transition`, { to, comment }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pack-copy', id] }),
  });
  const genLocalMutation = useMutation({
    mutationFn: (payload: any) => api.post(`/pack-copy/${id}/generate-local`, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pack-copy-locals', id] }); setShowGenLocal(false); },
  });
  const checkCompletenessMutation = useMutation({
    mutationFn: (locales: string[]) => api.post(`/pack-copy/${id}/check-completeness`, { locales }),
  });

  if (isLoading) return <AppLayout><div className="text-gray-500">Loading...</div></AppLayout>;
  if (!pc) return <AppLayout><div>Pack copy not found.</div></AppLayout>;

  const panelElements = pc.elements?.filter((el: any) => el.panel === activePanel) || [];

  return (
    <AppLayout>
      <div className="space-y-5 max-w-5xl">
        <Link href="/pack-copy" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={15} /> Back to Pack Copy
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {pc.isGlobal && <span className="badge bg-blue-100 text-blue-700 flex items-center gap-1"><Globe size={10}/> Global Master</span>}
              {!pc.isGlobal && <span className="badge bg-gray-100 text-gray-600">{pc.locationCode} · {pc.locale}</span>}
              <span className={`badge ${STATUS_COLORS[pc.status]}`}>{pc.status}</span>
            </div>
            <h1 className="text-2xl font-bold">{pc.name}</h1>
            <p className="text-sm text-gray-500 mt-1">{pc.product?.name} · {pc.packagingLevel} packaging</p>
          </div>
          {pc.isGlobal && (
            <button className="btn-secondary flex items-center gap-2 text-sm" onClick={() => setShowGenLocal(true)}>
              <Globe size={14} /> Generate Local Copy
            </button>
          )}
        </div>

        {/* Workflow Actions */}
        {TRANSITIONS[pc.status]?.length > 0 && (
          <div className="card flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600">Move to:</span>
            {TRANSITIONS[pc.status].map(to => (
              <button key={to} className={to === 'withdrawn' ? 'btn-danger text-sm' : 'btn-primary text-sm'}
                disabled={transitionMutation.isPending}
                onClick={() => transitionMutation.mutate({ to })}>
                {to.replace('_', ' ')}
              </button>
            ))}
          </div>
        )}

        {/* Panel Viewer */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Pack Elements</h2>
            <button className="btn-primary text-sm flex items-center gap-1" onClick={() => setShowAddEl(true)}>
              <Plus size={14} /> Add Element
            </button>
          </div>

          {/* Panel tabs */}
          <div className="flex gap-1 mb-4 flex-wrap">
            {pc.panels?.map((panel: string) => (
              <button key={panel} onClick={() => setActivePanel(panel)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${activePanel === panel ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {panel} ({pc.elements?.filter((e: any) => e.panel === panel).length ?? 0})
              </button>
            ))}
          </div>

          {/* Elements for active panel */}
          {panelElements.length === 0 ? (
            <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
              <p className="text-sm">No elements on {activePanel} panel</p>
              <button className="text-blue-600 text-sm mt-1 hover:underline" onClick={() => { setElForm(f => ({ ...f, panel: activePanel })); setShowAddEl(true); }}>Add first element</button>
            </div>
          ) : (
            <div className="space-y-2">
              {panelElements.map((el: any, i: number) => (
                <div key={el._id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-xs text-gray-400 font-mono w-5 mt-0.5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="badge bg-gray-200 text-gray-600 text-[10px] capitalize">{el.elementType}</span>
                      {el.isRequired && <span className="badge bg-red-100 text-red-600 text-[10px]">Required</span>}
                      {el.missingLocalization && <AlertTriangle size={12} className="text-yellow-500" />}
                    </div>
                    {el.elementType === 'claim' ? (
                      <p className="text-sm text-gray-700">{el.claimId?.title || <span className="text-gray-400 italic">Claim deleted</span>}</p>
                    ) : (
                      <p className="text-sm text-gray-700">{el.freeText || <span className="text-gray-400 italic">No text</span>}</p>
                    )}
                    {el.specialInstructions && (
                      <p className="text-xs text-blue-600 mt-1">ℹ {el.specialInstructions}</p>
                    )}
                  </div>
                  <button onClick={() => removeElementMutation.mutate(el._id)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1 shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Local copies (global only) */}
        {pc.isGlobal && (
          <div className="card">
            <h2 className="font-semibold mb-3">Local Copies ({localCopies?.total ?? 0})</h2>
            {localCopies?.data?.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {localCopies.data.map((lc: any) => (
                  <Link key={lc._id} href={`/pack-copy/${lc._id}`}
                    className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/30 transition-all">
                    <p className="text-sm font-medium">{lc.locationCode} · {lc.locale}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`badge text-[10px] ${STATUS_COLORS[lc.status]}`}>{lc.status}</span>
                      <span className="text-xs text-gray-400">{lc.elements?.length ?? 0} el.</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No local copies yet. Generate one to get started.</p>
            )}
          </div>
        )}

        {/* Status history */}
        {pc.statusHistory?.length > 0 && (
          <div className="card">
            <h2 className="font-semibold mb-3">Status History</h2>
            <div className="space-y-1.5">
              {pc.statusHistory.map((h: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="capitalize">{h.from}</span>
                  <span className="text-gray-400">→</span>
                  <span className="font-medium capitalize">{h.to}</span>
                  <span className="text-gray-400 text-xs">by {h.by?.name} · {new Date(h.at).toLocaleString()}</span>
                  {h.comment && <span className="text-gray-500 italic text-xs">"{h.comment}"</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Element Modal */}
      {showAddEl && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Add Pack Element</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Panel *</label>
                  <select className="input" value={elForm.panel} onChange={e => setElForm({ ...elForm, panel: e.target.value })}>
                    {pc.panels?.map((p: string) => <option key={p} className="capitalize">{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Element Type *</label>
                  <select className="input" value={elForm.elementType} onChange={e => setElForm({ ...elForm, elementType: e.target.value })}>
                    {ELEMENT_TYPES.map(t => <option key={t} className="capitalize">{t}</option>)}
                  </select>
                </div>
              </div>
              {elForm.elementType === 'claim' ? (
                <div>
                  <label className="label">Approved Claim *</label>
                  <select className="input" value={elForm.claimId} onChange={e => setElForm({ ...elForm, claimId: e.target.value })}>
                    <option value="">Select approved claim...</option>
                    {approvedClaims?.map((c: any) => <option key={c._id} value={c._id}>{c.title} ({c.product?.name})</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="label">Text *</label>
                  <textarea className="input" rows={2} value={elForm.freeText} onChange={e => setElForm({ ...elForm, freeText: e.target.value })} />
                </div>
              )}
              <div>
                <label className="label">Special Instructions</label>
                <input className="input" value={elForm.specialInstructions} onChange={e => setElForm({ ...elForm, specialInstructions: e.target.value })} placeholder="e.g. Must appear in red text, min 8pt" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={elForm.isRequired} onChange={e => setElForm({ ...elForm, isRequired: e.target.checked })} className="w-4 h-4" />
                <span className="text-sm">Required element (block publish if missing)</span>
              </label>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button className="btn-secondary" onClick={() => setShowAddEl(false)}>Cancel</button>
              <button className="btn-primary" disabled={addElementMutation.isPending}
                onClick={() => addElementMutation.mutate(elForm)}>
                {addElementMutation.isPending ? 'Adding...' : 'Add Element'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Local Copy Modal */}
      {showGenLocal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-1">Generate Local Copy</h2>
            <p className="text-sm text-gray-500 mb-4">Creates a copy of this global master for a specific country and locale.</p>
            <div className="space-y-3">
              <div>
                <label className="label">Country Code * (ISO 3166-1)</label>
                <input className="input uppercase" maxLength={2} value={localForm.locationCode}
                  onChange={e => setLocalForm({ ...localForm, locationCode: e.target.value.toUpperCase() })}
                  placeholder="e.g. FR, DE, JP" />
              </div>
              <div>
                <label className="label">Locale * (BCP 47)</label>
                <input className="input" value={localForm.locale}
                  onChange={e => setLocalForm({ ...localForm, locale: e.target.value })}
                  placeholder="e.g. fr-FR, de-DE, ja-JP" />
              </div>
              <div>
                <label className="label">Name (optional)</label>
                <input className="input" value={localForm.name}
                  onChange={e => setLocalForm({ ...localForm, name: e.target.value })}
                  placeholder={`${pc.name} — ${localForm.locationCode || 'XX'}`} />
              </div>
            </div>
            {genLocalMutation.isError && (
              <p className="text-sm text-red-600 mt-2">{(genLocalMutation.error as any)?.response?.data?.message || 'Error generating local copy'}</p>
            )}
            <div className="flex gap-3 mt-5 justify-end">
              <button className="btn-secondary" onClick={() => setShowGenLocal(false)}>Cancel</button>
              <button className="btn-primary" disabled={genLocalMutation.isPending || !localForm.locationCode || !localForm.locale}
                onClick={() => genLocalMutation.mutate(localForm)}>
                {genLocalMutation.isPending ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
