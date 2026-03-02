import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import AuthProvider from '@/components/auth/AuthProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { NavigationProgressProvider } from '@/components/ui/NavigationProgress';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AI Interview Platform',
  description: 'Automated AI-powered technical interviews',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-zinc-950 text-zinc-100 antialiased`}>
        <AuthProvider>
          <ToastProvider>
            <NavigationProgressProvider>
              {children}
            </NavigationProgressProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
