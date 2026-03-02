'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { ArrowLeft } from 'lucide-react';

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

const STAGES: { id: Stage; label: string; accentColor: string }[] = [
  { id: 'applied', label: 'Applied', accentColor: 'bg-zinc-400' },
  { id: 'screened', label: 'Screened', accentColor: 'bg-blue-400' },
  { id: 'interviewed', label: 'Interviewed', accentColor: 'bg-purple-400' },
  { id: 'offered', label: 'Offered', accentColor: 'bg-emerald-400' },
  { id: 'rejected', label: 'Rejected', accentColor: 'bg-rose-400' },
];

export default function PipelinePage() {
  const token = useAuthStore(s => s.accessToken);
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState('');
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

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
    if (removingId) return;
    setRemovingId(entryId);
    try {
      await api.delete(`/api/pipeline/${entryId}`, { headers: authHeaders() });
      setEntries(prev => prev.filter(e => e._id !== entryId));
    } catch (err) {
      console.error('Failed to remove from pipeline:', err);
    } finally {
      setRemovingId(null);
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
          <h1 className="text-2xl font-bold text-zinc-100">Candidate Pipeline</h1>
          <p className="text-zinc-400 text-sm mt-1">Drag candidates between stages</p>
        </div>
        <div className="flex gap-3 items-center">
          <select
            value={selectedJob}
            onChange={e => setSelectedJob(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors"
          >
            <option value="">All Jobs</option>
            {jobs.map(j => (
              <option key={j._id} value={j._id}>{j.title}</option>
            ))}
          </select>
          <Link href="/recruiter/dashboard" className="text-sm text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
        </div>
      </div>

      {loading && <p className="text-zinc-500 text-sm">Loading pipeline...</p>}

      {!loading && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map(stage => (
            <div
              key={stage.id}
              className="flex-shrink-0 w-64 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-3 min-h-[400px]"
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(stage.id)}
            >
              {/* Colored accent stripe */}
              <div className={`h-1 ${stage.accentColor} rounded-full mb-3`} />
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-zinc-200">{stage.label}</h3>
                <span className="text-xs text-zinc-500 bg-white/5 px-1.5 py-0.5 rounded">
                  {entriesByStage(stage.id).length}
                </span>
              </div>

              <div className="space-y-2">
                {entriesByStage(stage.id).map(entry => (
                  <div
                    key={entry._id}
                    draggable
                    onDragStart={() => handleDragStart(entry._id)}
                    className="bg-white/5 border border-white/10 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-purple-500/50 hover:shadow-[0_0_15px_rgba(168,85,247,0.1)] transition-all duration-200"
                  >
                    <p className="font-medium text-sm text-zinc-200">{entry.candidateId.name}</p>
                    <p className="text-xs text-zinc-500">{entry.candidateId.email}</p>
                    <p className="text-xs text-zinc-600 mt-1">{entry.jobRoleId.title}</p>
                    {entry.notes && (
                      <p className="text-xs text-zinc-500 mt-2 italic border-t border-white/5 pt-1">{entry.notes}</p>
                    )}
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[10px] text-zinc-600">
                        {new Date(entry.updatedAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => void handleRemove(entry._id)}
                        disabled={removingId !== null}
                        className={`text-[10px] transition-colors ${
                          removingId === entry._id
                            ? 'text-rose-400/60 cursor-not-allowed'
                            : removingId !== null
                              ? 'text-rose-400/30 cursor-not-allowed'
                              : 'text-rose-400/60 hover:text-rose-400'
                        }`}
                      >
                        {removingId === entry._id ? 'Removing...' : 'Remove'}
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
        <p className="text-zinc-500 text-sm text-center">
          No candidates in the pipeline yet. Candidates will appear here after their interviews are completed.
        </p>
      )}
    </div>
  );
}
