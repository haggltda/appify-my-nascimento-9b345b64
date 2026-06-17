-- Migration: 20260617000001_fix_plano_acao_pa_select_visibility
-- Objetivo: Garantir que a policy pa_select da tabela plano_acao
--   (a) respeite o campo visibilidade (privado / publico / especifico)
--   (b) não tenha bypass por role/cargo (nem admin, nem qualquer outro)
--
-- Acesso a linhas determinado exclusivamente pelas flags de permissão
-- do módulo (plano_acao_usuario_permissao) e pelo campo visibilidade
-- de cada ação individualmente.

-- Remove qualquer versão anterior da policy
DROP POLICY IF EXISTS pa_select ON public.plano_acao;

-- Recria com lógica completa de visibilidade e sem bypass de role
CREATE POLICY pa_select ON public.plano_acao
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.user_pode_atuar_empresa(auth.uid(), empresa_id)
    AND (
      -- Administradores do módulo (pode_ver_todas ou pode_administrar) enxergam tudo na empresa
      EXISTS (
        SELECT 1
          FROM public.plano_acao_usuario_permissao pap
         WHERE pap.profile_id  = auth.uid()
           AND pap.empresa_id  = plano_acao.empresa_id
           AND (pap.pode_ver_todas = true OR pap.pode_administrar = true)
      )
      -- Criador sempre enxerga a própria ação
      OR criado_por = auth.uid()
      -- Responsável designado sempre enxerga
      OR responsavel_profile_id = auth.uid()
      -- Visibilidade pública: qualquer usuário da empresa com acesso ao módulo
      OR visibilidade = 'publico'
      -- Visibilidade específica: apenas quem está na lista explícita
      OR (
        visibilidade = 'especifico'
        AND EXISTS (
          SELECT 1
            FROM public.plano_acao_visibilidade_usuario pav
           WHERE pav.plano_acao_id = plano_acao.id
             AND pav.profile_id    = auth.uid()
        )
      )
      -- visibilidade = 'privado' (ou null): só criador e responsável, cobertos acima
    )
  );
