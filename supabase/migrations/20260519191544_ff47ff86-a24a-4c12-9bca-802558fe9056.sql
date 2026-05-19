-- Onda 3: Fornecedor Global
ALTER TABLE public.fornecedor
  ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false;

-- Índice único parcial para CNPJ global
CREATE UNIQUE INDEX IF NOT EXISTS fornecedor_cnpj_global_uniq
  ON public.fornecedor(cnpj_cpf) WHERE is_global = true;

-- Recria policies
DROP POLICY IF EXISTS forn_select ON public.fornecedor;
DROP POLICY IF EXISTS forn_write ON public.fornecedor;

CREATE POLICY forn_select ON public.fornecedor
  FOR SELECT
  USING (
    is_global = true
    OR empresa_id = public.get_user_empresa(auth.uid())
    OR public.user_can_see_empresa(empresa_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY forn_insert ON public.fornecedor
  FOR INSERT
  WITH CHECK (
    (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'controladoria'::app_role)
      OR public.has_role(auth.uid(), 'diretor_adm'::app_role)
      OR public.has_role(auth.uid(), 'financeiro'::app_role)
      OR public.has_role(auth.uid(), 'comprador'::app_role)
      OR public.has_role(auth.uid(), 'fiscal_recebedor'::app_role)
    )
    AND (
      -- Globais só admin/controladoria/diretor_adm
      (is_global = false)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'controladoria'::app_role)
      OR public.has_role(auth.uid(), 'diretor_adm'::app_role)
    )
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR is_global = true
      OR empresa_id = public.get_user_empresa(auth.uid())
      OR public.user_can_see_empresa(empresa_id)
    )
  );

CREATE POLICY forn_update ON public.fornecedor
  FOR UPDATE
  USING (
    (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'controladoria'::app_role)
      OR public.has_role(auth.uid(), 'diretor_adm'::app_role)
      OR public.has_role(auth.uid(), 'financeiro'::app_role)
      OR public.has_role(auth.uid(), 'comprador'::app_role)
      OR public.has_role(auth.uid(), 'fiscal_recebedor'::app_role)
    )
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR is_global = true
      OR empresa_id = public.get_user_empresa(auth.uid())
      OR public.user_can_see_empresa(empresa_id)
    )
  )
  WITH CHECK (
    (
      (is_global = false)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'controladoria'::app_role)
      OR public.has_role(auth.uid(), 'diretor_adm'::app_role)
    )
  );

CREATE POLICY forn_delete ON public.fornecedor
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'controladoria'::app_role)
    OR public.has_role(auth.uid(), 'diretor_adm'::app_role)
  );