-- P2.A FINAL v3 — Responsável canônico no Plano de Ações
-- Trigger de validação + RPC segura para listar usuários elegíveis

-- ============ 1) Função de validação ============
CREATE OR REPLACE FUNCTION public.tg_plano_acao_valida_responsaveis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ativo boolean;
BEGIN
  -- (A) Plano manual exige responsável em INSERT e UPDATE
  IF NEW.origem = 'manual' AND NEW.responsavel_profile_id IS NULL THEN
    RAISE EXCEPTION 'responsavel_obrigatorio_em_plano_manual'
      USING ERRCODE = '23514';
  END IF;

  -- (B) Validação canônica do responsável
  IF NEW.responsavel_profile_id IS NOT NULL THEN
    SELECT ativo INTO v_ativo
      FROM public.profiles
     WHERE id = NEW.responsavel_profile_id;

    IF NOT FOUND OR v_ativo IS NOT TRUE THEN
      RAISE EXCEPTION 'responsavel_inativo_ou_inexistente'
        USING ERRCODE = '23514';
    END IF;

    IF NOT public.user_pode_atuar_empresa(NEW.responsavel_profile_id, NEW.empresa_id) THEN
      RAISE EXCEPTION 'responsavel_fora_da_empresa'
        USING ERRCODE = '23514';
    END IF;

    NEW.pendencia_responsavel := false;
  ELSE
    -- (C) Legado/importado sem vínculo permanece pendente
    IF NEW.origem <> 'manual' THEN
      NEW.pendencia_responsavel := true;
    END IF;
  END IF;

  -- (D) Líder de comitê (quando preenchido)
  IF NEW.lider_comite_profile_id IS NOT NULL THEN
    SELECT ativo INTO v_ativo
      FROM public.profiles
     WHERE id = NEW.lider_comite_profile_id;

    IF NOT FOUND OR v_ativo IS NOT TRUE THEN
      RAISE EXCEPTION 'lider_comite_inativo_ou_inexistente'
        USING ERRCODE = '23514';
    END IF;

    IF NOT public.user_pode_atuar_empresa(NEW.lider_comite_profile_id, NEW.empresa_id) THEN
      RAISE EXCEPTION 'lider_comite_fora_da_empresa'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- (E) Líder de setor (quando preenchido)
  IF NEW.lider_setor_profile_id IS NOT NULL THEN
    SELECT ativo INTO v_ativo
      FROM public.profiles
     WHERE id = NEW.lider_setor_profile_id;

    IF NOT FOUND OR v_ativo IS NOT TRUE THEN
      RAISE EXCEPTION 'lider_setor_inativo_ou_inexistente'
        USING ERRCODE = '23514';
    END IF;

    IF NOT public.user_pode_atuar_empresa(NEW.lider_setor_profile_id, NEW.empresa_id) THEN
      RAISE EXCEPTION 'lider_setor_fora_da_empresa'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_plano_acao_valida_responsaveis() FROM PUBLIC;

-- ============ 2) Trigger em qualquer INSERT/UPDATE ============
DROP TRIGGER IF EXISTS plano_acao_valida_resp_biu ON public.plano_acao;

CREATE TRIGGER plano_acao_valida_resp_biu
BEFORE INSERT OR UPDATE
ON public.plano_acao
FOR EACH ROW
EXECUTE FUNCTION public.tg_plano_acao_valida_responsaveis();

-- ============ 3) RPC list_usuarios_empresa ============
DROP FUNCTION IF EXISTS public.list_usuarios_empresa(uuid);

CREATE OR REPLACE FUNCTION public.list_usuarios_empresa(_empresa_id uuid)
RETURNS TABLE (id uuid, display_name text, email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  IF auth.uid() IS NULL
     OR _empresa_id IS NULL
     OR NOT public.user_pode_atuar_empresa(auth.uid(), _empresa_id)
     OR NOT (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.plano_acao_can_access(auth.uid(), _empresa_id, 'criar')
          OR public.plano_acao_can_access(auth.uid(), _empresa_id, 'editar')
        )
  THEN
    RAISE EXCEPTION 'sem_permissao_para_listar_usuarios_empresa'
      USING ERRCODE = '42501';
  END IF;

  v_is_admin := public.has_role(auth.uid(), 'admin'::public.app_role);

  RETURN QUERY
  WITH elegiveis AS (
    SELECT DISTINCT p.id, p.display_name, p.email
      FROM public.profiles p
     WHERE p.ativo = true
       AND (
         p.empresa_id = _empresa_id
         OR p.acessa_todas_empresas = true
         OR EXISTS (
           SELECT 1 FROM public.user_empresa ue
            WHERE ue.user_id = p.id AND ue.empresa_id = _empresa_id
         )
       )
  )
  SELECT e.id,
         e.display_name,
         CASE WHEN v_is_admin THEN e.email ELSE NULL END
    FROM elegiveis e
   ORDER BY e.display_name NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.list_usuarios_empresa(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_usuarios_empresa(uuid) TO authenticated;