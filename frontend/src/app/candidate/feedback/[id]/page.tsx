'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

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
  Excellent: 'bg-green-100 text-green-800 border-green-200',
  Good: 'bg-blue-100 text-blue-800 border-blue-200',
  Average: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Needs Improvement': 'bg-red-100 text-red-800 border-red-200',
};

const ratingColors: Record<string, string> = {
  Strong: 'text-green-600',
  Competent: 'text-blue-600',
  Developing: 'text-yellow-600',
  Weak: 'text-red-600',
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
        <p className="text-gray-500">Loading feedback...</p>
      </div>
    );
  }

  if (error || !feedback) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-gray-600">{error}</p>
          <Link href="/candidate/onboard" className="text-brand-600 hover:underline text-sm">Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Interview Feedback</h1>
        <p className="text-gray-500 text-sm mt-1">
          {feedback.jobTitle} · Completed {new Date(feedback.completedAt).toLocaleDateString()}
        </p>
      </div>

      {/* Performance Tier */}
      <div className="bg-white border rounded-xl p-6 text-center">
        <p className="text-sm text-gray-500 mb-2">Overall Performance</p>
        <span className={`inline-block px-4 py-2 rounded-full text-lg font-semibold border ${tierColors[feedback.performanceTier] ?? ''}`}>
          {feedback.performanceTier}
        </span>
      </div>

      {/* Dimension Ratings */}
      <div className="bg-white border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Skills Assessment</h2>
        <div className="grid grid-cols-2 gap-4">
          {feedback.dimensionRatings.map(dr => (
            <div key={dr.dimension} className="border rounded-lg p-3">
              <p className="text-xs text-gray-500">{dr.dimension}</p>
              <p className={`font-semibold mt-1 ${ratingColors[dr.rating] ?? ''}`}>{dr.rating}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div className="bg-white border rounded-xl p-6 space-y-3">
        <h2 className="font-semibold">Tips for Improvement</h2>
        <ul className="space-y-2">
          {feedback.tips.map((tip, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-700">
              <span className="text-brand-600 mt-0.5 flex-shrink-0">*</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-gray-400 text-center">
        This feedback is based on your AI interview performance. Exact scores are not disclosed.
      </p>
    </div>
  );
}
