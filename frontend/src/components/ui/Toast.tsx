'use client';

import { useEffect, useState, useCallback, useRef, createContext, useContext, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastMessage['type'], message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const borderColors: Record<string, string> = {
  success: 'border-l-emerald-400',
  error: 'border-l-rose-400',
  warning: 'border-l-amber-400',
  info: 'border-l-blue-400',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast: t, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const removeTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Enter: mount with visible=false, then set visible=true on next frame
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Auto-dismiss after 4s
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      removeTimerRef.current = setTimeout(() => onRemove(t.id), 300);
    }, 4000);
    return () => {
      clearTimeout(timer);
      if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
    };
  }, [t.id, onRemove]);

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg text-sm font-medium bg-white/10 backdrop-blur-xl border border-white/10 text-zinc-100 border-l-4',
        borderColors[t.type],
      )}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }}
    >
      {t.message}
    </div>
  );
}
