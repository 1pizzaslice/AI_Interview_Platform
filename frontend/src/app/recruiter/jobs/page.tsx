'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

interface Job {
  _id: string;
  title: string;
  domain: string;
  experienceLevel: string;
  requiredSkills: string[];
  isActive: boolean;
  createdAt: string;
}

const EXPERIENCE_LEVELS = ['junior', 'mid', 'senior', 'staff'];

export default function JobsPage() {
  const token = useAuthStore(s => s.accessToken);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', requiredSkills: '', experienceLevel: 'mid', domain: '', topicAreas: '',
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
      const { data } = await api.post<{ data: Job }>('/api/jobs', {
        title: form.title,
        description: form.description,
        requiredSkills: form.requiredSkills.split(',').map(s => s.trim()).filter(Boolean),
        experienceLevel: form.experienceLevel,
        domain: form.domain,
        topicAreas: form.topicAreas.split(',').map(s => s.trim()).filter(Boolean),
      }, { headers: authHeaders() });
      setJobs(prev => [data.data, ...prev]);
      setShowForm(false);
      setForm({ title: '', description: '', requiredSkills: '', experienceLevel: 'mid', domain: '', topicAreas: '' });
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
              <p className="text-sm text-gray-500">{job.domain} · {job.experienceLevel}</p>
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
