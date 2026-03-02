import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id: string;
  name: string;
  role: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  setAuth: (accessToken: string, refreshToken: string, user: AuthUser) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setAuth: (accessToken, refreshToken, user) => {
        localStorage.setItem('accessToken', accessToken);
        document.cookie = `auth-hint=${JSON.stringify({ role: user.role })}; path=/; SameSite=Lax`;
        set({ accessToken, refreshToken, user });
      },
      clearAuth: () => {
        localStorage.removeItem('accessToken');
        document.cookie = 'auth-hint=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        set({ accessToken: null, refreshToken: null, user: null });
      },
    }),
    { name: 'auth-storage' },
  ),
);
