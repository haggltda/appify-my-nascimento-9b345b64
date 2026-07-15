-- public.contratos (plural) passa a ser a tabela oficial de contratos do ERP
-- (decisão de 2026-07-14). cobranca_relatorio_nota é substituída por completo
-- a cada importação, então não há dado real em risco aqui — só troca a FK.

ALTER TABLE public.cobranca_relatorio_nota
  DROP CONSTRAINT IF EXISTS cobranca_relatorio_nota_contrato_id_fkey;

UPDATE public.cobranca_relatorio_nota SET contrato_id = NULL;

ALTER TABLE public.cobranca_relatorio_nota
  ADD CONSTRAINT cobranca_relatorio_nota_contrato_id_fkey
  FOREIGN KEY (contrato_id) REFERENCES public.contratos(id) ON DELETE SET NULL;
