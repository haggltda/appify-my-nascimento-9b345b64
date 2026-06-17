-- ============================================================
-- F4.1 — orcamento_contrato_linha_audit (imutável + autoria)
-- ============================================================
DROP POLICY IF EXISTS "ocla_insert" ON public.orcamento_contrato_linha_audit;
DROP POLICY IF EXISTS "ocla_update_block" ON public.orcamento_contrato_linha_audit;
DROP POLICY IF EXISTS "ocla_delete_block" ON public.orcamento_contrato_linha_audit;

CREATE POLICY "ocla_insert"
ON public.orcamento_contrato_linha_audit
FOR INSERT TO authenticated
WITH CHECK (
  alterado_por = auth.uid()
  AND (
    EXISTS (SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
    OR public.user_pode_atuar_empresa(auth.uid(), empresa_id)
  )
);

CREATE POLICY "ocla_update_block"
ON public.orcamento_contrato_linha_audit
FOR UPDATE TO authenticated
USING (false) WITH CHECK (false);

CREATE POLICY "ocla_delete_block"
ON public.orcamento_contrato_linha_audit
FOR DELETE TO authenticated
USING (false);


-- ============================================================
-- F4.2 — pre_titulo_anexo
-- ============================================================
DROP POLICY IF EXISTS "auth read" ON public.pre_titulo_anexo;
DROP POLICY IF EXISTS "auth write" ON public.pre_titulo_anexo;
DROP POLICY IF EXISTS "pretit_anexo_select" ON public.pre_titulo_anexo;
DROP POLICY IF EXISTS "pretit_anexo_insert" ON public.pre_titulo_anexo;
DROP POLICY IF EXISTS "pretit_anexo_update" ON public.pre_titulo_anexo;
DROP POLICY IF EXISTS "pretit_anexo_delete" ON public.pre_titulo_anexo;

CREATE POLICY "pretit_anexo_select"
ON public.pre_titulo_anexo
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pre_titulo_pagar p
    WHERE p.id = pre_titulo_anexo.pre_titulo_id
      AND (
        EXISTS (SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
        OR (
          public.user_pode_atuar_empresa(auth.uid(), p.empresa_id)
          AND EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('financeiro','controladoria','diretor_adm','gestor_cc')
          )
        )
      )
  )
);

CREATE POLICY "pretit_anexo_insert"
ON public.pre_titulo_anexo
FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.pre_titulo_pagar p
    WHERE p.id = pre_titulo_anexo.pre_titulo_id
      AND (
        EXISTS (SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
        OR (
          public.user_pode_atuar_empresa(auth.uid(), p.empresa_id)
          AND EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('financeiro','controladoria','diretor_adm','gestor_cc')
          )
        )
      )
  )
);

CREATE POLICY "pretit_anexo_update"
ON public.pre_titulo_anexo
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pre_titulo_pagar p
    WHERE p.id = pre_titulo_anexo.pre_titulo_id
      AND (
        EXISTS (SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
        OR (
          public.user_pode_atuar_empresa(auth.uid(), p.empresa_id)
          AND EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('financeiro','controladoria','diretor_adm','gestor_cc')
          )
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pre_titulo_pagar p
    WHERE p.id = pre_titulo_anexo.pre_titulo_id
      AND (
        EXISTS (SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
        OR (
          public.user_pode_atuar_empresa(auth.uid(), p.empresa_id)
          AND EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('financeiro','controladoria','diretor_adm','gestor_cc')
          )
        )
      )
  )
);

CREATE POLICY "pretit_anexo_delete"
ON public.pre_titulo_anexo
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pre_titulo_pagar p
    WHERE p.id = pre_titulo_anexo.pre_titulo_id
      AND (
        EXISTS (SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
        OR (
          public.user_pode_atuar_empresa(auth.uid(), p.empresa_id)
          AND EXISTS (SELECT 1 FROM public.user_roles ur
                      WHERE ur.user_id = auth.uid() AND ur.role = 'financeiro')
        )
      )
  )
);


-- ============================================================
-- F4.3 — pre_titulo_rateio
-- ============================================================
DROP POLICY IF EXISTS "auth read" ON public.pre_titulo_rateio;
DROP POLICY IF EXISTS "auth write" ON public.pre_titulo_rateio;
DROP POLICY IF EXISTS "pretit_rateio_select" ON public.pre_titulo_rateio;
DROP POLICY IF EXISTS "pretit_rateio_insert" ON public.pre_titulo_rateio;
DROP POLICY IF EXISTS "pretit_rateio_update" ON public.pre_titulo_rateio;
DROP POLICY IF EXISTS "pretit_rateio_delete" ON public.pre_titulo_rateio;

CREATE POLICY "pretit_rateio_select"
ON public.pre_titulo_rateio
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pre_titulo_pagar p
    WHERE p.id = pre_titulo_rateio.pre_titulo_id
      AND (
        EXISTS (SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
        OR (
          public.user_pode_atuar_empresa(auth.uid(), p.empresa_id)
          AND EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('financeiro','controladoria','diretor_adm','gestor_cc')
          )
        )
      )
  )
);

CREATE POLICY "pretit_rateio_insert"
ON public.pre_titulo_rateio
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pre_titulo_pagar p
    WHERE p.id = pre_titulo_rateio.pre_titulo_id
      AND (
        EXISTS (SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
        OR (
          public.user_pode_atuar_empresa(auth.uid(), p.empresa_id)
          AND EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('financeiro','controladoria','diretor_adm','gestor_cc')
          )
        )
      )
  )
);

CREATE POLICY "pretit_rateio_update"
ON public.pre_titulo_rateio
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pre_titulo_pagar p
    WHERE p.id = pre_titulo_rateio.pre_titulo_id
      AND (
        EXISTS (SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
        OR (
          public.user_pode_atuar_empresa(auth.uid(), p.empresa_id)
          AND EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('financeiro','controladoria','diretor_adm','gestor_cc')
          )
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pre_titulo_pagar p
    WHERE p.id = pre_titulo_rateio.pre_titulo_id
      AND (
        EXISTS (SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
        OR (
          public.user_pode_atuar_empresa(auth.uid(), p.empresa_id)
          AND EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('financeiro','controladoria','diretor_adm','gestor_cc')
          )
        )
      )
  )
);

CREATE POLICY "pretit_rateio_delete"
ON public.pre_titulo_rateio
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pre_titulo_pagar p
    WHERE p.id = pre_titulo_rateio.pre_titulo_id
      AND (
        EXISTS (SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
        OR (
          public.user_pode_atuar_empresa(auth.uid(), p.empresa_id)
          AND EXISTS (SELECT 1 FROM public.user_roles ur
                      WHERE ur.user_id = auth.uid() AND ur.role = 'financeiro')
        )
      )
  )
);