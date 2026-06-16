import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useMustChangePassword(userId?: string | null) {
  const [mustChange, setMustChange] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);

  const fetchFlag = useCallback(async () => {
    if (!userId) {
      setMustChange(false);
      setCheckedUserId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("must_change_password")
      .eq("id", userId)
      .maybeSingle();
    if (!error) setMustChange(!!data?.must_change_password);
    setCheckedUserId(userId);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchFlag(); }, [fetchFlag]);

  return { mustChange, loading: loading || (!!userId && checkedUserId !== userId), refetch: fetchFlag };
}
