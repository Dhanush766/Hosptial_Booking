import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api, getToken, setToken } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // If a token is stored we must ask the server who it belongs to before rendering pages.
  const [loading, setLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me/")
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  // api.js fires this event when the server answers 401 (expired or revoked token).
  useEffect(() => {
    const onExpired = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await api.post("/auth/login/", { username, password });
    setToken(data.token);
    setUser({ username: data.username, is_staff: data.is_staff });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout/");
    } catch {
      /* even if the server is unreachable we still forget the token locally */
    }
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
