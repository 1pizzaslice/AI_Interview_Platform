'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

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
    try {
      await api.delete(`/api/jobs/${jobId}`, { headers: authHeaders() });
      setJobs(prev => prev.map(j => j._id === jobId ? { ...j, isActive: false } : j));
    } catch {
      console.error('Failed to deactivate job');
    }
  }

  const input = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const configInput = (field: keyof InterviewConfig) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setConfigForm(f => ({ ...f, [field]: parseInt(e.target.value, 10) || 0 }));

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Job Roles</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700">
          {showForm ? 'Cancel' : '+ New Job'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border rounded-lg p-6 space-y-4">
          <h2 className="font-semibold">Create Job Role</h2>
          {[
            { label: 'Title', field: 'title' as const, type: 'text' },
            { label: 'Domain (e.g. backend, ml)', field: 'domain' as const, type: 'text' },
            { label: 'Required Skills (comma-separated)', field: 'requiredSkills' as const, type: 'text' },
            { label: 'Topic Areas (comma-separated)', field: 'topicAreas' as const, type: 'text' },
          ].map(({ label, field, type }) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1">{label}</label>
              <input type={type} required value={form[field]} onChange={input(field)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium mb-1">Experience Level</label>
            <select value={form.experienceLevel} onChange={input('experienceLevel')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              {EXPERIENCE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea required value={form.description} onChange={input('description')} rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          {/* Interview Config Toggle */}
          <div className="border-t pt-4">
            <button type="button" onClick={() => setShowConfig(!showConfig)}
              className="text-sm text-brand-600 hover:underline">
              {showConfig ? 'Hide' : 'Customize'} Interview Settings
            </button>
          </div>

          {showConfig && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-medium">Interview Configuration</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max Topics (1-15)</label>
                  <input type="number" min={1} max={15} value={configForm.maxTopics} onChange={configInput('maxTopics')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Warmup Questions (0-5)</label>
                  <input type="number" min={0} max={5} value={configForm.warmupQuestions} onChange={configInput('warmupQuestions')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max Follow-Ups per Q (0-5)</label>
                  <input type="number" min={0} max={5} value={configForm.maxFollowUps} onChange={configInput('maxFollowUps')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Est. Duration (min)</label>
                  <input type="number" min={10} max={90} value={configForm.estimatedDurationMinutes} onChange={configInput('estimatedDurationMinutes')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
            {saving ? 'Creating...' : 'Create Job'}
          </button>
        </form>
      )}

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}
      <div className="space-y-2">
        {jobs.map(job => (
          <div key={job._id} className="bg-white border rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{job.title}</p>
              <p className="text-sm text-gray-500">
                {job.domain} · {job.experienceLevel}
                {job.interviewConfig && (
                  <span className="text-gray-400">
                    {' '}· {job.interviewConfig.maxTopics} topics, ~{job.interviewConfig.estimatedDurationMinutes}min
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-1 rounded-full ${job.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {job.isActive ? 'Active' : 'Inactive'}
              </span>
              {job.isActive && (
                <button onClick={() => void handleDeactivate(job._id)}
                  className="text-xs text-red-600 hover:underline">
                  Deactivate
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
