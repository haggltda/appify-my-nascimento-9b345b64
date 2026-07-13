-- FIX: excluir um usuário responsável por plano_acao manual falhava com
-- "responsavel_obrigatorio_em_plano_manual".
--
-- Causa: a FK plano_acao.responsavel_profile_id é ON DELETE SET NULL
-- (20260709000001_libera_exclusao_usuario_set_null.sql, pra nunca travar
-- exclusão de usuário), mas o UPDATE interno que essa FK dispara pra zerar
-- a coluna passava pelo trigger tg_plano_acao_valida_responsaveis
-- (20260603020636...sql), que bloqueava QUALQUER INSERT/UPDATE deixando
-- responsavel_profile_id nulo num plano manual — inclusive esse.
--
-- Fix: a exigência de responsável em plano manual passa a valer só na
-- CRIAÇÃO (TG_OP = 'INSERT') — mantém o comportamento de "Nova ação" que
-- já bloqueia no client. Se o responsável de um plano manual já existente
-- for excluído depois, o plano não trava nem perde dado: fica marcado
-- pendencia_responsavel = true, mesmo indicador que Lista/Dashboard já
-- usam pra planos importados sem vínculo.

CREATE OR REPLACE FUNCTION public.tg_plano_acao_valida_responsaveis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ativo boolean;
BEGIN
  -- (A) Plano manual exige responsável só na criação
  IF TG_OP = 'INSERT' AND NEW.origem = 'manual' AND NEW.responsavel_profile_id IS NULL THEN
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
    -- (C) Sem vínculo permanece pendente (legado/importado OU manual que
    -- perdeu o responsável, ex.: usuário excluído)
    NEW.pendencia_responsavel := true;
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
