'use client';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import Link from 'next/link';
import api from '@/lib/api';
import { ArrowLeft } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700', 'Legal Review': 'bg-yellow-100 text-yellow-700',
  'Regulatory Review': 'bg-purple-100 text-purple-700', Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700', Retired: 'bg-gray-100 text-gray-500',
};

const TRANSITIONS: Record<string, string[]> = {
  Draft: ['Legal Review'],
  'Legal Review': ['Regulatory Review', 'Rejected'],
  'Regulatory Review': ['Approved', 'Rejected'],
  Approved: ['Retired'],
  Rejected: ['Draft'],
  Retired: [],
};

export default function ClaimDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();

  const { data: claim, isLoading } = useQuery({
    queryKey: ['claim', id],
    queryFn: () => api.get(`/claims/${id}`).then(r => r.data),
  });

  const { data: substantiations } = useQuery({
    queryKey: ['claim-subs', id],
    queryFn: () => api.get(`/substantiations/by-claim/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const transitionMutation = useMutation({
    mutationFn: ({ to, comment }: { to: string; comment?: string }) =>
      api.post(`/claims/${id}/transition`, { to, comment }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['claim', id] }),
  });

  if (isLoading) return <AppLayout><div className="text-gray-500">Loading...</div></AppLayout>;
  if (!claim) return <AppLayout><div>Not found</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <Link href="/claims" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Back to Claims
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{claim.title}</h1>
            <p className="text-gray-500 text-sm mt-1">
              {claim.product?.name} · Created by {claim.createdBy?.name}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`badge text-sm px-3 py-1 ${STATUS_COLORS[claim.status]}`}>{claim.status}</span>
          </div>
        </div>

        {/* Workflow Actions */}
        {TRANSITIONS[claim.status]?.length > 0 && (
          <div className="card">
            <h2 className="font-semibold mb-3">Workflow Actions</h2>
            <div className="flex flex-wrap gap-2">
              {TRANSITIONS[claim.status].map(to => (
                <button key={to}
                  className={to === 'Rejected' ? 'btn-danger' : 'btn-primary'}
                  disabled={transitionMutation.isPending}
                  onClick={() => transitionMutation.mutate({ to })}>
                  {to === 'Approved' ? '✓ Approve' : to === 'Rejected' ? '✗ Reject' : `→ ${to}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Statement */}
        <div className="card">
          <h2 className="font-semibold mb-2">Statement</h2>
          <p className="text-gray-700">{claim.statement?.text}</p>
          <p className="text-sm text-gray-400 mt-1">Category: {claim.statement?.category}</p>
        </div>

        {/* Substantiations */}
        <div className="card">
          <h2 className="font-semibold mb-3">Linked Substantiations</h2>
          {substantiations?.length > 0 ? (
            <div className="space-y-2">
              {substantiations.map((s: any) => (
                <div key={s._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-gray-500">{s.type} · {s.status}</p>
                  </div>
                  <Link href={`/substantiations/${s._id}`} className="text-xs text-blue-600 hover:underline">View</Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No substantiations linked yet.</p>
          )}
        </div>

        {/* E-Signatures */}
        {claim.eSignatures?.length > 0 && (
          <div className="card">
            <h2 className="font-semibold mb-3">E-Signatures</h2>
            <div className="space-y-2">
              {claim.eSignatures.map((sig: any, i: number) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  <span className="font-medium">{sig.user?.name}</span>
                  <span className="text-gray-500">({sig.role})</span>
                  <span className="text-gray-400 text-xs">{new Date(sig.signedAt).toLocaleString()}</span>
                  {sig.comment && <span className="text-gray-500 italic">"{sig.comment}"</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status History */}
        {claim.statusHistory?.length > 0 && (
          <div className="card">
            <h2 className="font-semibold mb-3">Status History</h2>
            <div className="space-y-2">
              {claim.statusHistory.map((h: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                  <span>{h.from}</span>
                  <span className="text-gray-400">→</span>
                  <span className="font-medium">{h.to}</span>
                  <span className="text-gray-400">by {h.by?.name}</span>
                  <span className="text-xs text-gray-400">{new Date(h.at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
