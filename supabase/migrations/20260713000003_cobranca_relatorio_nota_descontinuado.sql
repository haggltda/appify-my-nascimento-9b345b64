-- Marca uma linha do registro como "contrato descontinuado" — diferencia de
-- "ainda não vinculei" (nesse caso não existe mesmo contrato pra vincular no ERP,
-- não é falha de casamento).

ALTER TABLE public.cobranca_relatorio_nota
  ADD COLUMN IF NOT EXISTS contrato_descontinuado boolean NOT NULL DEFAULT false;
