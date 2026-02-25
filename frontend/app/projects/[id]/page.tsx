'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import Link from 'next/link';
import {
  ArrowLeft, Plus, CheckCircle, Circle, Target, Users,
  Globe, ChevronRight, Trash2, AlertTriangle, FolderKanban,
} from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  proposed: 'badge-gray', substantiation_dev: 'badge-yellow',
  substantiation_complete: 'badge-blue', in_review: 'badge-purple',
  approved: 'badge-green', in_market: 'badge-green',
  rejected: 'badge-red', withdrawn: 'badge-gray',
};
const PROJECT_STATUS_BADGE: Record<string, string> = {
  active: 'badge-green', on_hold: 'badge-yellow', completed: 'badge-blue', cancelled: 'badge-red',
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [showAddClaims, setShowAddClaims] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [claimSearch, setClaimSearch] = useState('');
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDue, setMilestoneDue] = useState('');
  const [editStatus, setEditStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => { const { data } = await api.get(`/projects/${id}`); return data.data; },
  });

  const { data: allClaimsData } = useQuery({
    queryKey: ['claims-for-project', claimSearch],
    queryFn: async () => {
      const { data } = await api.get('/claims', { params: { limit: 50, search: claimSearch || undefined } });
      return data.data;
    },
    enabled: showAddClaims,
  });

  const addClaimsMutation = useMutation({
    mutationFn: (claimIds: string[]) => api.post(`/projects/${id}/claims`, { claimIds }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', id] }); setShowAddClaims(false); },
  });

  const removeClaimMutation = useMutation({
    mutationFn: (claimId: string) => api.delete(`/projects/${id}/claims`, { data: { claimIds: [claimId] } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', id] }),
  });

  const addMilestoneMutation = useMutation({
    mutationFn: () => api.post(`/projects/${id}/milestones`, { title: milestoneTitle, dueDate: milestoneDue || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', id] }); setShowAddMilestone(false); setMilestoneTitle(''); setMilestoneDue(''); },
  });

  const toggleMilestoneMutation = useMutation({
    mutationFn: ({ milestoneId, completed }: any) =>
      api.put(`/projects/${id}/milestones/${milestoneId}`, { completed }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', id] }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => api.put(`/projects/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', id] }); setEditStatus(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/projects/${id}`),
    onSuccess: () => router.push('/projects'),
  });

  if (isLoading) return <AppLayout><div className="p-8 text-center text-gray-400 mt-20">Loading...</div></AppLayout>;
  if (!data) return <AppLayout><div className="p-8 text-red-500">Project not found.</div></AppLayout>;

  const project = data;
  const claims: any[] = project.claimIds || [];
  const adaptations: any[] = project.localAdaptationIds || [];
  const milestones: any[] = project.milestones || [];
  const pct = project.claimsCount > 0 ? Math.round((project.approvedClaimsCount / project.claimsCount) * 100) : 0;
  const projectClaimIds = new Set(claims.map((c: any) => c._id));
  const availableClaims = allClaimsData?.filter((c: any) => !projectClaimIds.has(c._id)) || [];

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl mx-auto">
        {/* Breadcrumb */}
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
          <ArrowLeft className="w-4 h-4" /> Back to Projects
        </button>

        {/* Header */}
        <div className="card p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <FolderKanban className="w-5 h-5 text-blue-500" />
                <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              </div>
              {project.description && <p className="text-sm text-gray-500 ml-8">{project.description}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {editStatus ? (
                <div className="flex items-center gap-2">
                  <select className="input text-sm py-1.5" value={newStatus || project.status}
                    onChange={e => setNewStatus(e.target.value)}>
                    {['active','on_hold','completed','cancelled'].map(s => (
                      <option key={s} value={s}>{s.replace('_',' ')}</option>
                    ))}
                  </select>
                  <button onClick={() => updateStatusMutation.mutate(newStatus || project.status)} className="btn-primary text-xs py-1.5">Save</button>
                  <button onClick={() => setEditStatus(false)} className="btn-secondary text-xs py-1.5">Cancel</button>
                </div>
              ) : (
                <button onClick={() => { setEditStatus(true); setNewStatus(project.status); }}
                  className={`badge ${PROJECT_STATUS_BADGE[project.status] || 'badge-gray'} cursor-pointer hover:opacity-80`}>
                  {project.status.replace('_',' ')} ▾
                </button>
              )}
            </div>
          </div>

          {/* Progress + meta */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                <span>Claims progress</span>
                <span className="font-semibold">{project.approvedClaimsCount || 0} / {project.claimsCount || 0} approved ({pct}%)</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className={`h-2.5 rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              {project.targetLaunchDate && (
                <div className="flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />
                  <span className={new Date(project.targetLaunchDate) < new Date() && project.status === 'active' ? 'text-red-500 font-medium' : ''}>
                    Launch: {new Date(project.targetLaunchDate).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Team */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-6 text-xs text-gray-500">
            {project.managerId && (
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>Manager: {project.managerId.firstName} {project.managerId.lastName}</span>
              </div>
            )}
            {project.legalReviewerId && (
              <span>Legal: {project.legalReviewerId.firstName} {project.legalReviewerId.lastName}</span>
            )}
            {project.regulatoryApproverId && (
              <span>Regulatory: {project.regulatoryApproverId.firstName} {project.regulatoryApproverId.lastName}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Claims — takes 2 cols */}
          <div className="lg:col-span-2 space-y-5">
            {/* Claims section */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Claims ({claims.length})</h2>
                <button onClick={() => setShowAddClaims(true)} className="btn-ghost text-xs py-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add Claims
                </button>
              </div>

              {claims.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No claims added yet.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {claims.map((c: any) => (
                    <div key={c._id} className="flex items-center gap-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <Link href={`/claims/${c._id}`}
                          className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate block">
                          {c.statementId?.name}
                        </Link>
                        <p className="text-xs text-gray-400">{c.productId?.name}{c.productId?.brand ? ` · ${c.productId.brand}` : ''}</p>
                      </div>
                      <span className={`badge ${STATUS_BADGE[c.status] || 'badge-gray'} text-xs flex-shrink-0`}>
                        {c.status.replace(/_/g,' ')}
                      </span>
                      <button onClick={() => removeClaimMutation.mutate(c._id)}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Local Adaptations */}
            {adaptations.length > 0 && (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-gray-400" /> Local Adaptations ({adaptations.length})
                  </h2>
                  <Link href={`/local-adaptations?projectId=${id}`} className="btn-ghost text-xs py-1.5">
                    View all <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {adaptations.slice(0, 6).map((a: any) => (
                    <Link key={a._id} href={`/local-adaptations/${a._id}`}
                      className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors text-xs">
                      <span className="font-medium text-gray-800">{a.locationName || a.locationCode}</span>
                      <span className={`badge ${STATUS_BADGE[a.status] || 'badge-gray'} text-xs`}>
                        {a.status}
                      </span>
                    </Link>
                  ))}
                </div>
                {adaptations.length > 6 && (
                  <p className="text-xs text-gray-400 mt-2 text-center">+{adaptations.length - 6} more</p>
                )}
              </div>
            )}
          </div>

          {/* Right: Milestones */}
          <div>
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Milestones</h2>
                <button onClick={() => setShowAddMilestone(true)} className="btn-ghost text-xs py-1.5">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {showAddMilestone && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg space-y-2 border border-blue-100">
                  <input className="input text-sm" placeholder="Milestone title *"
                    value={milestoneTitle} onChange={e => setMilestoneTitle(e.target.value)} />
                  <input type="date" className="input text-sm" value={milestoneDue}
                    onChange={e => setMilestoneDue(e.target.value)} />
                  <div className="flex gap-2">
                    <button onClick={() => addMilestoneMutation.mutate()}
                      disabled={!milestoneTitle || addMilestoneMutation.isPending}
                      className="btn-primary text-xs py-1.5 flex-1">Add</button>
                    <button onClick={() => { setShowAddMilestone(false); setMilestoneTitle(''); }}
                      className="btn-secondary text-xs py-1.5 flex-1">Cancel</button>
                  </div>
                </div>
              )}

              {milestones.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">No milestones yet.</p>
              ) : (
                <div className="space-y-2">
                  {milestones.map((m: any) => {
                    const overdue = m.dueDate && !m.completedAt && new Date(m.dueDate) < new Date();
                    return (
                      <div key={m._id} className={`flex items-start gap-2.5 p-2.5 rounded-lg ${m.completedAt ? 'bg-green-50' : overdue ? 'bg-red-50' : 'bg-gray-50'}`}>
                        <button onClick={() => toggleMilestoneMutation.mutate({ milestoneId: m._id, completed: !m.completedAt })}
                          className="mt-0.5 flex-shrink-0">
                          {m.completedAt
                            ? <CheckCircle className="w-4 h-4 text-green-500" />
                            : <Circle className="w-4 h-4 text-gray-300" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium ${m.completedAt ? 'text-green-700 line-through' : 'text-gray-800'}`}>
                            {m.title}
                          </p>
                          {m.dueDate && (
                            <p className={`text-xs mt-0.5 ${overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                              {overdue && <AlertTriangle className="w-3 h-3 inline mr-0.5" />}
                              {new Date(m.dueDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Danger zone */}
              {['active', 'on_hold'].includes(project.status) && (
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <button onClick={() => { if (window.confirm('Delete this project? Claims will be detached.')) deleteMutation.mutate(); }}
                    className="btn-danger w-full text-xs py-1.5">
                    <Trash2 className="w-3.5 h-3.5" /> Delete Project
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Add Claims Modal */}
        {showAddClaims && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="card w-full max-w-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Claims to Project</h2>
              <input className="input mb-3" placeholder="Search by statement name..."
                value={claimSearch} onChange={e => setClaimSearch(e.target.value)} />
              <div className="max-h-72 overflow-y-auto space-y-1 mb-4">
                {availableClaims.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No available claims found.</p>
                ) : (
                  availableClaims.map((c: any) => (
                    <button key={c._id}
                      onClick={() => addClaimsMutation.mutate([c._id])}
                      disabled={addClaimsMutation.isPending}
                      className="w-full text-left flex items-center justify-between p-3 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{c.statementId?.name}</p>
                        <p className="text-xs text-gray-400">{c.productId?.name}</p>
                      </div>
                      <span className={`badge ${STATUS_BADGE[c.status] || 'badge-gray'} text-xs`}>
                        {c.status.replace(/_/g,' ')}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <button onClick={() => setShowAddClaims(false)} className="btn-secondary w-full">Done</button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
