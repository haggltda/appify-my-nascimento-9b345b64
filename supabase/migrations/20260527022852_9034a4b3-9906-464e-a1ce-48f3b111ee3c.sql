-- B1.5 v3.2 — fornecedor_conta_bancaria: escopo por empresa (permissoes via ERP)

DROP POLICY IF EXISTS "perm select fornecedor_conta_bancaria"  ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "perm insert fornecedor_conta_bancaria"  ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "perm update fornecedor_conta_bancaria"  ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "perm delete fornecedor_conta_bancaria"  ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "auth select fornecedor_conta_bancaria"  ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "auth insert fornecedor_conta_bancaria"  ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "auth update fornecedor_conta_bancaria"  ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "auth delete fornecedor_conta_bancaria"  ON public.fornecedor_conta_bancaria;

ALTER TABLE public.fornecedor_conta_bancaria ENABLE ROW LEVEL SECURITY;

CREATE POLICY fcb_select
ON public.fornecedor_conta_bancaria
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    public.has_permissao(auth.uid(), 'suprimentos', 'visualizar', 'fornecedor.conta_bancaria')
    AND public.user_can_see_empresa(empresa_id)
  )
);

CREATE POLICY fcb_insert
ON public.fornecedor_conta_bancaria
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    public.has_permissao(auth.uid(), 'suprimentos', 'incluir', 'fornecedor.conta_bancaria')
    AND public.user_can_see_empresa(empresa_id)
    AND EXISTS (
      SELECT 1 FROM public.fornecedor f
      WHERE f.id = fornecedor_conta_bancaria.fornecedor_id
        AND (f.is_global = true OR f.empresa_id = fornecedor_conta_bancaria.empresa_id)
    )
  )
);

CREATE POLICY fcb_update
ON public.fornecedor_conta_bancaria
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    public.has_permissao(auth.uid(), 'suprimentos', 'alterar', 'fornecedor.conta_bancaria')
    AND public.user_can_see_empresa(empresa_id)
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    public.has_permissao(auth.uid(), 'suprimentos', 'alterar', 'fornecedor.conta_bancaria')
    AND public.user_can_see_empresa(empresa_id)
    AND EXISTS (
      SELECT 1 FROM public.fornecedor f
      WHERE f.id = fornecedor_conta_bancaria.fornecedor_id
        AND (f.is_global = true OR f.empresa_id = fornecedor_conta_bancaria.empresa_id)
    )
  )
);

CREATE POLICY fcb_delete
ON public.fornecedor_conta_bancaria
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    public.has_permissao(auth.uid(), 'suprimentos', 'excluir', 'fornecedor.conta_bancaria')
    AND public.user_can_see_empresa(empresa_id)
  )
);