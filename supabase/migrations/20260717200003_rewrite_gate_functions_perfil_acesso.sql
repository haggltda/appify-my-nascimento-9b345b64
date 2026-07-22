-- FASE 1 (redesenho de acessos) — Reescrita das 4 funções de gate
--
-- ATENÇÃO: só rode isto depois de confirmar que a migration de backfill
-- (20260717200002) já rodou com sucesso — sem ela, admins e cargos com
-- permissão hoje perdem acesso no instante em que isto for aplicado.
--
-- Ordem de resolução, igual nas 4 funções: exceção individual
-- (screen_permission_user, mais recente vence, empresa deixa de importar)
-- > perfil "concede_tudo" > perfil comum (perfil_acesso_permissao) > nega.
-- Nenhuma das 4 olha mais has_role(), role_permissions ou
-- screen_permission_profile diretamente — essas 2 últimas continuam
-- existindo só como histórico (já foram convertidas em perfis no backfill).
--
-- ROLLBACK (definições anteriores, caso precise reverter esta migration):
--
-- has_screen_access (20260612000001_fix_has_screen_access_admin_bypass.sql)
-- can_access        (20260528005858_a4be8e0f-8dca-43c7-82c3-8cacfb0020c4.sql)
-- list_accessible_menus (20260612000004_list_accessible_menus_sem_admin_bypass.sql)
-- tem_acesso_menu   (20260619000001_modulo_sistemas_solicitacoes_erp.sql, linha 58)
-- (íntegras nesses arquivos, não repetidas aqui por brevidade)

CREATE OR REPLACE FUNCTION public.list_accessible_menus(
  _user    uuid,
  _acao    text DEFAULT 'visualizar',
  _empresa uuid DEFAULT NULL -- mantido só por compat de assinatura (várias chamadas existentes passam empresa); ignorado
)
RETURNS TABLE(menu_codigo text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH
  -- Só o próprio usuário ou um admin consulta o acesso de terceiros (usado
  -- pelo painel "Acesso por Usuário" pra mostrar o efetivo de OUTRO usuário
  -- selecionado). Isso é permissão de FERRAMENTA administrativa, não é o
  -- "cargo concede acesso a tela" que estamos eliminando.
  params AS (
    SELECT
      _user                  AS user_id,
      _acao::public.app_acao AS acao
    WHERE _user = auth.uid()
       OR EXISTS (
            SELECT 1 FROM public.user_roles
             WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
          )
  ),
  active_menus AS (
    SELECT am.codigo AS menu_codigo
      FROM public.app_menu   am
      JOIN public.app_modulo mo ON mo.id = am.modulo_id
     WHERE am.ativo = true
  ),
  override_resolved AS (
    SELECT DISTINCT ON (spu.menu_codigo)
           spu.menu_codigo, spu.allow
      FROM public.screen_permission_user spu
      CROSS JOIN params p
     WHERE spu.user_id = p.user_id
       AND spu.acao    = p.acao
     ORDER BY spu.menu_codigo, spu.updated_at DESC
  ),
  concede_tudo AS (
    SELECT EXISTS (
      SELECT 1
        FROM public.usuario_perfil_acesso upa
        JOIN public.perfil_acesso pa ON pa.id = upa.perfil_id AND pa.ativo = true AND pa.concede_tudo = true
        CROSS JOIN params p
       WHERE upa.user_id = p.user_id
    ) AS ok
  ),
  profile_resolved AS (
    SELECT DISTINCT pap.menu_codigo
      FROM public.usuario_perfil_acesso upa
      JOIN public.perfil_acesso pa ON pa.id = upa.perfil_id AND pa.ativo = true
      JOIN public.perfil_acesso_permissao pap ON pap.perfil_id = pa.id AND pap.allow = true
      CROSS JOIN params p
     WHERE upa.user_id = p.user_id
       AND pap.acao    = p.acao
  )
  SELECT DISTINCT am.menu_codigo
    FROM active_menus am
    LEFT JOIN override_resolved o  ON o.menu_codigo = am.menu_codigo
    LEFT JOIN profile_resolved  pr ON pr.menu_codigo = am.menu_codigo
    CROSS JOIN concede_tudo ct
   WHERE COALESCE(o.allow, ct.ok OR pr.menu_codigo IS NOT NULL) IS TRUE;
$$;

CREATE OR REPLACE FUNCTION public.has_screen_access(
  _user    uuid,
  _menu    text,
  _acao    public.app_acao,
  _empresa uuid DEFAULT NULL -- ignorado, mantido por compat de assinatura
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allow boolean;
BEGIN
  IF _user IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Exceção individual (mais recente vence, empresa não é mais fator)
  SELECT allow INTO v_allow
    FROM public.screen_permission_user
   WHERE user_id    = _user
     AND menu_codigo = _menu
     AND acao        = _acao
   ORDER BY updated_at DESC
   LIMIT 1;
  IF FOUND THEN RETURN v_allow; END IF;

  -- 2. Perfil "concede tudo" (substitui o antigo has_role(admin) bypass)
  IF EXISTS (
    SELECT 1
      FROM public.usuario_perfil_acesso upa
      JOIN public.perfil_acesso pa ON pa.id = upa.perfil_id AND pa.ativo = true AND pa.concede_tudo = true
     WHERE upa.user_id = _user
  ) THEN
    RETURN true;
  END IF;

  -- 3. União dos perfis de acesso comuns atribuídos ao usuário
  RETURN EXISTS (
    SELECT 1
      FROM public.usuario_perfil_acesso upa
      JOIN public.perfil_acesso pa ON pa.id = upa.perfil_id AND pa.ativo = true
      JOIN public.perfil_acesso_permissao pap ON pap.perfil_id = pa.id
     WHERE upa.user_id     = _user
       AND pap.menu_codigo = _menu
       AND pap.acao        = _acao
       AND pap.allow       = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access(
  _user    uuid,
  _menu    text,
  _acao    app_acao DEFAULT 'visualizar'::app_acao,
  _empresa uuid DEFAULT NULL::uuid, -- ignorado
  _modulo  text DEFAULT NULL::text  -- ignorado, o menu já resolve seu módulo
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN _user IS NULL OR _menu IS NULL OR btrim(_menu) = '' THEN false
    WHEN NOT EXISTS (SELECT 1 FROM public.app_menu WHERE codigo = _menu AND ativo = true) THEN false
    ELSE public.has_screen_access(_user, _menu, _acao, NULL)
  END;
$$;

CREATE OR REPLACE FUNCTION public.tem_acesso_menu(_menu_codigo text, _acao text DEFAULT 'visualizar')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.has_screen_access(auth.uid(), _menu_codigo, _acao::public.app_acao, NULL);
$$;

NOTIFY pgrst, 'reload schema';
