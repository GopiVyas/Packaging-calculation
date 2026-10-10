import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

// Holds the logged-in user, their company (org) and what their plan allows (entitlements).
export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading, null = logged out

  const refresh = useCallback(async () => {
    try {
      setSession(await api.get('/auth/me'));
    } catch {
      setSession(null);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email, password) => setSession(await api.post('/auth/login', { email, password }));
  const signup = async (data) => setSession(await api.post('/auth/signup', data));
  const logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    setSession(null);
  };

  return <AuthContext.Provider value={{ session, login, signup, logout, refresh }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** true when the current plan includes a feature, e.g. can('suggest') */
export function useCan() {
  const { session } = useAuth();
  return (feature) => !!session?.entitlements?.features?.[feature];
}
