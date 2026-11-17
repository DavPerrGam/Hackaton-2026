import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import axiosClient from '../api/axiosClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('ideapro_admin_token');
    if (!token) {
      setCargando(false);
      return;
    }
    axiosClient
      .get('/auth/me')
      .then((res) => setAdmin(res.data.admin))
      .catch(() => localStorage.removeItem('ideapro_admin_token'))
      .finally(() => setCargando(false));
  }, []);

  const login = useCallback(async (correo, password) => {
    const { data } = await axiosClient.post('/auth/login', { correo, password });
    localStorage.setItem('ideapro_admin_token', data.token);
    setAdmin(data.admin);
    return data.admin;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('ideapro_admin_token');
    setAdmin(null);
  }, []);

  return (
    <AuthContext.Provider value={{ admin, cargando, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
