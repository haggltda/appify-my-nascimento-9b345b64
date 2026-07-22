-- Corrige 2 colisões reais de menu_codigo, achadas ao ligar o RouteGuard:
-- app_menu.codigo só é único POR MÓDULO (UNIQUE (modulo_id, codigo)), não
-- globalmente — mas has_screen_access/can_access/list_accessible_menus
-- comparam o código sozinho, sem saber de qual módulo é. Duas telas
-- diferentes com o mesmo código compartilham a mesma permissão sem querer.
--
-- 1) 'aprovacoes': Licitações (/app/aprovacoes) x Suprimentos
--    (/app/suprimentos/aprovacoes, tabelas sup_aprov_*). Confirmado que as
--    duas RLS já usam can_access(...,'aprovacoes',...) — colisão real de
--    permissão, não só de cadastro. Renomeamos o lado Suprimentos.
--
-- 2) 'principal': BI (/app/bi) x Fiscal (/app/fiscal). Confirmado
--    (pg_policies) que NENHUMA tabela real depende de 'principal' hoje —
--    Fiscal ainda está 100% no modelo antigo (has_role), a migration que
--    portaria pra can_access(...,'fiscal-principal',...) nunca rodou em
--    produção. Por isso este rename aqui é só de cadastro (app_menu), sem
--    nenhuma RLS pra tocar — mas já deixa o código certo (fiscal-principal)
--    pronto pro dia em que a RLS do Fiscal for migrada de verdade.

-- ── 1) Suprimentos: aprovacoes -> suprimentos_aprovacoes ────────────────

UPDATE public.app_menu
SET codigo = 'suprimentos_aprovacoes'
WHERE codigo = 'aprovacoes'
  AND modulo_id = (SELECT id FROM public.app_modulo WHERE codigo = 'suprimentos');

-- Preserva o efetivo atual: qualquer perfil/usuário que já tinha 'aprovacoes'
-- concedido continua com a mesma permissão agora sob o código novo (os dois
-- códigos ficam com o mesmo estado no instante da migration; a partir daqui
-- podem ser geridos independentemente em "Acesso por Usuário").
INSERT INTO public.perfil_acesso_permissao (perfil_id, menu_codigo, acao, allow)
SELECT perfil_id, 'suprimentos_aprovacoes', acao, allow
FROM public.perfil_acesso_permissao
WHERE menu_codigo = 'aprovacoes'
ON CONFLICT (perfil_id, menu_codigo, acao) DO NOTHING;

INSERT INTO public.screen_permission_user (user_id, menu_codigo, acao, allow, empresa_id)
SELECT user_id, 'suprimentos_aprovacoes', acao, allow, empresa_id
FROM public.screen_permission_user
WHERE menu_codigo = 'aprovacoes'
ON CONFLICT (user_id, menu_codigo, acao, empresa_id) DO NOTHING;

DROP POLICY IF EXISTS fluxo_select ON public.sup_aprov_fluxo;
CREATE POLICY fluxo_select ON public.sup_aprov_fluxo FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'suprimentos_aprovacoes', 'visualizar'::app_acao));
DROP POLICY IF EXISTS fluxo_write ON public.sup_aprov_fluxo;
CREATE POLICY fluxo_write ON public.sup_aprov_fluxo FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'suprimentos_aprovacoes', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'suprimentos_aprovacoes', 'alterar'::app_acao));

DROP POLICY IF EXISTS etapa_select ON public.sup_aprov_etapa;
CREATE POLICY etapa_select ON public.sup_aprov_etapa FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'suprimentos_aprovacoes', 'visualizar'::app_acao));
DROP POLICY IF EXISTS etapa_write ON public.sup_aprov_etapa;
CREATE POLICY etapa_write ON public.sup_aprov_etapa FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'suprimentos_aprovacoes', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'suprimentos_aprovacoes', 'alterar'::app_acao));

DROP POLICY IF EXISTS inst_select ON public.sup_aprov_instancia;
CREATE POLICY inst_select ON public.sup_aprov_instancia FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'suprimentos_aprovacoes', 'visualizar'::app_acao) OR solicitante_user_id = auth.uid());
DROP POLICY IF EXISTS inst_insert ON public.sup_aprov_instancia;
CREATE POLICY inst_insert ON public.sup_aprov_instancia FOR INSERT TO authenticated
  WITH CHECK (public.can_access(auth.uid(), 'suprimentos_aprovacoes', 'incluir'::app_acao));
DROP POLICY IF EXISTS inst_update ON public.sup_aprov_instancia;
CREATE POLICY inst_update ON public.sup_aprov_instancia FOR UPDATE TO authenticated
  USING (public.can_access(auth.uid(), 'suprimentos_aprovacoes', 'aprovar'::app_acao));

DROP POLICY IF EXISTS voto_select ON public.sup_aprov_voto;
CREATE POLICY voto_select ON public.sup_aprov_voto FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'suprimentos_aprovacoes', 'visualizar'::app_acao));

-- ── 2) Fiscal: principal -> fiscal-principal (só cadastro, sem RLS hoje) ─

UPDATE public.app_menu
SET codigo = 'fiscal-principal'
WHERE codigo = 'principal'
  AND modulo_id = (SELECT id FROM public.app_modulo WHERE codigo = 'fiscal');

NOTIFY pgrst, 'reload schema';
