import { createContext, useContext, useState, useCallback } from 'react';
import api from '@/services/api';
import { storeAdmin, clearAdmin, getStoredAdmin, isAuthenticated } from '@/utils/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(() => (isAuthenticated() ? getStoredAdmin() : null));

  const login = useCallback(async (email, password) => {
    const res = await api.post('/admin/auth/login', { email, password });
    const { token, user } = res.data;
    storeAdmin(user, token);
    setAdmin(user);
    return user;
  }, []);

  const logout = useCallback(() => {
    clearAdmin();
    setAdmin(null);
  }, []);

  return (
    <AuthContext.Provider value={{ admin, login, logout, isAuthenticated: !!admin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
