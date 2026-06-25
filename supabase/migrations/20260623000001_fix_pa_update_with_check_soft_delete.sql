-- =========================================================================
-- FIX: pa_update do plano_acao bloqueava a própria exclusão lógica
--
-- A policy pa_update (criada em 20260602231345) repetia
-- plano_acao_visible_by_user(auth.uid(), id) tanto no USING quanto no
-- WITH CHECK. Essa função retorna false sempre que deleted_at IS NOT NULL
-- (linha "IF NOT FOUND OR r.deleted_at IS NOT NULL THEN RETURN false").
--
-- O botão "Excluir" faz UPDATE plano_acao SET deleted_at = now(), ou seja,
-- a própria operação que a policy deveria autorizar é a que faz a
-- revalidação do WITH CHECK (avaliada contra a linha já modificada)
-- retornar false — autossabotagem da policy. Resultado: "new row violates
-- row-level security policy for table plano_acao" em qualquer exclusão,
-- para qualquer usuário (inclusive admin).
--
-- O USING já garante que a linha era visível/editável ANTES da mudança,
-- então não há necessidade de revalidar a visibilidade do estado
-- resultante (que é exatamente o que a exclusão lógica altera).
-- =========================================================================

DROP POLICY IF EXISTS pa_update ON public.plano_acao;

CREATE POLICY pa_update ON public.plano_acao FOR UPDATE TO authenticated
  USING (
        public.user_pode_atuar_empresa(auth.uid(), empresa_id)
    AND public.plano_acao_can_access(auth.uid(), empresa_id, 'editar')
    AND public.plano_acao_visible_by_user(auth.uid(), id))
  WITH CHECK (
        public.user_pode_atuar_empresa(auth.uid(), empresa_id)
    AND public.plano_acao_can_access(auth.uid(), empresa_id, 'editar'));
