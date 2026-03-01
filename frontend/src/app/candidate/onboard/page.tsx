'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

interface Job {
  _id: string;
  title: string;
  domain: string;
  experienceLevel: string;
  requiredSkills: string[];
}

export default function OnboardPage() {
  const router = useRouter();
  const token = useAuthStore(s => s.accessToken);
  const [step, setStep] = useState<'resume' | 'jobs'>('resume');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState('');

  async function handleResumeUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('resume', file);
      await api.post('/api/candidates/resume', form, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });

      // Load available jobs
      const { data } = await api.get<{ data: Job[] }>('/api/jobs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setJobs(data.data);
      setStep('jobs');
    } catch {
      setError('Failed to upload resume. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSelectJob(jobId: string) {
    try {
      const { data } = await api.post<{ data: { _id: string } }>(
        '/api/interviews',
        { jobRoleId: jobId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      router.push(`/candidate/interview/${data.data._id}`);
    } catch {
      setError('Failed to create interview session.');
    }
  }

  if (step === 'jobs') {
    return (
      <div className="min-h-screen p-8 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Choose a Role</h1>
          <p className="text-gray-500 mt-1">Select the position you want to interview for.</p>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="space-y-3">
          {jobs.length === 0 && <p className="text-gray-500">No open positions available.</p>}
          {jobs.map(job => (
            <button
              key={job._id}
              onClick={() => void handleSelectJob(job._id)}
              className="w-full text-left border border-gray-200 rounded-lg p-4 hover:border-brand-500 hover:bg-brand-50 transition-colors"
            >
              <div className="font-semibold">{job.title}</div>
              <div className="text-sm text-gray-500 mt-1">
                {job.domain} · {job.experienceLevel} · {job.requiredSkills.slice(0, 3).join(', ')}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload Your Resume</h1>
        <p className="text-gray-500 mt-1">
          We&apos;ll use your resume to generate personalized interview questions.
        </p>
      </div>

      <form onSubmit={handleResumeUpload} className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <input
            type="file"
            accept=".pdf,.txt,.doc,.docx"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
            id="resume-input"
          />
          <label htmlFor="resume-input" className="cursor-pointer">
            <div className="text-4xl mb-2">📄</div>
            <p className="text-sm font-medium">{file ? file.name : 'Click to select your resume'}</p>
            <p className="text-xs text-gray-400 mt-1">PDF, TXT, DOC, DOCX up to 10MB</p>
          </label>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={!file || uploading}
          className="w-full bg-brand-600 text-white py-2 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {uploading ? 'Parsing resume...' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
