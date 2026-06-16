-- 1) search_path explícito nas funções restantes
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.audit_trigger()  SET search_path = public;

-- 2) RLS nas partições do audit_log (herdam políticas mas precisam ser ligadas)
ALTER TABLE public.audit_log_2026_04 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log_2026_05 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log_2026_06 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log_default ENABLE ROW LEVEL SECURITY;

-- Policies idênticas ao pai em cada partição
CREATE POLICY "audit_admin_ctrl_select" ON public.audit_log_2026_04 FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'));
CREATE POLICY "audit_admin_ctrl_select" ON public.audit_log_2026_05 FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'));
CREATE POLICY "audit_admin_ctrl_select" ON public.audit_log_2026_06 FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'));
CREATE POLICY "audit_admin_ctrl_select" ON public.audit_log_default FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria'));

-- 3) Revogar EXECUTE público de funções SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text, public.app_acao)  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_trigger()                              FROM PUBLIC, anon, authenticated;

-- has_role / has_permission só para usuários autenticados
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, public.app_acao) TO authenticated;