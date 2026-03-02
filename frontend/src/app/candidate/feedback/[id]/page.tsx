'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Lightbulb } from 'lucide-react';

interface DimensionRating {
  dimension: string;
  rating: 'Strong' | 'Competent' | 'Developing' | 'Weak';
}

interface Feedback {
  candidateName: string;
  jobTitle: string;
  performanceTier: string;
  dimensionRatings: DimensionRating[];
  tips: string[];
  completedAt: string;
}

const tierColors: Record<string, string> = {
  Excellent: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Good: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Average: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Needs Improvement': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

const ratingColors: Record<string, string> = {
  Strong: 'text-emerald-400',
  Competent: 'text-blue-400',
  Developing: 'text-amber-400',
  Weak: 'text-rose-400',
};

export default function FeedbackPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const token = useAuthStore(s => s.accessToken);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ data: Feedback }>(`/api/reports/${sessionId}/feedback`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => setFeedback(r.data.data))
      .catch(() => setError('Feedback not yet available. Please check back later.'))
      .finally(() => setLoading(false));
  }, [sessionId, token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-zinc-400">Loading feedback...</p>
      </div>
    );
  }

  if (error || !feedback) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-zinc-400">{error}</p>
          <Link href="/candidate/onboard" className="text-purple-400 hover:text-purple-300 text-sm transition-colors">Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Interview Feedback</h1>
        <p className="text-zinc-400 text-sm mt-1">
          {feedback.jobTitle} · Completed {new Date(feedback.completedAt).toLocaleDateString()}
        </p>
      </div>

      {/* Performance Tier */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6 text-center">
        <p className="text-sm text-zinc-400 mb-2">Overall Performance</p>
        <span className={`inline-block px-4 py-2 rounded-full text-lg font-semibold border ${tierColors[feedback.performanceTier] ?? 'bg-white/5 text-zinc-400 border-white/10'}`}>
          {feedback.performanceTier}
        </span>
      </div>

      {/* Dimension Ratings */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold text-zinc-100">Skills Assessment</h2>
        <div className="grid grid-cols-2 gap-4">
          {feedback.dimensionRatings.map(dr => (
            <div key={dr.dimension} className="bg-white/5 border border-white/10 rounded-lg p-3">
              <p className="text-xs text-zinc-500">{dr.dimension}</p>
              <p className={`font-semibold mt-1 ${ratingColors[dr.rating] ?? 'text-zinc-400'}`}>{dr.rating}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6 space-y-3">
        <h2 className="font-semibold text-zinc-100">Tips for Improvement</h2>
        <ul className="space-y-2">
          {feedback.tips.map((tip, i) => (
            <li key={i} className="flex gap-2 text-sm text-zinc-300">
              <Lightbulb className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              {tip}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-zinc-500 text-center">
        This feedback is based on your AI interview performance. Exact scores are not disclosed.
      </p>
    </div>
  );
}
