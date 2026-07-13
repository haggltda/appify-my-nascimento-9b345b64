-- =========================================================================
-- JURÍDICO — Patrimônio: novos campos + fusão Contas → Obrigações
--
-- Novos campos em JUR_PATRIMONIOS:
--   transferida       — "Já transferida pra essa empresa?" (Sim/Não); permite
--                       filtrar os patrimônios PENDENTES de transferência
--   proprietario      — Proprietário do bem
--   empresa_pagadora  — Empresa que pagará as contas/obrigações
--
-- Fusão de dados: copia as contas (JUR_CONTAS) para JUR_OBRIGACOES, cada uma no
-- SEU patrimônio (corrige o vazamento da aba antiga "Contas", que listava contas
-- de outros patrimônios). Idempotente — não duplica em re-execução.
-- =========================================================================

ALTER TABLE public."JUR_PATRIMONIOS" ADD COLUMN IF NOT EXISTS transferida      boolean NOT NULL DEFAULT false;
ALTER TABLE public."JUR_PATRIMONIOS" ADD COLUMN IF NOT EXISTS proprietario     text;
ALTER TABLE public."JUR_PATRIMONIOS" ADD COLUMN IF NOT EXISTS empresa_pagadora text;

INSERT INTO public."JUR_OBRIGACOES"
  (patrimonio_id, categoria, descricao, valor, vencimento, periodicidade, responsavel, status, created_at)
SELECT
  c.patrimonio_id,
  COALESCE(NULLIF(btrim(c.categoria), ''), 'Outros'),
  c.descricao,
  c.valor,
  c.data_inicio,
  CASE WHEN c.possui_recorrencia THEN 'Mensal' ELSE 'Único' END,
  c.responsavel,
  'Pendente',
  c.created_at
FROM public."JUR_CONTAS" c
WHERE c.patrimonio_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public."JUR_OBRIGACOES" o
    WHERE o.patrimonio_id = c.patrimonio_id
      AND COALESCE(o.descricao, '') = COALESCE(c.descricao, '')
      AND o.categoria = COALESCE(NULLIF(btrim(c.categoria), ''), 'Outros')
      AND o.valor IS NOT DISTINCT FROM c.valor
  );

NOTIFY pgrst, 'reload schema';
