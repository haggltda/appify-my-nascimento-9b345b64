-- =========================================================================
-- FIX: exclusão lógica de plano_acao via UPDATE direto sob RLS falhava
--
-- Mesmo após corrigir o WITH CHECK de pa_update (20260623000001), o soft
-- delete (UPDATE ... SET deleted_at = now()) continuava violando RLS.
--
-- Causa: para UPDATE, o Postgres exige que a linha resultante também
-- satisfaça a policy de SELECT da tabela (pa_select), além da própria
-- policy de UPDATE. pa_select exige deleted_at IS NULL — logo, a própria
-- ação de marcar deleted_at torna a linha resultante "inválida" para a
-- policy de SELECT, e o UPDATE é rejeitado como violação de RLS.
--
-- Soft delete é estruturalmente incompatível com uma policy de SELECT que
-- esconde linhas deletadas, quando feito via UPDATE direto do client sob
-- RLS. A solução, no mesmo padrão já usado para criação (criar_plano_acao),
-- é mover a exclusão para uma função SECURITY DEFINER: ela valida a
-- permissão explicitamente e executa o UPDATE como owner da função
-- (BYPASSRLS), sem depender da policy de SELECT sobre a linha resultante.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.excluir_plano_acao(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_empresa_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'nao_autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT empresa_id INTO v_empresa_id
    FROM public.plano_acao
   WHERE id = _id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'plano_acao_nao_encontrado' USING ERRCODE = '42501';
  END IF;

  IF NOT (
        public.user_pode_atuar_empresa(v_uid, v_empresa_id)
    AND public.plano_acao_can_access(v_uid, v_empresa_id, 'editar')
    AND public.plano_acao_visible_by_user(v_uid, _id)
  ) THEN
    RAISE EXCEPTION 'sem_permissao_excluir_plano_acao' USING ERRCODE = '42501';
  END IF;

  UPDATE public.plano_acao
     SET deleted_at = now(), atualizado_por = v_uid
   WHERE id = _id;
END;
$$;

REVOKE ALL ON FUNCTION public.excluir_plano_acao(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.excluir_plano_acao(uuid) TO authenticated;
