"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface AuthUser {
  name: string; // iniciales en mayúsculas, <= 10 chars
}

export interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean; // true tras leer localStorage en cliente (evita mismatch de hidratación)
  signIn: (name: string) => void; // guarda av_user
  signOut: () => void; // borra av_user
}

const STORAGE_KEY = "av_user";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as AuthUser | null) : null;
      if (parsed && typeof parsed.name === "string") setUser(parsed);
    } catch {
      // localStorage no disponible (modo privado) o JSON corrupto: seguimos sin usuario
    }
    setReady(true);
  }, []);

  const signIn = useCallback((name: string) => {
    const next: AuthUser = { name: (name || "PLAYER1").toUpperCase().slice(0, 10) };
    setUser(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // sin persistencia: la sesión vive solo en memoria
    }
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // nada que limpiar
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
