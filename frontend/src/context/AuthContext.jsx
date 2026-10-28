// ─────────────────────────────────────────────────────────────
// AuthContext — the single source of truth for who is logged in.
// The session lives in an httpOnly cookie on the server; here we
// only keep the user object in memory (never in localStorage).
// ─────────────────────────────────────────────────────────────

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { authApi, AUTH_EXPIRED_EVENT, setCsrfToken } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ── Restore the session on first load ─────────────────────
  useEffect(() => {
    let cancelled = false;

    authApi
      .me()
      .then((res) => {
        if (!cancelled) setUser(res.data.user);
      })
      .catch(() => {
        // 401 / network error → treated as logged out
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Server says the session expired → sign out of the UI ──
  useEffect(() => {
    const handleExpired = () => {
      setCsrfToken('');
      setUser(null);
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
  }, []);

  // ── Actions (errors propagate as ApiError for the pages) ──
  const login = useCallback(async (email, password) => {
    const res = await authApi.login({ email, password });
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const signup = useCallback(async (name, email, password) => {
    const res = await authApi.signup({ name, email, password });
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Even if the request fails, clear the local state.
    }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoggedIn: !!user,
      isAdmin: user?.role === 'admin',
      authLoading,
      login,
      signup,
      logout,
    }),
    [user, authLoading, login, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }

  return context;
}

export default AuthContext;