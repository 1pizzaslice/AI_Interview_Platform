import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center space-y-4 max-w-sm">
        <FileQuestion className="w-12 h-12 text-zinc-500 mx-auto" />
        <p className="text-6xl font-bold text-gradient">404</p>
        <h1 className="text-2xl font-bold text-zinc-100">Page not found</h1>
        <p className="text-zinc-400 text-sm">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-2 bg-gradient-to-r from-purple-500 to-violet-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-violet-600 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all duration-200"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
