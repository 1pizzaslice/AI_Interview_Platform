'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

type Stage = 'applied' | 'screened' | 'interviewed' | 'offered' | 'rejected';

interface PipelineEntry {
  _id: string;
  stage: Stage;
  notes: string;
  candidateId: { _id: string; name: string; email: string };
  jobRoleId: { _id: string; title: string; domain: string };
  updatedAt: string;
}

interface Job {
  _id: string;
  title: string;
  domain: string;
}

const STAGES: { id: Stage; label: string; color: string }[] = [
  { id: 'applied', label: 'Applied', color: 'bg-gray-100 border-gray-300' },
  { id: 'screened', label: 'Screened', color: 'bg-blue-50 border-blue-300' },
  { id: 'interviewed', label: 'Interviewed', color: 'bg-purple-50 border-purple-300' },
  { id: 'offered', label: 'Offered', color: 'bg-green-50 border-green-300' },
  { id: 'rejected', label: 'Rejected', color: 'bg-red-50 border-red-300' },
];

export default function PipelinePage() {
  const token = useAuthStore(s => s.accessToken);
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState('');
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  function authHeaders() {
    return { Authorization: `Bearer ${token}` };
  }

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = selectedJob ? `?jobRoleId=${selectedJob}` : '';
      const { data } = await api.get<{ data: PipelineEntry[] }>(`/api/pipeline${params}`, { headers: authHeaders() });
      setEntries(data.data);
    } catch (err) {
      console.error('Failed to fetch pipeline:', err);
    } finally {
      setLoading(false);
    }
  }, [token, selectedJob]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.get<{ data: Job[] }>('/api/jobs', { headers: authHeaders() })
      .then(r => setJobs(r.data.data))
      .catch(console.error);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  async function moveToStage(entryId: string, newStage: Stage) {
    try {
      await api.patch(`/api/pipeline/${entryId}`, { stage: newStage }, { headers: authHeaders() });
      setEntries(prev => prev.map(e => e._id === entryId ? { ...e, stage: newStage } : e));
    } catch (err) {
      console.error('Failed to update stage:', err);
    }
  }

  async function handleRemove(entryId: string) {
    try {
      await api.delete(`/api/pipeline/${entryId}`, { headers: authHeaders() });
      setEntries(prev => prev.filter(e => e._id !== entryId));
    } catch (err) {
      console.error('Failed to remove from pipeline:', err);
    }
  }

  function handleDragStart(entryId: string) {
    setDraggedId(entryId);
  }

  function handleDrop(stage: Stage) {
    if (draggedId) {
      void moveToStage(draggedId, stage);
      setDraggedId(null);
    }
  }

  const entriesByStage = (stage: Stage) => entries.filter(e => e.stage === stage);

  return (
    <div className="min-h-screen p-8 max-w-full mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Candidate Pipeline</h1>
          <p className="text-gray-500 text-sm mt-1">Drag candidates between stages</p>
        </div>
        <div className="flex gap-3 items-center">
          <select
            value={selectedJob}
            onChange={e => setSelectedJob(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Jobs</option>
            {jobs.map(j => (
              <option key={j._id} value={j._id}>{j.title}</option>
            ))}
          </select>
          <Link href="/recruiter/dashboard" className="text-sm text-brand-600 hover:underline">
            Dashboard
          </Link>
        </div>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading pipeline...</p>}

      {!loading && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map(stage => (
            <div
              key={stage.id}
              className={`flex-shrink-0 w-64 rounded-lg border-2 p-3 min-h-[400px] ${stage.color}`}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(stage.id)}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">{stage.label}</h3>
                <span className="text-xs text-gray-500 bg-white/60 px-1.5 py-0.5 rounded">
                  {entriesByStage(stage.id).length}
                </span>
              </div>

              <div className="space-y-2">
                {entriesByStage(stage.id).map(entry => (
                  <div
                    key={entry._id}
                    draggable
                    onDragStart={() => handleDragStart(entry._id)}
                    className="bg-white rounded-lg p-3 shadow-sm border cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                  >
                    <p className="font-medium text-sm">{entry.candidateId.name}</p>
                    <p className="text-xs text-gray-500">{entry.candidateId.email}</p>
                    <p className="text-xs text-gray-400 mt-1">{entry.jobRoleId.title}</p>
                    {entry.notes && (
                      <p className="text-xs text-gray-500 mt-2 italic border-t pt-1">{entry.notes}</p>
                    )}
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[10px] text-gray-400">
                        {new Date(entry.updatedAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => void handleRemove(entry._id)}
                        className="text-[10px] text-red-400 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && entries.length === 0 && (
        <p className="text-gray-500 text-sm text-center">
          No candidates in the pipeline yet. Candidates will appear here after their interviews are completed.
        </p>
      )}
    </div>
  );
}
