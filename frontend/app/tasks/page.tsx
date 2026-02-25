'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-50 text-blue-700',
  high: 'bg-red-50 text-red-700',
};

export default function TasksPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', status],
    queryFn: () => api.get('/tasks', { params: { status, limit: 50 } }).then(r => r.data),
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => api.put(`/tasks/${id}/start`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => api.put(`/tasks/${id}/complete`, { note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">My Tasks</h1>
        </div>
        <div className="flex gap-3">
          <select className="input w-44" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {['pending', 'in_progress', 'overdue', 'completed'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        {isLoading ? <div className="text-gray-500">Loading...</div> : (
          <div className="space-y-3">
            {data?.data?.map((t: any) => (
              <div key={t._id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{t.title}</p>
                    {t.description && <p className="text-sm text-gray-500 mt-0.5">{t.description}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`badge ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
                      {t.dueDate && (
                        <span className="text-xs text-gray-400">
                          Due: {new Date(t.dueDate).toLocaleDateString()}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">Assigned to: {t.assignedTo?.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`badge ${STATUS_COLORS[t.status]}`}>{t.status.replace('_', ' ')}</span>
                    {t.status === 'pending' && (
                      <button className="btn-secondary text-xs py-1" onClick={() => startMutation.mutate(t._id)}>Start</button>
                    )}
                    {t.status === 'in_progress' && (
                      <button className="btn-primary text-xs py-1"
                        onClick={() => completeMutation.mutate({ id: t._id, note: '' })}>Complete</button>
                    )}
                  </div>
                </div>
                {t.completionNote && (
                  <p className="text-xs text-gray-500 mt-2 italic">Note: {t.completionNote}</p>
                )}
              </div>
            ))}
            {data?.data?.length === 0 && <p className="text-gray-500 text-center py-8">No tasks found.</p>}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
