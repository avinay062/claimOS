'use client';
import { useQuery } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LineChart, Line, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Clock, CheckCircle, AlertTriangle, Download } from 'lucide-react';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function AnalyticsPage() {
  const { data: overview, isLoading: ovLoading } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => api.get('/analytics/overview').then(r => r.data),
  });
  const { data: risk } = useQuery({
    queryKey: ['analytics-risk'],
    queryFn: () => api.get('/analytics/risk').then(r => r.data),
  });
  const { data: localization } = useQuery({
    queryKey: ['analytics-localization'],
    queryFn: () => api.get('/analytics/localization').then(r => r.data),
  });
  const { data: tasks } = useQuery({
    queryKey: ['analytics-tasks'],
    queryFn: () => api.get('/analytics/tasks').then(r => r.data),
  });
  const { data: claimsOverTime } = useQuery({
    queryKey: ['analytics-claims-time'],
    queryFn: () => api.get('/analytics/claims-over-time').then(r => r.data),
  });

  const claimStatusData = overview ? Object.entries(overview.claimsByStatus).map(([name, value]) => ({ name, value: Number(value) })) : [];
  const riskData = risk ? Object.entries(risk.byRisk).map(([name, value]) => ({ name: name || 'Unrated', value: Number(value) })) : [];
  const RISK_COLORS: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e', Unrated: '#94a3b8' };
  const taskStatusData = tasks ? Object.entries(tasks.byStatus).map(([name, value]) => ({ name, value: Number(value) })) : [];

  const handleExport = () => {
    window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/analytics/export`, '_blank');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics & Reporting</h1>
            <p className="text-sm text-gray-500 mt-1">System-wide insights and performance metrics</p>
          </div>
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={15} /> Export Claims CSV
          </button>
        </div>

        {/* KPI cards */}
        {ovLoading ? <div className="text-gray-500">Loading...</div> : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Total Claims" value={overview?.totals?.claims ?? 0} icon={<CheckCircle size={18}/>} color="blue" />
              <KpiCard label="Total Statements" value={overview?.totals?.statements ?? 0} icon={<TrendingUp size={18}/>} color="green" />
              <KpiCard label="Approval Rate" value={overview?.approvalRate != null ? `${overview.approvalRate}%` : '—'} icon={<TrendingUp size={18}/>} color="purple" />
              <KpiCard label="Avg Days to Approve" value={overview?.avgDaysToApproval ?? '—'} icon={<Clock size={18}/>} color="yellow" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Claims by status */}
              <div className="card">
                <h2 className="font-semibold mb-4">Claims by Status</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={claimStatusData} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Risk distribution */}
              <div className="card">
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-yellow-500" /> Risk Distribution
                </h2>
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width="50%" height={180}>
                    <PieChart>
                      <Pie data={riskData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false} fontSize={10}>
                        {riskData.map((entry) => (
                          <Cell key={entry.name} fill={RISK_COLORS[entry.name] || '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {riskData.map(d => (
                      <div key={d.name} className="flex items-center gap-2 text-sm">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: RISK_COLORS[d.name] || '#94a3b8' }} />
                        <span className="capitalize">{d.name}</span>
                        <span className="font-semibold ml-auto">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* High risk claims */}
            {risk?.highRiskClaims?.length > 0 && (
              <div className="card">
                <h2 className="font-semibold mb-3 flex items-center gap-2 text-red-600">
                  <AlertTriangle size={16} /> High-Risk Claims ({risk.highRiskClaims.length})
                </h2>
                <div className="space-y-2">
                  {risk.highRiskClaims.map((c: any) => (
                    <div key={c._id} className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{c.title}</p>
                        <p className="text-xs text-gray-500">{c.product?.name} · {c.status}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {c.flaggedWords?.map((fw: any) => (
                          <span key={fw.word} className="badge bg-red-100 text-red-700 text-[10px]">{fw.word}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Localization coverage */}
            {localization?.byCountry?.length > 0 && (
              <div className="card">
                <h2 className="font-semibold mb-4">Localization Coverage by Country</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 text-xs text-gray-500 font-medium">Country</th>
                        <th className="pb-2 text-xs text-gray-500 font-medium">Adaptations</th>
                        <th className="pb-2 text-xs text-gray-500 font-medium">Approved</th>
                        <th className="pb-2 text-xs text-gray-500 font-medium">Coverage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {localization.byCountry.slice(0, 15).map((c: any) => (
                        <tr key={c.locationCode} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-2 font-medium">{c.locationCode}</td>
                          <td className="py-2">{c.total}</td>
                          <td className="py-2">
                            <span className="badge bg-green-100 text-green-700">{c.approved}</span>
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-100 rounded-full h-1.5 w-24">
                                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(c.coverage, 100)}%` }} />
                              </div>
                              <span className="text-xs text-gray-500">{c.coverage}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Task performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card">
                <h2 className="font-semibold mb-4">Workflow Task Status</h2>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={taskStatusData}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card space-y-4">
                <h2 className="font-semibold">Task Performance</h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="text-sm text-gray-600">Completed this month</span>
                    <span className="font-bold text-green-700 text-lg">{tasks?.completedThisMonth ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <span className="text-sm text-gray-600">Currently overdue</span>
                    <span className="font-bold text-red-700 text-lg">{tasks?.byStatus?.overdue ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm text-gray-600">Avg days to complete</span>
                    <span className="font-bold text-blue-700 text-lg">{tasks?.avgCompletionDays ?? '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function KpiCard({ label, value, icon, color }: { label: string; value: any; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-green-50 text-green-700 border-green-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  };
  return (
    <div className={`card border ${colorMap[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium opacity-70">{label}</p>
        <div className="opacity-60">{icon}</div>
      </div>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}
