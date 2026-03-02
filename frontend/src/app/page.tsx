import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Animated gradient orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-purple-500/10 blur-[120px] animate-glow-pulse pointer-events-none" />

      <div className="max-w-2xl w-full text-center space-y-8 relative z-10 animate-fade-in-up">
        <div
          className="flex items-center justify-center gap-2 text-purple-400 animate-fade-in-up-sm"
          style={{ animationDelay: '0.2s' }}
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-sm font-medium tracking-wide uppercase">Powered by AI</span>
        </div>

        <h1
          className="text-5xl font-bold tracking-tight text-gradient animate-fade-in-up-sm"
          style={{ animationDelay: '0.3s' }}
        >
          AI Interview Platform
        </h1>

        <p
          className="text-lg text-zinc-400 animate-fade-in-up-sm"
          style={{ animationDelay: '0.4s' }}
        >
          Automated, intelligent technical interviews powered by AI.
        </p>

        <div
          className="flex gap-4 justify-center animate-fade-in-up-sm"
          style={{ animationDelay: '0.5s' }}
        >
          <Link
            href="/login"
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-violet-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-violet-600 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:scale-[1.02] transition-all duration-200"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="px-6 py-3 bg-white/5 backdrop-blur-xl border border-white/10 text-zinc-100 rounded-lg font-medium hover:bg-white/10 hover:border-purple-500/50 transition-all duration-200"
          >
            Register
          </Link>
        </div>
      </div>
    </main>
  );
}
