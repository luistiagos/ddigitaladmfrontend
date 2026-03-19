import axios from 'axios';
import { getToken, clearAdmin } from '@/utils/auth';

const BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({ baseURL: BASE_URL });

// Inject JWT on every request
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      clearAdmin();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
