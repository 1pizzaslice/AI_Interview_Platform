'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

interface QuestionItem {
  text: string;
  topicArea: string;
  difficulty: string;
  followUpPrompts: string[];
}

interface QuestionBank {
  _id: string;
  name: string;
  jobRoleId: { _id: string; title: string; domain: string } | null;
  questions: QuestionItem[];
  createdAt: string;
}

interface Job {
  _id: string;
  title: string;
  domain: string;
}

const DIFFICULTIES = ['easy', 'medium', 'hard'];

export default function QuestionBanksPage() {
  const token = useAuthStore(s => s.accessToken);
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    jobRoleId: '',
    questions: [{ text: '', topicArea: '', difficulty: 'medium', followUpPrompts: ['', ''] }],
  });

  function authHeaders() {
    return { Authorization: `Bearer ${token}` };
  }

  useEffect(() => {
    Promise.all([
      api.get<{ data: QuestionBank[] }>('/api/question-banks', { headers: authHeaders() }),
      api.get<{ data: Job[] }>('/api/jobs', { headers: authHeaders() }),
    ]).then(([bRes, jRes]) => {
      setBanks(bRes.data.data);
      setJobs(jRes.data.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm() {
    setForm({ name: '', jobRoleId: '', questions: [{ text: '', topicArea: '', difficulty: 'medium', followUpPrompts: ['', ''] }] });
    setEditingId(null);
    setShowForm(false);
    setError('');
  }

  function addQuestion() {
    setForm(f => ({ ...f, questions: [...f.questions, { text: '', topicArea: '', difficulty: 'medium', followUpPrompts: ['', ''] }] }));
  }

  function removeQuestion(idx: number) {
    setForm(f => ({ ...f, questions: f.questions.filter((_, i) => i !== idx) }));
  }

  function updateQuestion(idx: number, field: string, value: string) {
    setForm(f => ({
      ...f,
      questions: f.questions.map((q, i) => i === idx ? { ...q, [field]: value } : q),
    }));
  }

  function updateFollowUp(qIdx: number, fuIdx: number, value: string) {
    setForm(f => ({
      ...f,
      questions: f.questions.map((q, i) =>
        i === qIdx ? { ...q, followUpPrompts: q.followUpPrompts.map((fu, j) => j === fuIdx ? value : fu) } : q,
      ),
    }));
  }

  function startEdit(bank: QuestionBank) {
    setForm({
      name: bank.name,
      jobRoleId: bank.jobRoleId?._id ?? '',
      questions: bank.questions.map(q => ({
        text: q.text,
        topicArea: q.topicArea,
        difficulty: q.difficulty,
        followUpPrompts: q.followUpPrompts.length >= 2 ? q.followUpPrompts.slice(0, 2) : [...q.followUpPrompts, ...Array(2 - q.followUpPrompts.length).fill('')],
      })),
    });
    setEditingId(bank._id);
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      name: form.name,
      jobRoleId: form.jobRoleId || undefined,
      questions: form.questions.filter(q => q.text.trim()).map(q => ({
        text: q.text.trim(),
        topicArea: q.topicArea.trim(),
        difficulty: q.difficulty,
        followUpPrompts: q.followUpPrompts.filter(f => f.trim()),
      })),
    };

    try {
      if (editingId) {
        const { data } = await api.patch<{ data: QuestionBank }>(`/api/question-banks/${editingId}`, payload, { headers: authHeaders() });
        setBanks(prev => prev.map(b => b._id === editingId ? data.data : b));
      } else {
        const { data } = await api.post<{ data: QuestionBank }>('/api/question-banks', payload, { headers: authHeaders() });
        setBanks(prev => [data.data, ...prev]);
      }
      resetForm();
    } catch {
      setError('Failed to save question bank.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/api/question-banks/${id}`, { headers: authHeaders() });
      setBanks(prev => prev.filter(b => b._id !== id));
    } catch {
      console.error('Failed to delete question bank');
    }
  }

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Question Banks</h1>
          <p className="text-gray-500 text-sm mt-1">Create reusable question sets for your jobs</p>
        </div>
        <div className="flex gap-3">
          <Link href="/recruiter/dashboard" className="text-sm text-brand-600 hover:underline self-center">
            Dashboard
          </Link>
          <button
            onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700"
          >
            {showForm ? 'Cancel' : '+ New Bank'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-white border rounded-lg p-6 space-y-4">
          <h2 className="font-semibold">{editingId ? 'Edit' : 'Create'} Question Bank</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text" required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Senior Backend Questions"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Link to Job (optional)</label>
              <select
                value={form.jobRoleId}
                onChange={e => setForm(f => ({ ...f, jobRoleId: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">No specific job</option>
                {jobs.map(j => (
                  <option key={j._id} value={j._id}>{j.title} ({j.domain})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Questions ({form.questions.length})</h3>
              <button type="button" onClick={addQuestion} className="text-sm text-brand-600 hover:underline">
                + Add Question
              </button>
            </div>

            {form.questions.map((q, qi) => (
              <div key={qi} className="border rounded-lg p-4 space-y-3 relative">
                {form.questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(qi)}
                    className="absolute top-2 right-2 text-xs text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                )}
                <div className="text-xs font-medium text-gray-400">Question {qi + 1}</div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Topic Area</label>
                    <input
                      type="text" required
                      value={q.topicArea}
                      onChange={e => updateQuestion(qi, 'topicArea', e.target.value)}
                      placeholder="e.g. System Design"
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Difficulty</label>
                    <select
                      value={q.difficulty}
                      onChange={e => updateQuestion(qi, 'difficulty', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Question Text</label>
                  <textarea
                    required
                    rows={2}
                    value={q.text}
                    onChange={e => updateQuestion(qi, 'text', e.target.value)}
                    placeholder="e.g. Walk me through how you'd design a real-time notification system..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {q.followUpPrompts.map((fu, fi) => (
                    <div key={fi}>
                      <label className="block text-xs text-gray-500 mb-1">Follow-up {fi + 1}</label>
                      <input
                        type="text"
                        value={fu}
                        onChange={e => updateFollowUp(qi, fi, e.target.value)}
                        placeholder="Optional follow-up question"
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
            {saving ? 'Saving...' : editingId ? 'Update Bank' : 'Create Bank'}
          </button>
        </form>
      )}

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}
      {!loading && banks.length === 0 && !showForm && (
        <p className="text-gray-500 text-sm">No question banks yet. Create one to get started.</p>
      )}

      <div className="space-y-3">
        {banks.map(bank => (
          <div key={bank._id} className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-medium">{bank.name}</h3>
                <p className="text-xs text-gray-500">
                  {bank.questions.length} question{bank.questions.length !== 1 ? 's' : ''}
                  {bank.jobRoleId ? ` · ${bank.jobRoleId.title}` : ' · No linked job'}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(bank)} className="text-xs text-brand-600 hover:underline">
                  Edit
                </button>
                <button onClick={() => void handleDelete(bank._id)} className="text-xs text-red-600 hover:underline">
                  Delete
                </button>
              </div>
            </div>
            <div className="space-y-1">
              {bank.questions.map((q, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 mt-0.5">{q.difficulty}</span>
                  <span className="text-xs text-gray-400 mt-0.5">[{q.topicArea}]</span>
                  <span className="flex-1">{q.text}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
