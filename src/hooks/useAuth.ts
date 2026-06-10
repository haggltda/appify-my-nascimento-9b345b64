import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1) Listener primeiro (evita perder eventos)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      console.log('[useAuth] authStateChange:', _event, new Date().toISOString());
      setSession(newSession);
      // Preserva a referência se o usuário é o mesmo — evita re-renders em contextos
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

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { session, user, loading, signOut };
}
