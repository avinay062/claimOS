'use client';
import { useQuery } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import Link from 'next/link';
import api from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertTriangle, Clock, CheckCircle, FileText, Globe, Copy } from 'lucide-react';

const STATUS_COLORS_MAP: Record<string, string> = {
  Draft: '#94a3b8', 'In Review': '#f59e0b', 'In Use': '#22c55e', Retired: '#6b7280',
  'Legal Review': '#f59e0b', 'Regulatory Review': '#8b5cf6', Approved: '#22c55e',
  Rejected: '#ef4444', 'Under Review': '#f59e0b', Expired: '#6b7280',
};

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then(r => r.data),
  });
  const { data: analytics } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => api.get('/analytics/overview').then(r => r.data),
  });
  const { data: riskData } = useQuery({
    queryKey: ['analytics-risk'],
    queryFn: () => api.get('/analytics/risk').then(r => r.data),
  });

  const claimsData = data ? Object.entries(data.claimsByStatus).map(([name, value]) => ({ name, value })) : [];
  const statementsData = data ? Object.entries(data.statementsByStatus).map(([name, value]) => ({ name, value })) : [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time overview of your ClaimsOS workspace</p>
        </div>

        {isLoading ? <div className="text-gray-500">Loading...</div> : (
          <>
            {/* KPI grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Claims" value={data?.totalClaims ?? 0} color="blue" icon={<FileText size={16}/>} />
              <StatCard label="Total Statements" value={data?.totalStatements ?? 0} color="green" icon={<CheckCircle size={16}/>} />
              <StatCard label="My Pending Tasks" value={data?.myPendingTasks ?? 0} color="yellow" icon={<Clock size={16}/>} link="/tasks" />
              <StatCard label="Approval Rate" value={analytics?.approvalRate != null ? `${analytics.approvalRate}%` : '—'} color="purple" icon={<CheckCircle size={16}/>} link="/analytics" />
            </div>

            {/* Second KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Local Adaptations" value={analytics?.totals?.adaptations ?? 0} color="blue" icon={<Globe size={16}/>} link="/local-adaptations" />
              <StatCard label="Avg. Days to Approve" value={analytics?.avgDaysToApproval ?? '—'} color="green" icon={<Clock size={16}/>} />
              <StatCard label="High Risk Claims" value={riskData?.byRisk?.high ?? 0} color="red" icon={<AlertTriangle size={16}/>} link="/analytics" />
              <StatCard label="Substantiations" value={analytics?.totals?.substantiations ?? 0} color="purple" icon={<CheckCircle size={16}/>} link="/substantiations" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card">
                <h2 className="text-sm font-semibold mb-4 text-gray-700">Claims by Status</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={claimsData} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {claimsData.map((entry: any) => (
                        <Cell key={entry.name} fill={STATUS_COLORS_MAP[entry.name] || '#3b82f6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card">
                <h2 className="text-sm font-semibold mb-4 text-gray-700">Statements by Status</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={statementsData} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {statementsData.map((entry: any) => (
                        <Cell key={entry.name} fill={STATUS_COLORS_MAP[entry.name] || '#22c55e'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* High risk alert */}
            {riskData?.highRiskClaims?.length > 0 && (
              <div className="card border border-red-200 bg-red-50">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-red-700 flex items-center gap-2">
                    <AlertTriangle size={16} /> High-Risk Claims Requiring Attention
                  </h2>
                  <Link href="/analytics" className="text-xs text-red-600 hover:underline">View all →</Link>
                </div>
                <div className="space-y-2">
                  {riskData.highRiskClaims.slice(0, 3).map((c: any) => (
                    <Link key={c._id} href={`/claims/${c._id}`}
                      className="flex items-center justify-between p-3 bg-white border border-red-100 rounded-lg hover:shadow-sm transition-shadow">
                      <div>
                        <p className="text-sm font-medium">{c.title}</p>
                        <p className="text-xs text-gray-500">{c.product?.name} · {c.status}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {c.flaggedWords?.slice(0, 3).map((fw: any) => (
                          <span key={fw.word} className="badge bg-red-100 text-red-700 text-[10px]">{fw.word}</span>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Quick links */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { href: '/statements', label: 'Manage Statements', icon: FileText, color: 'text-blue-600' },
                { href: '/claims', label: 'Review Claims', icon: CheckCircle, color: 'text-green-600' },
                { href: '/local-adaptations', label: 'Local Adaptations', icon: Globe, color: 'text-purple-600' },
                { href: '/pack-copy', label: 'Pack Copy', icon: Copy, color: 'text-orange-600' },
              ].map(({ href, label, icon: Icon, color }) => (
                <Link key={href} href={href}
                  className="card hover:shadow-md transition-shadow flex items-center gap-3 p-4 cursor-pointer">
                  <Icon size={20} className={`${color} shrink-0`} />
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function StatCard({ label, value, color, icon, link }: { label: string; value: any; color: string; icon?: React.ReactNode; link?: string }) {
  const colorMap: Record<string, string> = {
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    green: 'border-green-100 bg-green-50 text-green-700',
    yellow: 'border-yellow-100 bg-yellow-50 text-yellow-700',
    purple: 'border-purple-100 bg-purple-50 text-purple-700',
    red: 'border-red-100 bg-red-50 text-red-700',
  };
  const card = (
    <div className={`card border ${colorMap[color]} ${link ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium opacity-70 leading-tight">{label}</p>
        {icon && <div className="opacity-60">{icon}</div>}
      </div>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
  return link ? <Link href={link}>{card}</Link> : card;
}
