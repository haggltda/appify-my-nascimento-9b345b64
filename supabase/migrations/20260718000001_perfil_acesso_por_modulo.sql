-- Perfil automático por módulo — elimina o passo manual de montar um perfil
-- na mão pra cada módulo novo.
--
-- perfil_acesso.modulo_codigo: quando preenchido, o perfil deixa de ser uma
-- lista de permissões marcada na mão e vira um ESPELHO DINÂMICO do módulo
-- inteiro — libera qualquer menu que pertença àquele app_modulo, em
-- QUALQUER ação (não fixamos visualizar/incluir/alterar/etc. — a regra de
-- negócio de cada bloco é quem decide o que aquela ação realmente permite,
-- isso não é papel desta função). Cobre as duas pontas pedidas:
--   • módulo novo → trigger cria o perfil na hora, já pronto pra atribuir.
--   • bloco novo num módulo existente → quem já tem esse perfil ganha
--     sozinho, porque é um JOIN dinâmico com app_menu.modulo_id, não uma
--     lista estática de menu_codigo.
--
-- Os outros dois mecanismos continuam intocados: concede_tudo
-- (Administrador Geral) e os perfis "Legado: <cargo>" (linhas específicas em
-- perfil_acesso_permissao, do backfill da Fase 1).

-- IF NOT EXISTS torna a migration inteira segura de rodar de novo do zero,
-- mesmo que uma tentativa anterior tenha parado no meio (ex.: deadlock
-- transitório por causa de alguém com /app/administracao aberto ao vivo
-- enquanto a migration rodava — o CREATE TRIGGER mais abaixo precisa de
-- lock exclusivo em app_modulo, que colide com as consultas normais da
-- página; se acontecer de novo, é só rodar este arquivo mais uma vez).
ALTER TABLE public.perfil_acesso
  ADD COLUMN IF NOT EXISTS modulo_codigo text UNIQUE REFERENCES public.app_modulo(codigo) ON DELETE SET NULL;

-- Backfill: cria o perfil-espelho pra todo módulo que já existe hoje.
INSERT INTO public.perfil_acesso (nome, descricao, modulo_codigo)
SELECT mo.nome, 'Acesso completo a este módulo — perfil gerado automaticamente.', mo.codigo
FROM public.app_modulo mo
WHERE NOT EXISTS (
  SELECT 1 FROM public.perfil_acesso pa WHERE pa.modulo_codigo = mo.codigo
);

-- Trigger: todo app_modulo novo dali pra frente já nasce com o perfil pronto.
CREATE OR REPLACE FUNCTION public.criar_perfil_acesso_do_modulo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfil_acesso (nome, descricao, modulo_codigo)
  VALUES (NEW.nome, 'Acesso completo a este módulo — perfil gerado automaticamente.', NEW.codigo)
  ON CONFLICT (modulo_codigo) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_criar_perfil_acesso_do_modulo ON public.app_modulo;
CREATE TRIGGER trg_criar_perfil_acesso_do_modulo
  AFTER INSERT ON public.app_modulo
  FOR EACH ROW EXECUTE FUNCTION public.criar_perfil_acesso_do_modulo();

-- Reescrita de has_screen_access: adiciona a checagem de perfil "módulo
-- inteiro" entre concede_tudo e o perfil comum (linhas específicas).
CREATE OR REPLACE FUNCTION public.has_screen_access(
  _user    uuid,
  _menu    text,
  _acao    public.app_acao,
  _empresa uuid DEFAULT NULL
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

  -- 1. Exceção individual (mais recente vence)
  SELECT allow INTO v_allow
    FROM public.screen_permission_user
   WHERE user_id    = _user
     AND menu_codigo = _menu
     AND acao        = _acao
   ORDER BY updated_at DESC
   LIMIT 1;
  IF FOUND THEN RETURN v_allow; END IF;

  -- 2. Perfil "concede tudo" (Administrador Geral)
  IF EXISTS (
    SELECT 1
      FROM public.usuario_perfil_acesso upa
      JOIN public.perfil_acesso pa ON pa.id = upa.perfil_id AND pa.ativo = true AND pa.concede_tudo = true
     WHERE upa.user_id = _user
  ) THEN
    RETURN true;
  END IF;

  -- 3. Perfil "módulo inteiro" — libera qualquer ação, o bloco decide o que
  --    fazer com ela.
  IF EXISTS (
    SELECT 1
      FROM public.usuario_perfil_acesso upa
      JOIN public.perfil_acesso pa ON pa.id = upa.perfil_id AND pa.ativo = true AND pa.modulo_codigo IS NOT NULL
      JOIN public.app_menu am ON am.codigo = _menu
      JOIN public.app_modulo mo ON mo.id = am.modulo_id AND mo.codigo = pa.modulo_codigo
     WHERE upa.user_id = _user
  ) THEN
    RETURN true;
  END IF;

  -- 4. Perfil comum (linhas específicas em perfil_acesso_permissao — hoje
  --    só os perfis "Legado: <cargo>" do backfill da Fase 1 usam isto)
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

-- Reescrita de list_accessible_menus: mesmo critério adicional.
CREATE OR REPLACE FUNCTION public.list_accessible_menus(
  _user    uuid,
  _acao    text DEFAULT 'visualizar',
  _empresa uuid DEFAULT NULL
)
RETURNS TABLE(menu_codigo text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH
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
    SELECT am.codigo AS menu_codigo, mo.codigo AS modulo_codigo
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
  modulos_liberados AS (
    SELECT DISTINCT pa.modulo_codigo
      FROM public.usuario_perfil_acesso upa
      JOIN public.perfil_acesso pa ON pa.id = upa.perfil_id AND pa.ativo = true AND pa.modulo_codigo IS NOT NULL
      CROSS JOIN params p
     WHERE upa.user_id = p.user_id
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
    LEFT JOIN override_resolved  o  ON o.menu_codigo = am.menu_codigo
    LEFT JOIN profile_resolved   pr ON pr.menu_codigo = am.menu_codigo
    LEFT JOIN modulos_liberados  ml ON ml.modulo_codigo = am.modulo_codigo
    CROSS JOIN concede_tudo ct
   WHERE COALESCE(o.allow, ct.ok OR pr.menu_codigo IS NOT NULL OR ml.modulo_codigo IS NOT NULL) IS TRUE;
$$;

-- can_access/tem_acesso_menu não mudam — já são wrappers finos de
-- has_screen_access (migration 20260717200003), então ganham o novo
-- comportamento automaticamente.

-- Rollback: reaplicar has_screen_access/list_accessible_menus de
-- 20260717200003_rewrite_gate_functions_perfil_acesso.sql, e
-- ALTER TABLE perfil_acesso DROP COLUMN modulo_codigo (derruba o trigger
-- junto, via DROP TRIGGER/FUNCTION manual se necessário).

NOTIFY pgrst, 'reload schema';
