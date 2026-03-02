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
import { ArrowLeft } from 'lucide-react';

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
  STRONG_HIRE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  HIRE: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  BORDERLINE: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  NO_HIRE: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

const CHART_COLORS = ['#a855f7', '#fbbf24', '#34d399', '#fb7185'];

export default function ComparePage() {
  const token = useAuthStore(s => s.accessToken);
  const searchParams = useSearchParams();
  const [reports, setReports] = useState<Report[]>([]);
  const [allReports, setAllReports] = useState<ListReport[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<{ data: ListReport[] }>('/api/reports/recruiter/me', {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => setAllReports(r.data.data)).catch(console.error);
  }, [token]);

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
      if (prev.length >= 4) return prev;
      return [...prev, sessionId];
    });
  };

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
          <h1 className="text-2xl font-bold text-zinc-100">Compare Candidates</h1>
          <p className="text-zinc-400 text-sm mt-1">Select 2-4 candidates to compare side-by-side</p>
        </div>
        <Link href="/recruiter/dashboard" className="text-sm text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>
      </div>

      {/* Candidate Selector */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
        <h3 className="text-sm font-medium text-zinc-400 mb-3">Select candidates ({selectedIds.length}/4)</h3>
        <div className="flex flex-wrap gap-2">
          {allReports.map(r => (
            <button
              key={r.sessionId}
              onClick={() => toggleCandidate(r.sessionId)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-all duration-200 ${
                selectedIds.includes(r.sessionId)
                  ? 'bg-gradient-to-r from-purple-500 to-violet-500 text-white border-transparent'
                  : 'bg-white/5 text-zinc-300 border-white/10 hover:border-purple-500/50'
              } ${!selectedIds.includes(r.sessionId) && selectedIds.length >= 4 ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!selectedIds.includes(r.sessionId) && selectedIds.length >= 4}
            >
              {r.candidateId.name} ({r.overallScore})
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-zinc-500 text-sm">Loading comparison...</p>}

      {reports.length >= 2 && !loading && (
        <>
          {/* Score Overview Table */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6 overflow-x-auto">
            <h3 className="font-semibold mb-4 text-zinc-100">Score Overview</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-zinc-400">
                  <th className="pb-2 font-medium">Metric</th>
                  {reports.map(r => (
                    <th key={r.sessionId} className="pb-2 font-medium text-center text-zinc-300">{r.candidateId.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5">
                  <td className="py-2 text-zinc-400">Overall Score</td>
                  {reports.map(r => (
                    <td key={r.sessionId} className="py-2 text-center font-bold text-lg text-gradient">{r.overallScore}</td>
                  ))}
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 text-zinc-400">Recommendation</td>
                  {reports.map(r => (
                    <td key={r.sessionId} className="py-2 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium border ${REC_COLORS[r.recommendation] ?? ''}`}>
                        {r.recommendation.replace(/_/g, ' ')}
                      </span>
                    </td>
                  ))}
                </tr>
                {dimensions.map((dim, i) => (
                  <tr key={dim} className="border-b border-white/5 last:border-b-0">
                    <td className="py-2 text-zinc-400">{dim}</td>
                    {reports.map(r => {
                      const val = r.dimensionScores[dimensionKeys[i]];
                      const maxVal = Math.max(...reports.map(rr => rr.dimensionScores[dimensionKeys[i]]));
                      return (
                        <td key={r.sessionId} className={`py-2 text-center ${val === maxVal && reports.length > 1 ? 'font-bold text-purple-400' : 'text-zinc-300'}`}>
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="border-b border-white/5">
                  <td className="py-2 text-zinc-400">Confidence</td>
                  {reports.map(r => (
                    <td key={r.sessionId} className="py-2 text-center text-zinc-300">
                      {(r.averageConfidence * 100).toFixed(0)}%
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Radar Chart */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
            <h3 className="font-semibold mb-4 text-zinc-100">Dimension Comparison</h3>
            <ResponsiveContainer width="100%" height={350}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: '#a1a1aa' }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#71717a' }} />
                {reports.map((r, i) => (
                  <Radar
                    key={r.sessionId}
                    name={r.candidateId.name}
                    dataKey={r.candidateId.name}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    fillOpacity={0.1}
                  />
                ))}
                <Legend wrapperStyle={{ color: '#a1a1aa' }} />
                <Tooltip contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fafafa' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reports.map((r, i) => (
              <div key={r.sessionId} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <h3 className="font-semibold text-zinc-100">{r.candidateId.name}</h3>
                  <span className="text-sm text-zinc-500">\u2014 {r.jobRoleId.title}</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-zinc-500 uppercase mb-1">Strengths</p>
                    <ul className="space-y-1">
                      {r.strengths.map((s, j) => (
                        <li key={j} className="text-sm text-emerald-400/80 flex items-start gap-1.5">
                          <span className="mt-0.5 text-emerald-400">+</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-500 uppercase mb-1">Weaknesses</p>
                    <ul className="space-y-1">
                      {r.weaknesses.map((w, j) => (
                        <li key={j} className="text-sm text-rose-400/80 flex items-start gap-1.5">
                          <span className="mt-0.5 text-rose-400">-</span> {w}
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
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center text-zinc-500">
          Select at least 2 candidates above to compare.
        </div>
      )}
    </div>
  );
}
