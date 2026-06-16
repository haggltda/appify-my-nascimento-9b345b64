
-- FASE 1A: Hardening RLS — sem perda de dados, sem DROP TABLE

-- 1) fornecedor_conta_bancaria: remover policy permissiva USING (true)
DROP POLICY IF EXISTS "auth read fornecedor_conta_bancaria" ON public.fornecedor_conta_bancaria;

-- 2) empresas
DROP POLICY IF EXISTS empresas_select_auth ON public.empresas;
CREATE POLICY empresas_select_scoped
ON public.empresas
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.user_can_see_empresa(id)
);

-- 3) role_permissions
DROP POLICY IF EXISTS rp_select_auth ON public.role_permissions;
CREATE POLICY rp_select_scoped
ON public.role_permissions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), role)
);

-- 4) screen_permission_profile
DROP POLICY IF EXISTS spp_select ON public.screen_permission_profile;
CREATE POLICY spp_select_scoped
ON public.screen_permission_profile
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'diretor_adm'::app_role)
  OR public.has_role(auth.uid(), role)
);

-- 5) ia_provedores
DROP POLICY IF EXISTS iap_select ON public.ia_provedores;
CREATE POLICY iap_select_admin
ON public.ia_provedores
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 6) saldos_iniciais_caixa
DROP POLICY IF EXISTS "auth read saldos iniciais" ON public.saldos_iniciais_caixa;
CREATE POLICY saldos_iniciais_caixa_select_scoped
ON public.saldos_iniciais_caixa
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.user_can_see_empresa(empresa_id)
);
