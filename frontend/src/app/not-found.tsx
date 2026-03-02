import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center space-y-4 max-w-sm">
        <p className="text-6xl font-bold text-gray-300">404</p>
        <h1 className="text-2xl font-bold text-gray-900">Page not found</h1>
        <p className="text-gray-500 text-sm">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
