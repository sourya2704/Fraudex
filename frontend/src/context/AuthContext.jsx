/**
 * AuthContext
 *
 * Single source of truth for authentication state.
 *
 * Strategy:
 *   - JWT token is stored in memory (setMemoryToken) for every API call.
 *   - If "remember me" was checked at login, the token is ALSO persisted in
 *     localStorage so the session survives a page reload.
 *   - On mount we check localStorage for a saved token, validate it against
 *     /auth/me, and restore the session silently.
 *   - On logout we call /auth/logout (clears the HttpOnly cookie on the server),
 *     clear memory + localStorage, and send the user to /login.
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient, { clearMemoryToken, setMemoryToken } from "../api/client";

const LS_KEY = "fraudex-token";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();

  // null  = unknown (still loading)
  // false = definitely not logged in
  // object = logged-in user { id, name, email, role }
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true while we check saved token

  // ── Restore session on mount ─────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    if (!saved) {
      setLoading(false);
      return;
    }

    // Put the token in memory so the API interceptor sends it
    setMemoryToken(saved);

    apiClient
      .get("/auth/me")
      .then(({ data }) => {
        setUser(data);
      })
      .catch(() => {
        // Token expired or invalid — clean up silently
        localStorage.removeItem(LS_KEY);
        clearMemoryToken();
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Login ────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password, remember) => {
    const { data } = await apiClient.post("/auth/login", { email, password });
    const token = data.access_token;

    setMemoryToken(token);
    if (remember) {
      localStorage.setItem(LS_KEY, token);
    }

    // Fetch full user profile
    const { data: me } = await apiClient.get("/auth/me");
    setUser(me);
    return me;
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // Best-effort — clear local state regardless
    }
    clearMemoryToken();
    localStorage.removeItem(LS_KEY);
    setUser(false);
    navigate("/login", { replace: true });
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Convenience hook — throws if used outside AuthProvider */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
