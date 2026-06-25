-- Corrige RLS da planilha_custo: adiciona WITH CHECK explícito para INSERT
-- e política separada para que usuários membros de múltiplas empresas
-- possam inserir em qualquer empresa à qual pertencem.

DROP POLICY IF EXISTS "empresa_isolation" ON public.planilha_custo;

-- Leitura/edição/exclusão: apenas registros da empresa do usuário
CREATE POLICY "planilha_custo_select_update_delete"
  ON public.planilha_custo
  FOR ALL
  USING (
    empresa_id IN (
      SELECT empresa_id FROM public.user_empresa WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    empresa_id IN (
      SELECT empresa_id FROM public.user_empresa WHERE user_id = auth.uid()
    )
  );
