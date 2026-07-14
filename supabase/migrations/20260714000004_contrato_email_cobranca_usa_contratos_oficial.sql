-- public.contratos (plural) passa a ser a tabela oficial de contratos do ERP
-- (decisão de 2026-07-14). contrato_email_cobranca está vazia neste ambiente
-- (0 linhas em 2026-07-14) — confirmado antes desta migration, sem dado real
-- em risco, então é uma troca direta de FK, sem reconciliação necessária.

ALTER TABLE public.contrato_email_cobranca
  DROP CONSTRAINT IF EXISTS contrato_email_cobranca_contrato_id_fkey;

DELETE FROM public.contrato_email_cobranca;

ALTER TABLE public.contrato_email_cobranca
  ADD CONSTRAINT contrato_email_cobranca_contrato_id_fkey
  FOREIGN KEY (contrato_id) REFERENCES public.contratos(id) ON DELETE CASCADE;
