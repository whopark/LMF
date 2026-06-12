import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../utils/helpers.jsx';

const AuthContext = createContext(null);

const TOKEN_KEY = 'lmf_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      axios.get(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => setUser({ ...res.data, token }))
        .catch(() => localStorage.removeItem(TOKEN_KEY))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (name, password) => {
    const res = await axios.post(`${API_BASE}/auth/login`, { name, password });
    const { token, user: u } = res.data;
    localStorage.setItem(TOKEN_KEY, token);
    setUser({ ...u, token });
    return u;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  const authHeader = () =>
    user?.token ? { Authorization: `Bearer ${user.token}` } : {};

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, authHeader }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
