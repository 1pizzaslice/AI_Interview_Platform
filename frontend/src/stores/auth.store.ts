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
        set({ accessToken, refreshToken, user });
      },
      clearAuth: () => {
        localStorage.removeItem('accessToken');
        set({ accessToken: null, refreshToken: null, user: null });
      },
    }),
    { name: 'auth-storage' },
  ),
);
