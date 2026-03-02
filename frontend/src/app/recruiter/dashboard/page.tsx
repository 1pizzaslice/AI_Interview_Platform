'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { BarChart3, GitCompare, Kanban, MessageSquare, Briefcase } from 'lucide-react';

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
    STRONG_HIRE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    HIRE: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    BORDERLINE: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    NO_HIRE: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  const navLinks = [
    { href: '/recruiter/analytics', icon: BarChart3, label: 'Analytics' },
    { href: '/recruiter/compare', icon: GitCompare, label: 'Compare' },
    { href: '/recruiter/pipeline', icon: Kanban, label: 'Pipeline' },
    { href: '/recruiter/question-banks', icon: MessageSquare, label: 'Questions' },
    { href: '/recruiter/jobs', icon: Briefcase, label: 'Manage Jobs', primary: true },
  ];

  return (
    <div className="min-h-screen p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>
          <p className="text-zinc-400 mt-1">Welcome back, <span className="text-gradient font-semibold">{user?.name}</span></p>
        </div>
        <div className="flex gap-2">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all duration-200 active:scale-[0.97] ${
                link.primary
                  ? 'bg-gradient-to-r from-purple-500 to-violet-500 text-white hover:from-purple-600 hover:to-violet-600 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                  : 'bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 hover:border-purple-500/50'
              }`}
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Total Reports</p>
          <p className="text-3xl font-bold mt-1 text-gradient">{reports.length}</p>
        </div>
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Strong Hire</p>
          <p className="text-3xl font-bold mt-1 text-emerald-400">
            {reports.filter(r => r.recommendation === 'STRONG_HIRE').length}
          </p>
        </div>
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Avg Score</p>
          <p className="text-3xl font-bold mt-1 text-gradient">
            {reports.length ? Math.round(reports.reduce((a, r) => a + r.overallScore, 0) / reports.length) : '\u2014'}
          </p>
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-3 text-zinc-100">Recent Reports</h2>
        {loading && <p className="text-zinc-500 text-sm">Loading...</p>}
        {!loading && reports.length === 0 && <p className="text-zinc-500 text-sm">No reports yet.</p>}
        <div className="space-y-2">
          {reports.map(report => (
            <Link key={report._id} href={`/recruiter/reports/${report.sessionId}`}
              className="block bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.1)] active:scale-[0.99] transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-zinc-100">{report.candidateId.name}</p>
                  <p className="text-sm text-zinc-400">{report.jobRoleId.title} · {report.candidateId.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gradient">{report.overallScore}/100</span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium border ${recommendationColor[report.recommendation] ?? ''}`}>
                    {report.recommendation.replace(/_/g, ' ')}
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
