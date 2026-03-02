import axios from 'axios';

export const api = axios.create({
  baseURL: typeof window !== 'undefined'
    ? ''   // browser: use Next.js rewrites → localhost:4000
    : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'),
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// Inject access token automatically if present in localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token && !config.headers['Authorization']) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});

// 401 Response interceptor — auto-refresh tokens
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: Error) => void;
}> = [];

function processQueue(error: Error | null, token: string | null) {
  for (const pending of failedQueue) {
    if (error) {
      pending.reject(error);
    } else {
      pending.resolve(token!);
    }
  }
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only intercept 401s, and don't retry refresh/login requests
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url?.includes('/api/auth/refresh') ||
      originalRequest.url?.includes('/api/auth/login')
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue this request until refresh completes
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers['Authorization'] = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Get refresh token from zustand persisted store
      const stored = localStorage.getItem('auth-storage');
      const refreshToken = stored ? JSON.parse(stored)?.state?.refreshToken : null;

      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      const { data } = await axios.post(
        `${api.defaults.baseURL}/api/auth/refresh`,
        { refreshToken },
        { headers: { 'Content-Type': 'application/json' } },
      );

      const newAccessToken = data.accessToken;
      const newRefreshToken = data.refreshToken;

      // Update localStorage for the request interceptor
      localStorage.setItem('accessToken', newAccessToken);

      // Update zustand store
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.state.accessToken = newAccessToken;
        parsed.state.refreshToken = newRefreshToken;
        localStorage.setItem('auth-storage', JSON.stringify(parsed));
      }

      processQueue(null, newAccessToken);

      // Retry original request with new token
      originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError as Error, null);

      // Clear auth and redirect to login
      localStorage.removeItem('accessToken');
      localStorage.removeItem('auth-storage');
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
