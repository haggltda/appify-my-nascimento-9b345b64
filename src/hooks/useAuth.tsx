import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1) Listener primeiro (evita perder eventos)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      // Preserva a referência se o usuário é o mesmo - evita re-renders em contextos
      // que dependem de `user` (PermissoesContext, EmpresaAtivaContext) a cada token refresh.
      setUser(prev => {
        const next = newSession?.user ?? null;
        if (prev?.id && next?.id && prev.id === next.id) return prev;
        return next;
      });
    });

    // 2) Sessão inicial
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(prev => {
        const next = data.session?.user ?? null;
        if (prev?.id && next?.id && prev.id === next.id) return prev;
        return next;
      });
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
