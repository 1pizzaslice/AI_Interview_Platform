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
