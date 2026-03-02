'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/cn';
import { Circle, Loader2 } from 'lucide-react';

interface InterviewConfig {
  maxTopics: number;
  warmupQuestions: number;
  maxFollowUps: number;
  estimatedDurationMinutes: number;
}

interface Job {
  _id: string;
  title: string;
  domain: string;
  experienceLevel: string;
  requiredSkills: string[];
  interviewConfig: InterviewConfig | null;
  isActive: boolean;
  createdAt: string;
}

const EXPERIENCE_LEVELS = ['junior', 'mid', 'senior', 'staff'];

export default function JobsPage() {
  const token = useAuthStore(s => s.accessToken);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', requiredSkills: '', experienceLevel: 'mid', domain: '', topicAreas: '',
  });
  const [configForm, setConfigForm] = useState<InterviewConfig>({
    maxTopics: 5, warmupQuestions: 2, maxFollowUps: 2, estimatedDurationMinutes: 30,
  });
  const [saving, setSaving] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  function authHeaders() {
    return { Authorization: `Bearer ${token}` };
  }

  useEffect(() => {
    api.get<{ data: Job[] }>('/api/jobs', { headers: authHeaders() })
      .then(r => setJobs(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        requiredSkills: form.requiredSkills.split(',').map(s => s.trim()).filter(Boolean),
        experienceLevel: form.experienceLevel,
        domain: form.domain,
        topicAreas: form.topicAreas.split(',').map(s => s.trim()).filter(Boolean),
      };
      if (showConfig) {
        payload.interviewConfig = configForm;
      }
      const { data } = await api.post<{ data: Job }>('/api/jobs', payload, { headers: authHeaders() });
      setJobs(prev => [data.data, ...prev]);
      setShowForm(false);
      setForm({ title: '', description: '', requiredSkills: '', experienceLevel: 'mid', domain: '', topicAreas: '' });
      setConfigForm({ maxTopics: 5, warmupQuestions: 2, maxFollowUps: 2, estimatedDurationMinutes: 30 });
      setShowConfig(false);
    } catch {
      setError('Failed to create job.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(jobId: string) {
    if (deactivatingId) return;
    setDeactivatingId(jobId);
    try {
      await api.delete(`/api/jobs/${jobId}`, { headers: authHeaders() });
      setJobs(prev => prev.map(j => j._id === jobId ? { ...j, isActive: false } : j));
    } catch {
      console.error('Failed to deactivate job');
    } finally {
      setDeactivatingId(null);
    }
  }

  const input = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const configInput = (field: keyof InterviewConfig) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setConfigForm(f => ({ ...f, [field]: parseInt(e.target.value, 10) || 0 }));

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">Job Roles</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-500 text-white rounded-lg text-sm font-medium hover:from-purple-600 hover:to-violet-600 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all duration-200">
          {showForm ? 'Cancel' : '+ New Job'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-zinc-100">Create Job Role</h2>
          {[
            { label: 'Title', field: 'title' as const, type: 'text' },
            { label: 'Domain (e.g. backend, ml)', field: 'domain' as const, type: 'text' },
            { label: 'Required Skills (comma-separated)', field: 'requiredSkills' as const, type: 'text' },
            { label: 'Topic Areas (comma-separated)', field: 'topicAreas' as const, type: 'text' },
          ].map(({ label, field, type }) => (
            <div key={field}>
              <label className="block text-sm font-medium text-zinc-400 mb-1">{label}</label>
              <input type={type} required value={form[field]} onChange={input(field)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-colors" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Experience Level</label>
            <select value={form.experienceLevel} onChange={input('experienceLevel')}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-colors">
              {EXPERIENCE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Description</label>
            <textarea required value={form.description} onChange={input('description')} rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 resize-none transition-colors" />
          </div>

          {/* Interview Config Toggle */}
          <div className="border-t border-white/10 pt-4">
            <button type="button" onClick={() => setShowConfig(!showConfig)}
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
              {showConfig ? 'Hide' : 'Customize'} Interview Settings
            </button>
          </div>

          {showConfig && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-medium text-zinc-300">Interview Configuration</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Max Topics (1-15)</label>
                  <input type="number" min={1} max={15} value={configForm.maxTopics} onChange={configInput('maxTopics')}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Warmup Questions (0-5)</label>
                  <input type="number" min={0} max={5} value={configForm.warmupQuestions} onChange={configInput('warmupQuestions')}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Max Follow-Ups per Q (0-5)</label>
                  <input type="number" min={0} max={5} value={configForm.maxFollowUps} onChange={configInput('maxFollowUps')}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Est. Duration (min)</label>
                  <input type="number" min={10} max={90} value={configForm.estimatedDurationMinutes} onChange={configInput('estimatedDurationMinutes')}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors" />
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-rose-400 text-sm">{error}</p>}
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-500 text-white rounded-lg text-sm font-medium hover:from-purple-600 hover:to-violet-600 disabled:opacity-50 transition-all duration-200">
            {saving ? 'Creating...' : 'Create Job'}
          </button>
        </form>
      )}

      {loading && <p className="text-zinc-500 text-sm">Loading...</p>}
      <div className="space-y-2">
        {jobs.map(job => (
          <div key={job._id} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-zinc-100">{job.title}</p>
              <p className="text-sm text-zinc-400">
                {job.domain} · {job.experienceLevel}
                {job.interviewConfig && (
                  <span className="text-zinc-500">
                    {' '}· {job.interviewConfig.maxTopics} topics, ~{job.interviewConfig.estimatedDurationMinutes}min
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1.5 border ${job.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-zinc-500 border-white/10'}`}>
                <Circle className={`w-2 h-2 ${job.isActive ? 'fill-emerald-400 text-emerald-400' : 'fill-zinc-500 text-zinc-500'}`} />
                {job.isActive ? 'Active' : 'Inactive'}
              </span>
              {job.isActive && (
                <button
                  onClick={() => void handleDeactivate(job._id)}
                  disabled={deactivatingId !== null}
                  className={cn(
                    'text-xs transition-colors flex items-center gap-1',
                    deactivatingId === job._id
                      ? 'text-rose-400/60 cursor-not-allowed'
                      : deactivatingId !== null
                        ? 'text-rose-400/40 cursor-not-allowed'
                        : 'text-rose-400 hover:text-rose-300',
                  )}
                >
                  {deactivatingId === job._id && <Loader2 className="w-3 h-3 animate-spin" />}
                  {deactivatingId === job._id ? 'Deactivating...' : 'Deactivate'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
