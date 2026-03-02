'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

interface Report {
  _id: string;
  overallScore: number;
  recommendation: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  antiCheatFlags: string[];
  generatedAt: string;
  dimensionScores: {
    technical: number;
    communication: number;
    problemSolving: number;
    culturalFit: number;
  };
  questionScores: Array<{
    questionId: string;
    questionText: string;
    score: number;
    summary: string;
  }>;
  candidateId: { name: string; email: string };
  jobRoleId: { title: string; domain: string; experienceLevel: string };
}

const recommendationColor: Record<string, string> = {
  STRONG_HIRE: 'bg-green-100 text-green-800 border-green-200',
  HIRE: 'bg-blue-100 text-blue-800 border-blue-200',
  BORDERLINE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  NO_HIRE: 'bg-red-100 text-red-800 border-red-200',
};

export default function ReportPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const token = useAuthStore(s => s.accessToken);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ data: Report }>(`/api/reports/${sessionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => setReport(r.data.data))
      .catch(() => setError('Report not found. Scoring may still be in progress.'))
      .finally(() => setLoading(false));
  }, [sessionId, token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading report...</p></div>;
  if (error || !report) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-gray-600">{error}</p>
        <Link href="/recruiter/dashboard" className="text-brand-600 hover:underline text-sm">Back to Dashboard</Link>
      </div>
    </div>
  );

  const dimensions = [
    { label: 'Technical', value: report.dimensionScores.technical },
    { label: 'Communication', value: report.dimensionScores.communication },
    { label: 'Problem Solving', value: report.dimensionScores.problemSolving },
    { label: 'Cultural Fit', value: report.dimensionScores.culturalFit },
  ];

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/recruiter/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
        <div className="flex gap-2">
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/reports/${sessionId}/export?format=csv`}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
          >
            Export CSV
          </a>
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/reports/${sessionId}/export?format=pdf`}
            className="px-3 py-1.5 border border-brand-600 text-brand-600 rounded-lg text-xs hover:bg-brand-50"
          >
            Export PDF
          </a>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white border rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{report.candidateId.name}</h1>
            <p className="text-gray-500 text-sm">{report.candidateId.email}</p>
            <p className="text-gray-500 text-sm mt-1">{report.jobRoleId.title} · {report.jobRoleId.domain} · {report.jobRoleId.experienceLevel}</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold">{report.overallScore}<span className="text-lg text-gray-400">/100</span></p>
            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-semibold border ${recommendationColor[report.recommendation] ?? ''}`}>
              {report.recommendation.replace('_', ' ')}
            </span>
          </div>
        </div>
        <p className="text-gray-700 text-sm leading-relaxed">{report.summary}</p>
      </div>

      {/* Dimension scores */}
      <div className="bg-white border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Score Breakdown</h2>
        {dimensions.map(d => (
          <div key={d.label}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">{d.label}</span>
              <span className="font-medium">{d.value}/100</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full" style={{ width: `${d.value}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Strengths & weaknesses */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border rounded-xl p-6">
          <h2 className="font-semibold mb-3 text-green-700">Strengths</h2>
          <ul className="space-y-1">
            {report.strengths.map((s, i) => <li key={i} className="text-sm text-gray-700">✓ {s}</li>)}
          </ul>
        </div>
        <div className="bg-white border rounded-xl p-6">
          <h2 className="font-semibold mb-3 text-red-700">Areas for Improvement</h2>
          <ul className="space-y-1">
            {report.weaknesses.map((w, i) => <li key={i} className="text-sm text-gray-700">✗ {w}</li>)}
          </ul>
        </div>
      </div>

      {/* Anti-cheat flags */}
      {report.antiCheatFlags.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <h2 className="font-semibold mb-3 text-yellow-800">Anti-Cheat Flags</h2>
          <ul className="space-y-1">
            {report.antiCheatFlags.map((f, i) => <li key={i} className="text-sm text-yellow-700">⚠ {f}</li>)}
          </ul>
        </div>
      )}

      {/* Question-by-question */}
      <div className="bg-white border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Question Scores</h2>
        {report.questionScores.map((q, i) => (
          <div key={q.questionId} className="border border-gray-100 rounded-lg p-4 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm font-medium text-gray-800">Q{i + 1}: {q.questionText}</p>
              <span className="text-sm font-bold shrink-0">{q.score}/100</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{q.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
