'use client';
import { useQuery } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import api from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  Draft: '#94a3b8', 'In Review': '#f59e0b', 'In Use': '#22c55e', Retired: '#6b7280',
  'Legal Review': '#f59e0b', 'Regulatory Review': '#8b5cf6', Approved: '#22c55e',
  Rejected: '#ef4444', 'Under Review': '#f59e0b', Expired: '#6b7280',
};

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then(r => r.data),
  });

  const claimsData = data ? Object.entries(data.claimsByStatus).map(([name, value]) => ({ name, value })) : [];
  const statementsData = data ? Object.entries(data.statementsByStatus).map(([name, value]) => ({ name, value })) : [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {isLoading ? (
          <div className="text-gray-500">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Claims" value={data?.totalClaims ?? 0} color="blue" />
              <StatCard label="Total Statements" value={data?.totalStatements ?? 0} color="green" />
              <StatCard label="My Pending Tasks" value={data?.myPendingTasks ?? 0} color="yellow" />
              <StatCard label="Approved Claims" value={data?.claimsByStatus?.Approved ?? 0} color="purple" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card">
                <h2 className="text-lg font-semibold mb-4">Claims by Status</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={claimsData}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value">
                      {claimsData.map((entry) => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#3b82f6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card">
                <h2 className="text-lg font-semibold mb-4">Statements by Status</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={statementsData}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value">
                      {statementsData.map((entry) => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#22c55e'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700', green: 'bg-green-50 text-green-700',
    yellow: 'bg-yellow-50 text-yellow-700', purple: 'bg-purple-50 text-purple-700',
  };
  return (
    <div className={`card flex flex-col gap-1 ${colors[color]}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}
