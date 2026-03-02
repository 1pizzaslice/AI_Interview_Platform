'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend, Tooltip,
} from 'recharts';

interface DimensionScores {
  technical: number;
  communication: number;
  problemSolving: number;
  culturalFit: number;
  resumeAlignment: number;
}

interface Report {
  _id: string;
  sessionId: string;
  overallScore: number;
  recommendation: string;
  dimensionScores: DimensionScores;
  strengths: string[];
  weaknesses: string[];
  averageConfidence: number;
  candidateId: { name: string; email: string };
  jobRoleId: { title: string; domain: string };
  generatedAt: string;
}

interface ListReport {
  _id: string;
  sessionId: string;
  overallScore: number;
  recommendation: string;
  candidateId: { name: string; email: string };
  jobRoleId: { title: string; domain: string };
}

const REC_COLORS: Record<string, string> = {
  STRONG_HIRE: 'bg-green-100 text-green-800',
  HIRE: 'bg-blue-100 text-blue-800',
  BORDERLINE: 'bg-yellow-100 text-yellow-800',
  NO_HIRE: 'bg-red-100 text-red-800',
};

const CHART_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444'];

export default function ComparePage() {
  const token = useAuthStore(s => s.accessToken);
  const searchParams = useSearchParams();
  const [reports, setReports] = useState<Report[]>([]);
  const [allReports, setAllReports] = useState<ListReport[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Load all recruiter's reports for the selector
  useEffect(() => {
    api.get<{ data: ListReport[] }>('/api/reports/recruiter/me', {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => setAllReports(r.data.data)).catch(console.error);
  }, [token]);

  // Parse initial session IDs from URL
  useEffect(() => {
    const ids = searchParams.get('ids');
    if (ids) setSelectedIds(ids.split(','));
  }, [searchParams]);

  const fetchComparison = useCallback(async () => {
    if (selectedIds.length < 2) return;
    setLoading(true);
    try {
      const { data } = await api.get<{ data: Report[] }>(
        `/api/reports/recruiter/compare?sessionIds=${selectedIds.join(',')}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setReports(data.data);
    } catch (err) {
      console.error('Failed to fetch comparison:', err);
    } finally {
      setLoading(false);
    }
  }, [token, selectedIds]);

  useEffect(() => {
    void fetchComparison();
  }, [fetchComparison]);

  const toggleCandidate = (sessionId: string) => {
    setSelectedIds(prev => {
      if (prev.includes(sessionId)) return prev.filter(id => id !== sessionId);
      if (prev.length >= 4) return prev; // max 4
      return [...prev, sessionId];
    });
  };

  // Build radar chart data
  const dimensions = ['Technical', 'Communication', 'Problem Solving', 'Cultural Fit', 'Resume Align'] as const;
  const dimensionKeys: (keyof DimensionScores)[] = ['technical', 'communication', 'problemSolving', 'culturalFit', 'resumeAlignment'];

  const radarData = dimensions.map((dim, i) => {
    const point: Record<string, string | number> = { dimension: dim };
    reports.forEach(r => {
      point[r.candidateId.name] = r.dimensionScores[dimensionKeys[i]];
    });
    return point;
  });

  return (
    <div className="min-h-screen p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Compare Candidates</h1>
          <p className="text-gray-500 text-sm mt-1">Select 2-4 candidates to compare side-by-side</p>
        </div>
        <Link href="/recruiter/dashboard" className="text-sm text-brand-600 hover:underline">
          Back to Dashboard
        </Link>
      </div>

      {/* Candidate Selector */}
      <div className="bg-white border rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-3">Select candidates ({selectedIds.length}/4)</h3>
        <div className="flex flex-wrap gap-2">
          {allReports.map(r => (
            <button
              key={r.sessionId}
              onClick={() => toggleCandidate(r.sessionId)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                selectedIds.includes(r.sessionId)
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-brand-400'
              } ${!selectedIds.includes(r.sessionId) && selectedIds.length >= 4 ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!selectedIds.includes(r.sessionId) && selectedIds.length >= 4}
            >
              {r.candidateId.name} ({r.overallScore})
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading comparison...</p>}

      {reports.length >= 2 && !loading && (
        <>
          {/* Score Overview Table */}
          <div className="bg-white border rounded-lg p-6 overflow-x-auto">
            <h3 className="font-semibold mb-4">Score Overview</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 font-medium">Metric</th>
                  {reports.map(r => (
                    <th key={r.sessionId} className="pb-2 font-medium text-center">{r.candidateId.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Overall Score</td>
                  {reports.map(r => (
                    <td key={r.sessionId} className="py-2 text-center font-bold text-lg">{r.overallScore}</td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Recommendation</td>
                  {reports.map(r => (
                    <td key={r.sessionId} className="py-2 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${REC_COLORS[r.recommendation] ?? ''}`}>
                        {r.recommendation.replace('_', ' ')}
                      </span>
                    </td>
                  ))}
                </tr>
                {dimensions.map((dim, i) => (
                  <tr key={dim} className="border-b last:border-b-0">
                    <td className="py-2 text-gray-600">{dim}</td>
                    {reports.map(r => {
                      const val = r.dimensionScores[dimensionKeys[i]];
                      const maxVal = Math.max(...reports.map(rr => rr.dimensionScores[dimensionKeys[i]]));
                      return (
                        <td key={r.sessionId} className={`py-2 text-center ${val === maxVal && reports.length > 1 ? 'font-bold text-green-600' : ''}`}>
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Confidence</td>
                  {reports.map(r => (
                    <td key={r.sessionId} className="py-2 text-center">
                      {(r.averageConfidence * 100).toFixed(0)}%
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Radar Chart */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="font-semibold mb-4">Dimension Comparison</h3>
            <ResponsiveContainer width="100%" height={350}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                {reports.map((r, i) => (
                  <Radar
                    key={r.sessionId}
                    name={r.candidateId.name}
                    dataKey={r.candidateId.name}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    fillOpacity={0.15}
                  />
                ))}
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reports.map((r, i) => (
              <div key={r.sessionId} className="bg-white border rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <h3 className="font-semibold">{r.candidateId.name}</h3>
                  <span className="text-sm text-gray-500">— {r.jobRoleId.title}</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase mb-1">Strengths</p>
                    <ul className="space-y-1">
                      {r.strengths.map((s, j) => (
                        <li key={j} className="text-sm text-green-700 flex items-start gap-1.5">
                          <span className="mt-0.5 text-green-500">+</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase mb-1">Weaknesses</p>
                    <ul className="space-y-1">
                      {r.weaknesses.map((w, j) => (
                        <li key={j} className="text-sm text-red-700 flex items-start gap-1.5">
                          <span className="mt-0.5 text-red-500">-</span> {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {selectedIds.length < 2 && !loading && (
        <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
          Select at least 2 candidates above to compare.
        </div>
      )}
    </div>
  );
}
