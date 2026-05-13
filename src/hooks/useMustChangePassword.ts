import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useMustChangePassword() {
  const { user } = useAuth();
  const [mustChange, setMustChange] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchFlag = useCallback(async () => {
    if (!user) { setMustChange(false); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("must_change_password")
      .eq("id", user.id)
      .maybeSingle();
    if (!error) setMustChange(!!data?.must_change_password);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchFlag(); }, [fetchFlag]);

  return { mustChange, loading, refetch: fetchFlag };
}
