-- FASE 3 (lote 7b, parte 3 — Financeiro) — saldos_iniciais_caixa e os
-- storage buckets nfe-xml / pre-titulos-fiscal que ficaram de fora do lote 2.

-- ── saldos_iniciais_caixa (alimenta os RPCs fluxo_caixa_diario*, sem
--    consumo direto do front — menu 'fluxo', mesmo do Fluxo de Caixa) ────
DROP POLICY IF EXISTS saldos_iniciais_caixa_select_scoped ON public.saldos_iniciais_caixa;
CREATE POLICY saldos_iniciais_caixa_select_scoped ON public.saldos_iniciais_caixa FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), 'fluxo', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "admin write saldos iniciais" ON public.saldos_iniciais_caixa;
CREATE POLICY "admin write saldos iniciais" ON public.saldos_iniciais_caixa FOR ALL TO authenticated
  USING (public.can_access(auth.uid(), 'fluxo', 'alterar'::app_acao))
  WITH CHECK (public.can_access(auth.uid(), 'fluxo', 'alterar'::app_acao));

-- ── storage bucket "nfe-xml" (import de NF de entrada — Suprimentos,
--    menu 'nf-entrada') ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "NFe XML — select por empresa" ON storage.objects;
CREATE POLICY "NFe XML — select por menu" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'nfe-xml' AND public.can_access(auth.uid(), 'nf-entrada', 'visualizar'::app_acao));
DROP POLICY IF EXISTS "NFe XML — insert por empresa" ON storage.objects;
CREATE POLICY "NFe XML — insert por menu" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'nfe-xml' AND public.can_access(auth.uid(), 'nf-entrada', 'incluir'::app_acao));
DROP POLICY IF EXISTS "NFe XML — delete por empresa admin" ON storage.objects;
CREATE POLICY "NFe XML — delete por menu" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'nfe-xml' AND public.can_access(auth.uid(), 'nf-entrada', 'excluir'::app_acao));

-- ── storage bucket "pre-titulos-fiscal" (anexos de pre_titulo_pagar,
--    já corrigida no lote 2 — menu 'contas-pagar') ───────────────────────
DROP POLICY IF EXISTS pretit_fiscal_select ON storage.objects;
CREATE POLICY pretit_fiscal_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'pre-titulos-fiscal'
  AND EXISTS (
    SELECT 1
    FROM public.pre_titulo_anexo a
    JOIN public.pre_titulo_pagar p ON p.id = a.pre_titulo_id
    WHERE a.storage_path = storage.objects.name
      AND public.can_access(auth.uid(), 'contas-pagar', 'visualizar'::app_acao)
  )
);

DROP POLICY IF EXISTS pretit_fiscal_insert ON storage.objects;
CREATE POLICY pretit_fiscal_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pre-titulos-fiscal'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.pre_titulo_pagar p
    WHERE p.id = ((storage.foldername(name))[1])::uuid
      AND public.can_access(auth.uid(), 'contas-pagar', 'incluir'::app_acao)
  )
);

DROP POLICY IF EXISTS pretit_fiscal_delete ON storage.objects;
CREATE POLICY pretit_fiscal_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'pre-titulos-fiscal'
  AND EXISTS (
    SELECT 1
    FROM public.pre_titulo_anexo a
    JOIN public.pre_titulo_pagar p ON p.id = a.pre_titulo_id
    WHERE a.storage_path = storage.objects.name
      AND public.can_access(auth.uid(), 'contas-pagar', 'excluir'::app_acao)
  )
);

NOTIFY pgrst, 'reload schema';
