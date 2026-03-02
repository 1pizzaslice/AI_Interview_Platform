'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line,
} from 'recharts';
import { ArrowLeft } from 'lucide-react';

interface DimensionAverages {
  technical: number;
  communication: number;
  problemSolving: number;
  culturalFit: number;
  resumeAlignment: number;
}

interface Analytics {
  totalReports: number;
  avgScore: number;
  passRate: number;
  avgConfidence: number;
  scoreDistribution: Array<{ range: string; count: number }>;
  recommendationBreakdown: Array<{ recommendation: string; count: number }>;
  dimensionAverages: DimensionAverages;
  timeTrend: Array<{ date: string; count: number; avgScore: number }>;
  roleBreakdown: Array<{
    jobRoleId: string;
    title: string;
    domain: string;
    count: number;
    avgScore: number;
    passRate: number;
  }>;
}

interface Job {
  _id: string;
  title: string;
  domain: string;
}

const REC_COLORS: Record<string, string> = {
  STRONG_HIRE: '#34d399',
  HIRE: '#60a5fa',
  BORDERLINE: '#fbbf24',
  NO_HIRE: '#fb7185',
};

export default function AnalyticsPage() {
  const token = useAuthStore(s => s.accessToken);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedJob) params.set('jobRoleId', selectedJob);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const { data } = await api.get<{ data: Analytics }>(
        `/api/reports/recruiter/analytics?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setAnalytics(data.data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [token, selectedJob, dateFrom, dateTo]);

  useEffect(() => {
    api.get<{ data: Job[] }>('/api/jobs', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setJobs(r.data.data))
      .catch(console.error);
  }, [token]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  const dimensionData = analytics ? [
    { dimension: 'Technical', value: analytics.dimensionAverages.technical },
    { dimension: 'Communication', value: analytics.dimensionAverages.communication },
    { dimension: 'Problem Solving', value: analytics.dimensionAverages.problemSolving },
    { dimension: 'Cultural Fit', value: analytics.dimensionAverages.culturalFit },
    { dimension: 'Resume Align', value: analytics.dimensionAverages.resumeAlignment },
  ] : [];

  return (
    <div className="min-h-screen p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Analytics</h1>
          <p className="text-zinc-400 text-sm mt-1">Interview performance insights</p>
        </div>
        <Link href="/recruiter/dashboard" className="text-sm text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Job Role</label>
          <select
            value={selectedJob}
            onChange={e => setSelectedJob(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors"
          >
            <option value="">All Roles</option>
            {jobs.map(j => (
              <option key={j._id} value={j._id}>{j.title} ({j.domain})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors"
          />
        </div>
        {(selectedJob || dateFrom || dateTo) && (
          <button
            onClick={() => { setSelectedJob(''); setDateFrom(''); setDateTo(''); }}
            className="text-xs text-zinc-500 hover:text-zinc-300 underline pb-2 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {loading && <p className="text-zinc-500 text-sm">Loading analytics...</p>}

      {analytics && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
              <p className="text-sm text-zinc-400">Total Interviews</p>
              <p className="text-3xl font-bold mt-1 text-gradient">{analytics.totalReports}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
              <p className="text-sm text-zinc-400">Average Score</p>
              <p className="text-3xl font-bold mt-1 text-gradient">{analytics.avgScore}<span className="text-base text-zinc-500">/100</span></p>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
              <p className="text-sm text-zinc-400">Pass Rate</p>
              <p className="text-3xl font-bold mt-1 text-emerald-400">{analytics.passRate}%</p>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
              <p className="text-sm text-zinc-400">Avg Confidence</p>
              <p className="text-3xl font-bold mt-1 text-gradient">{(analytics.avgConfidence * 100).toFixed(0)}%</p>
            </div>
          </div>

          {analytics.totalReports === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center text-zinc-500">
              No reports yet. Analytics will appear once candidates complete interviews.
            </div>
          ) : (
            <>
              {/* Charts Row 1 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
                  <h3 className="font-semibold mb-4 text-zinc-100">Score Distribution</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={analytics.scoreDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#a1a1aa' }} />
                      <YAxis allowDecimals={false} tick={{ fill: '#a1a1aa' }} />
                      <Tooltip contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fafafa' }} />
                      <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
                  <h3 className="font-semibold mb-4 text-zinc-100">Recommendations</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={analytics.recommendationBreakdown}
                        dataKey="count"
                        nameKey="recommendation"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label
                      >
                        {analytics.recommendationBreakdown.map((entry) => (
                          <Cell key={entry.recommendation} fill={REC_COLORS[entry.recommendation] ?? '#71717a'} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fafafa' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Charts Row 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
                  <h3 className="font-semibold mb-4 text-zinc-100">Average Dimensions</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={dimensionData}>
                      <PolarGrid stroke="rgba(255,255,255,0.1)" />
                      <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: '#a1a1aa' }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#71717a' }} />
                      <Radar
                        name="Average"
                        dataKey="value"
                        stroke="#a855f7"
                        fill="#a855f7"
                        fillOpacity={0.2}
                      />
                      <Tooltip contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fafafa' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
                  <h3 className="font-semibold mb-4 text-zinc-100">Score Trend Over Time</h3>
                  {analytics.timeTrend.length > 1 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={analytics.timeTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#a1a1aa' }} />
                        <YAxis domain={[0, 100]} tick={{ fill: '#a1a1aa' }} />
                        <Tooltip contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fafafa' }} />
                        <Line
                          type="monotone"
                          dataKey="avgScore"
                          stroke="#a855f7"
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#a855f7' }}
                          name="Avg Score"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[280px] flex items-center justify-center text-zinc-500 text-sm">
                      Need 2+ days of data for trend chart
                    </div>
                  )}
                </div>
              </div>

              {/* Role Breakdown Table */}
              {analytics.roleBreakdown.length > 0 && (
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
                  <h3 className="font-semibold mb-4 text-zinc-100">Performance by Role</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-left text-zinc-400">
                          <th className="pb-2 font-medium">Role</th>
                          <th className="pb-2 font-medium">Domain</th>
                          <th className="pb-2 font-medium text-right">Interviews</th>
                          <th className="pb-2 font-medium text-right">Avg Score</th>
                          <th className="pb-2 font-medium text-right">Pass Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.roleBreakdown.map(role => (
                          <tr key={role.jobRoleId} className="border-b border-white/5 last:border-b-0">
                            <td className="py-2 font-medium text-zinc-200">{role.title}</td>
                            <td className="py-2 text-zinc-400">{role.domain}</td>
                            <td className="py-2 text-right text-zinc-300">{role.count}</td>
                            <td className="py-2 text-right font-medium text-zinc-200">{role.avgScore}</td>
                            <td className="py-2 text-right">
                              <span className={role.passRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}>
                                {role.passRate}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
