"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

export interface AuthUser {
  id: string;
  name: string; // "Nombre de arcade" del perfil, <= 10 chars en mayúsculas
}

export interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean; // true tras resolver la sesión en cliente (evita mismatch de hidratación)
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    // onAuthStateChange emite INITIAL_SESSION al suscribirse y luego cada
    // login/logout/refresh. El callback es síncrono a propósito (las llamadas
    // async van por .then) para no bloquear el cliente de Supabase.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id;
      if (!uid) {
        if (active) {
          setUser(null);
          setReady(true);
        }
        return;
      }
      supabase
        .from("profiles")
        .select("name")
        .eq("id", uid)
        .maybeSingle()
        .then(({ data }) => {
          if (!active) return;
          setUser({ id: uid, name: data?.name ?? "PLAYER" });
          setReady(true);
        });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, ready, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
