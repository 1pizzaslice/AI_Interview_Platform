'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/cn';
import { FileUp, Briefcase, Loader2, Brain, MessageSquare, BarChart3 } from 'lucide-react';

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
  const [selectingJobId, setSelectingJobId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);

  const tips = [
    'Tip: Take a moment to collect your thoughts before each answer',
    'Tip: It\'s okay to ask the AI to repeat or clarify a question',
    'Tip: Speak naturally — there are no trick questions',
    'Fun fact: Our AI adapts question difficulty based on your responses',
    'Tip: Use specific examples from your experience when answering',
  ];

  useEffect(() => {
    if (!selectingJobId) return;
    const interval = setInterval(() => {
      setTipIndex(prev => (prev + 1) % tips.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [selectingJobId, tips.length]);

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
    if (selectingJobId) return;
    setSelectingJobId(jobId);
    setError('');
    try {
      const { data } = await api.post<{ data: { _id: string } }>(
        '/api/interviews',
        { jobRoleId: jobId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      router.push(`/candidate/interview/${data.data._id}`);
    } catch {
      setSelectingJobId(null);
      setError('Failed to create interview session.');
    }
  }

  if (step === 'jobs') {
    if (selectingJobId) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="text-center space-y-8 max-w-md">
            <div className="relative mx-auto w-16 h-16">
              <div className="absolute inset-0 rounded-full border-2 border-purple-500/20" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-500 animate-spin" />
              <div className="absolute inset-3 rounded-full border-2 border-transparent border-t-violet-400 animate-spin [animation-direction:reverse] [animation-duration:1.5s]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-100">Setting up your interview...</h2>
              <p className="text-sm text-zinc-500 mt-2">Generating personalized questions from your resume</p>
            </div>
            <p className="text-sm text-zinc-400 transition-opacity duration-500">{tips[tipIndex]}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen p-8 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Choose a Role</h1>
          <p className="text-zinc-400 mt-1">Select the position you want to interview for.</p>
        </div>
        {error && <p className="text-rose-400 text-sm">{error}</p>}
        <div className="space-y-3">
          {jobs.length === 0 && <p className="text-zinc-500">No open positions available.</p>}
          {jobs.map(job => (
            <button
              key={job._id}
              onClick={() => void handleSelectJob(job._id)}
              className="w-full text-left bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 transition-all duration-200 active:scale-[0.98] hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.1)]"
            >
              <div className="flex items-center gap-3">
                <Briefcase className="w-5 h-5 text-purple-400 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-zinc-100">{job.title}</div>
                  <div className="text-sm text-zinc-400 mt-1">
                    {job.domain} · {job.experienceLevel} · {job.requiredSkills.slice(0, 3).join(', ')}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Upload Your Resume</h1>
        <p className="text-zinc-400 mt-1">
          We&apos;ll use your resume to generate personalized interview questions.
        </p>
      </div>

      <form onSubmit={handleResumeUpload} className="space-y-4">
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault();
            setDragging(false);
            const dropped = e.dataTransfer.files[0];
            if (dropped) setFile(dropped);
          }}
          className={cn(
            'border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200',
            dragging
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-white/10 hover:border-purple-500/30 hover:bg-white/[0.02]',
          )}
        >
          <input
            type="file"
            accept=".pdf,.txt,.doc,.docx"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
            id="resume-input"
          />
          <label htmlFor="resume-input" className="cursor-pointer">
            <FileUp className="w-12 h-12 text-purple-400 mx-auto mb-4" />
            <p className="font-medium text-zinc-200">{file ? file.name : 'Click or drag your resume here'}</p>
            <p className="text-sm text-zinc-500 mt-1">PDF, TXT, DOC, DOCX up to 10MB</p>
          </label>
        </div>

        {error && <p className="text-rose-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={!file || uploading}
          className="w-full bg-gradient-to-r from-purple-500 to-violet-500 text-white py-2.5 rounded-lg font-medium hover:from-purple-600 hover:to-violet-600 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] disabled:opacity-50 transition-all duration-200"
        >
          {uploading ? 'Parsing resume...' : 'Continue'}
        </button>
      </form>

      <div className="grid grid-cols-3 gap-4 pt-2">
        <div className="text-center space-y-2">
          <Brain className="w-6 h-6 text-purple-400 mx-auto" />
          <p className="text-xs text-zinc-400">AI-powered resume parsing</p>
        </div>
        <div className="text-center space-y-2">
          <MessageSquare className="w-6 h-6 text-purple-400 mx-auto" />
          <p className="text-xs text-zinc-400">Personalized interview questions</p>
        </div>
        <div className="text-center space-y-2">
          <BarChart3 className="w-6 h-6 text-purple-400 mx-auto" />
          <p className="text-xs text-zinc-400">Detailed performance report</p>
        </div>
      </div>
    </div>
  );
}
