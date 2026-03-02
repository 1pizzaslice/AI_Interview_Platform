'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

interface Report {
  _id: string;
  sessionId: string;
  overallScore: number;
  recommendation: string;
  generatedAt: string;
  candidateId: { name: string; email: string };
  jobRoleId: { title: string; domain: string };
}

export default function RecruiterDashboard() {
  const token = useAuthStore(s => s.accessToken);
  const user = useAuthStore(s => s.user);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: Report[] }>('/api/reports/recruiter/me', {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => setReports(r.data.data)).catch(console.error).finally(() => setLoading(false));
  }, [token]);

  const recommendationColor: Record<string, string> = {
    STRONG_HIRE: 'bg-green-100 text-green-800',
    HIRE: 'bg-blue-100 text-blue-800',
    BORDERLINE: 'bg-yellow-100 text-yellow-800',
    NO_HIRE: 'bg-red-100 text-red-800',
  };

  return (
    <div className="min-h-screen p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome back, {user?.name}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/recruiter/analytics" className="px-4 py-2 border border-brand-600 text-brand-600 rounded-lg text-sm font-medium hover:bg-brand-50">
            Analytics
          </Link>
          <Link href="/recruiter/compare" className="px-4 py-2 border border-brand-600 text-brand-600 rounded-lg text-sm font-medium hover:bg-brand-50">
            Compare
          </Link>
          <Link href="/recruiter/pipeline" className="px-4 py-2 border border-brand-600 text-brand-600 rounded-lg text-sm font-medium hover:bg-brand-50">
            Pipeline
          </Link>
          <Link href="/recruiter/question-banks" className="px-4 py-2 border border-brand-600 text-brand-600 rounded-lg text-sm font-medium hover:bg-brand-50">
            Questions
          </Link>
          <Link href="/recruiter/jobs" className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700">
            Manage Jobs
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">Total Reports</p>
          <p className="text-3xl font-bold mt-1">{reports.length}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">Strong Hire</p>
          <p className="text-3xl font-bold mt-1 text-green-600">
            {reports.filter(r => r.recommendation === 'STRONG_HIRE').length}
          </p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">Avg Score</p>
          <p className="text-3xl font-bold mt-1">
            {reports.length ? Math.round(reports.reduce((a, r) => a + r.overallScore, 0) / reports.length) : '—'}
          </p>
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-3">Recent Reports</h2>
        {loading && <p className="text-gray-500 text-sm">Loading...</p>}
        {!loading && reports.length === 0 && <p className="text-gray-500 text-sm">No reports yet.</p>}
        <div className="space-y-2">
          {reports.map(report => (
            <Link key={report._id} href={`/recruiter/reports/${report.sessionId}`}
              className="block bg-white border rounded-lg p-4 hover:border-brand-500 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{report.candidateId.name}</p>
                  <p className="text-sm text-gray-500">{report.jobRoleId.title} · {report.candidateId.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold">{report.overallScore}/100</span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${recommendationColor[report.recommendation] ?? ''}`}>
                    {report.recommendation.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
