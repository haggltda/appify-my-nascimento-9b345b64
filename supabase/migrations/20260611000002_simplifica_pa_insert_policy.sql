-- Simplifica pa_insert: remove user_pode_atuar_empresa redundante.
-- plano_acao_can_access ja valida empresa internamente:
--   - admin bypass: retorna true sem checar empresa
--   - acessa_todas_empresas bypass: retorna true sem checar empresa
--   - perms basicas: ja chama user_pode_atuar_empresa internamente
--   - perms elevadas: ja chama user_pode_atuar_empresa internamente
-- Ter user_pode_atuar_empresa TAMBEM na policy causava 403 quando
-- plano_acao_can_access retornava true via bypass mas user_pode_atuar_empresa
-- falhava (ex: empresa_id NULL ou mismatch de contexto no authenticated role).

DROP POLICY IF EXISTS pa_insert ON public.plano_acao;
CREATE POLICY pa_insert ON public.plano_acao FOR INSERT TO authenticated
  WITH CHECK (
    public.plano_acao_can_access(auth.uid(), empresa_id, 'criar')
  );
