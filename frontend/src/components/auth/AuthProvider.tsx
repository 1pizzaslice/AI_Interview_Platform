'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user);

  // Sync auth state to a cookie so middleware can check authentication.
  // The actual auth validation happens via JWT on the API side —
  // this cookie is just a hint for route protection in middleware.
  useEffect(() => {
    if (user) {
      document.cookie = `auth-hint=${JSON.stringify({ role: user.role })}; path=/; SameSite=Lax`;
    } else {
      document.cookie = 'auth-hint=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
  }, [user]);

  return <>{children}</>;
}
