-- =========================================================================
-- BACKFILL: propaga plano_acao_usuario_permissao para todas as empresas
-- que cada usuário tem acesso.
--
-- Problema: a tela de ACL (Configurações — Plano de Ações) salvava a
-- permissão usando a empresa ATIVA de quem estava configurando (o admin),
-- não as empresas em que o usuário-alvo de fato atua. Resultado: um usuário
-- com "acesso total" marcado no painel via um admin com empresa X ativa
-- só tinha a permissão de fato aplicada na empresa X — em qualquer outra
-- empresa (inclusive aquelas em que esse usuário realmente trabalha), a
-- RLS estrita de plano_acao não encontrava entrada e ele via 0 registros.
--
-- Esta migration copia, para cada linha já existente em
-- plano_acao_usuario_permissao, as mesmas flags para todas as demais
-- empresas que aquele profile_id tem acesso (via user_empresa,
-- profiles.empresa_id ou acessa_todas_empresas = true). Quando já existe
-- uma linha na empresa de destino, mantém o "mais permissivo" (OR lógico)
-- em vez de sobrescrever.
-- =========================================================================

DO $$
DECLARE
  r RECORD;
  v_empresa_id uuid;
BEGIN
  FOR r IN SELECT * FROM public.plano_acao_usuario_permissao LOOP
    FOR v_empresa_id IN
      SELECT ue.empresa_id FROM public.user_empresa ue WHERE ue.user_id = r.profile_id
      UNION
      SELECT p.empresa_id FROM public.profiles p WHERE p.id = r.profile_id AND p.empresa_id IS NOT NULL
      UNION
      SELECT e.id FROM public.empresas e
        WHERE e.ativa = true
          AND EXISTS (
            SELECT 1 FROM public.profiles p2
            WHERE p2.id = r.profile_id AND p2.acessa_todas_empresas = true
          )
    LOOP
      IF v_empresa_id IS DISTINCT FROM r.empresa_id THEN
        INSERT INTO public.plano_acao_usuario_permissao (
          empresa_id, profile_id, pode_visualizar, pode_dashboard, pode_criar, pode_editar,
          pode_excluir, pode_importar, pode_aprovar, pode_administrar, pode_ver_todas
        ) VALUES (
          v_empresa_id, r.profile_id, r.pode_visualizar, r.pode_dashboard, r.pode_criar, r.pode_editar,
          r.pode_excluir, r.pode_importar, r.pode_aprovar, r.pode_administrar, r.pode_ver_todas
        )
        ON CONFLICT (empresa_id, profile_id) DO UPDATE SET
          pode_visualizar  = plano_acao_usuario_permissao.pode_visualizar  OR EXCLUDED.pode_visualizar,
          pode_dashboard   = plano_acao_usuario_permissao.pode_dashboard   OR EXCLUDED.pode_dashboard,
          pode_criar       = plano_acao_usuario_permissao.pode_criar       OR EXCLUDED.pode_criar,
          pode_editar      = plano_acao_usuario_permissao.pode_editar      OR EXCLUDED.pode_editar,
          pode_excluir     = plano_acao_usuario_permissao.pode_excluir     OR EXCLUDED.pode_excluir,
          pode_importar    = plano_acao_usuario_permissao.pode_importar    OR EXCLUDED.pode_importar,
          pode_aprovar     = plano_acao_usuario_permissao.pode_aprovar     OR EXCLUDED.pode_aprovar,
          pode_administrar = plano_acao_usuario_permissao.pode_administrar OR EXCLUDED.pode_administrar,
          pode_ver_todas   = plano_acao_usuario_permissao.pode_ver_todas   OR EXCLUDED.pode_ver_todas;
      END IF;
    END LOOP;
  END LOOP;
END $$;
