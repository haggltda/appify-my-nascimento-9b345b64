
-- Bloco 2 — Governança base: role presidencia + hash_dedup + consolidação de duplicidades

-- 1) Adicionar role 'presidencia' ao enum app_role (idempotente)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'presidencia';

-- 2) Remover overload duplicado de integration_resolve_alias (manter versão text)
DROP FUNCTION IF EXISTS public.integration_resolve_alias(text, text, uuid, uuid);

-- 3) Marcar conciliacao_regra (singular) como DEPRECATED — sem dropar (preserva trilha)
COMMENT ON TABLE public.conciliacao_regra IS 'DEPRECATED em 2026-05 — usar public.conciliacao_regras (modelo completo com patterns regex, valor_min/max e dre_linha_id). Mantida apenas para auditoria histórica.';

-- 4) Adicionar hash_dedup nas tabelas-fato + índice único parcial
--    Coluna nullable, índice só atua quando hash_dedup é preenchido pela carga governada
ALTER TABLE public.lancamento_contabil    ADD COLUMN IF NOT EXISTS hash_dedup text;
ALTER TABLE public.realizado_lancamentos  ADD COLUMN IF NOT EXISTS hash_dedup text;
ALTER TABLE public.fluxo_caixa_projetado  ADD COLUMN IF NOT EXISTS hash_dedup text;
ALTER TABLE public.titulo_pagar           ADD COLUMN IF NOT EXISTS hash_dedup text;
ALTER TABLE public.titulo_receber         ADD COLUMN IF NOT EXISTS hash_dedup text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lancto_contabil_hash_dedup
  ON public.lancamento_contabil(hash_dedup) WHERE hash_dedup IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_realizado_lanctos_hash_dedup
  ON public.realizado_lancamentos(hash_dedup) WHERE hash_dedup IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_fluxo_caixa_proj_hash_dedup
  ON public.fluxo_caixa_projetado(hash_dedup) WHERE hash_dedup IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_titulo_pagar_hash_dedup
  ON public.titulo_pagar(hash_dedup) WHERE hash_dedup IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_titulo_receber_hash_dedup
  ON public.titulo_receber(hash_dedup) WHERE hash_dedup IS NOT NULL;

COMMENT ON COLUMN public.lancamento_contabil.hash_dedup IS 'Hash de deduplicação para carga governada: sha256(empresa|origem|id_origem|arquivo|linha|doc|data|valor|conta|cc|contrato).';
COMMENT ON COLUMN public.realizado_lancamentos.hash_dedup IS 'Hash de deduplicação para carga governada.';
COMMENT ON COLUMN public.fluxo_caixa_projetado.hash_dedup IS 'Hash de deduplicação para carga governada.';
COMMENT ON COLUMN public.titulo_pagar.hash_dedup IS 'Hash de deduplicação para carga governada.';
COMMENT ON COLUMN public.titulo_receber.hash_dedup IS 'Hash de deduplicação para carga governada.';
