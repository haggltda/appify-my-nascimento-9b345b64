DROP POLICY IF EXISTS obzval_write ON public.obz_valores;
CREATE POLICY obzval_write ON public.obz_valores
FOR ALL
USING (
  (has_role(auth.uid(), 'admin'::app_role)
   OR has_role(auth.uid(), 'controladoria'::app_role)
   OR has_role(auth.uid(), 'presidencia'::app_role))
  AND EXISTS (
    SELECT 1 FROM obz_versoes v
    WHERE v.id = obz_valores.versao_id
      AND v.status = ANY (ARRAY['rascunho'::obz_status, 'em_aprovacao'::obz_status])
      AND (has_role(auth.uid(), 'admin'::app_role) OR user_pode_atuar_empresa(auth.uid(), v.empresa_id))
  )
)
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role)
   OR has_role(auth.uid(), 'controladoria'::app_role)
   OR has_role(auth.uid(), 'presidencia'::app_role))
  AND EXISTS (
    SELECT 1 FROM obz_versoes v
    WHERE v.id = obz_valores.versao_id
      AND v.status = ANY (ARRAY['rascunho'::obz_status, 'em_aprovacao'::obz_status])
      AND (has_role(auth.uid(), 'admin'::app_role) OR user_pode_atuar_empresa(auth.uid(), v.empresa_id))
  )
);