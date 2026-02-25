'use client';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import Link from 'next/link';
import api from '@/lib/api';
import { ArrowLeft, Upload } from 'lucide-react';
import { useRef } from 'react';

const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700', 'Under Review': 'bg-yellow-100 text-yellow-700',
  Approved: 'bg-green-100 text-green-700', Expired: 'bg-red-100 text-red-700',
};

const TRANSITIONS: Record<string, string[]> = {
  Draft: ['Under Review'], 'Under Review': ['Approved', 'Draft'], Approved: ['Expired'], Expired: [],
};

export default function SubstantiationDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['substantiation', id],
    queryFn: () => api.get(`/substantiations/${id}`).then(r => r.data),
  });

  const transitionMutation = useMutation({
    mutationFn: (to: string) => api.post(`/substantiations/${id}/transition`, { to }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['substantiation', id] }),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post(`/substantiations/${id}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['substantiation', id] }),
  });

  if (isLoading) return <AppLayout><div className="text-gray-500">Loading...</div></AppLayout>;
  if (!data) return <AppLayout><div>Not found</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <Link href="/substantiations" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Back to Substantiations
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{data.title}</h1>
            <p className="text-gray-500 text-sm">{data.type}</p>
          </div>
          <span className={`badge text-sm px-3 py-1 ${STATUS_COLORS[data.status]}`}>{data.status}</span>
        </div>

        {/* Workflow */}
        {TRANSITIONS[data.status]?.length > 0 && (
          <div className="card">
            <h2 className="font-semibold mb-3">Workflow Actions</h2>
            <div className="flex gap-2">
              {TRANSITIONS[data.status].map(to => (
                <button key={to} className="btn-primary" disabled={transitionMutation.isPending}
                  onClick={() => transitionMutation.mutate(to)}>→ {to}</button>
              ))}
            </div>
          </div>
        )}

        {/* Details */}
        <div className="card space-y-3">
          <h2 className="font-semibold">Details</h2>
          {data.description && <p className="text-gray-700 text-sm">{data.description}</p>}
          {data.expiryDate && <p className="text-sm text-gray-500">Expires: {new Date(data.expiryDate).toLocaleDateString()}</p>}
        </div>

        {/* File */}
        <div className="card">
          <h2 className="font-semibold mb-3">Document</h2>
          {data.file?.originalName ? (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium">{data.file.originalName}</p>
                <p className="text-xs text-gray-500">{(data.file.size / 1024).toFixed(1)} KB · {data.file.mimeType}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
              <p className="text-sm text-gray-500 mb-2">No document uploaded</p>
              <button className="btn-secondary flex items-center gap-2 mx-auto" onClick={() => fileRef.current?.click()}>
                <Upload size={14} /> Upload File
              </button>
              <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.png"
                onChange={e => { if (e.target.files?.[0]) uploadMutation.mutate(e.target.files[0]); }} />
            </div>
          )}
          {uploadMutation.isPending && <p className="text-sm text-blue-600 mt-2">Uploading...</p>}
        </div>

        {/* Linked Claims */}
        <div className="card">
          <h2 className="font-semibold mb-3">Linked Claims ({data.linkedClaims?.length ?? 0})</h2>
          {data.linkedClaims?.length > 0 ? (
            <div className="space-y-2">
              {data.linkedClaims.map((c: any) => (
                <div key={c._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium">{c.title}</p>
                  <div className="flex items-center gap-2">
                    <span className="badge bg-gray-100 text-gray-600">{c.status}</span>
                    <Link href={`/claims/${c._id}`} className="text-xs text-blue-600 hover:underline">View</Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No claims linked yet.</p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
