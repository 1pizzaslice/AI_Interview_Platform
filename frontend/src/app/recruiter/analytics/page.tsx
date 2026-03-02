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
  STRONG_HIRE: '#22c55e',
  HIRE: '#3b82f6',
  BORDERLINE: '#eab308',
  NO_HIRE: '#ef4444',
};

const REC_LABELS: Record<string, string> = {
  STRONG_HIRE: 'Strong Hire',
  HIRE: 'Hire',
  BORDERLINE: 'Borderline',
  NO_HIRE: 'No Hire',
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
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-gray-500 text-sm mt-1">Interview performance insights</p>
        </div>
        <Link href="/recruiter/dashboard" className="text-sm text-brand-600 hover:underline">
          Back to Dashboard
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-lg p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Job Role</label>
          <select
            value={selectedJob}
            onChange={e => setSelectedJob(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Roles</option>
            {jobs.map(j => (
              <option key={j._id} value={j._id}>{j.title} ({j.domain})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        {(selectedJob || dateFrom || dateTo) && (
          <button
            onClick={() => { setSelectedJob(''); setDateFrom(''); setDateTo(''); }}
            className="text-xs text-gray-500 hover:text-gray-700 underline pb-2"
          >
            Clear filters
          </button>
        )}
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading analytics...</p>}

      {analytics && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border rounded-lg p-4">
              <p className="text-sm text-gray-500">Total Interviews</p>
              <p className="text-3xl font-bold mt-1">{analytics.totalReports}</p>
            </div>
            <div className="bg-white border rounded-lg p-4">
              <p className="text-sm text-gray-500">Average Score</p>
              <p className="text-3xl font-bold mt-1">{analytics.avgScore}<span className="text-base text-gray-400">/100</span></p>
            </div>
            <div className="bg-white border rounded-lg p-4">
              <p className="text-sm text-gray-500">Pass Rate</p>
              <p className="text-3xl font-bold mt-1 text-green-600">{analytics.passRate}%</p>
            </div>
            <div className="bg-white border rounded-lg p-4">
              <p className="text-sm text-gray-500">Avg Confidence</p>
              <p className="text-3xl font-bold mt-1">{(analytics.avgConfidence * 100).toFixed(0)}%</p>
            </div>
          </div>

          {analytics.totalReports === 0 ? (
            <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
              No reports yet. Analytics will appear once candidates complete interviews.
            </div>
          ) : (
            <>
              {/* Charts Row 1: Score Distribution + Recommendation Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Score Distribution */}
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="font-semibold mb-4">Score Distribution</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={analytics.scoreDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Recommendation Pie */}
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="font-semibold mb-4">Recommendations</h3>
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
                          <Cell key={entry.recommendation} fill={REC_COLORS[entry.recommendation] ?? '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Charts Row 2: Dimension Radar + Time Trend */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Dimension Radar */}
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="font-semibold mb-4">Average Dimensions</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={dimensionData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Radar
                        name="Average"
                        dataKey="value"
                        stroke="#6366f1"
                        fill="#6366f1"
                        fillOpacity={0.3}
                      />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                {/* Time Trend */}
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="font-semibold mb-4">Score Trend Over Time</h3>
                  {analytics.timeTrend.length > 1 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={analytics.timeTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="avgScore"
                          stroke="#6366f1"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          name="Avg Score"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">
                      Need 2+ days of data for trend chart
                    </div>
                  )}
                </div>
              </div>

              {/* Role Breakdown Table */}
              {analytics.roleBreakdown.length > 0 && (
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="font-semibold mb-4">Performance by Role</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-500">
                          <th className="pb-2 font-medium">Role</th>
                          <th className="pb-2 font-medium">Domain</th>
                          <th className="pb-2 font-medium text-right">Interviews</th>
                          <th className="pb-2 font-medium text-right">Avg Score</th>
                          <th className="pb-2 font-medium text-right">Pass Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.roleBreakdown.map(role => (
                          <tr key={role.jobRoleId} className="border-b last:border-b-0">
                            <td className="py-2 font-medium">{role.title}</td>
                            <td className="py-2 text-gray-500">{role.domain}</td>
                            <td className="py-2 text-right">{role.count}</td>
                            <td className="py-2 text-right font-medium">{role.avgScore}</td>
                            <td className="py-2 text-right">
                              <span className={role.passRate >= 50 ? 'text-green-600' : 'text-red-600'}>
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
