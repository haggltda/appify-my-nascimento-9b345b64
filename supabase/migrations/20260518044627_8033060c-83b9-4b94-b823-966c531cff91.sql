-- PR-2.1 REV CORRIGIDA — migration aditiva
-- (A) fcr_raw_excel: 3 colunas + 2 índices
ALTER TABLE public.fcr_raw_excel
  ADD COLUMN IF NOT EXISTS valor_assinado_caixa numeric(18,2),
  ADD COLUMN IF NOT EXISTS fora_do_periodo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS id_origem_texto text;

CREATE INDEX IF NOT EXISTS idx_fcr_raw_excel_batch_periodo
  ON public.fcr_raw_excel (batch_id, fora_do_periodo);

CREATE INDEX IF NOT EXISTS idx_fcr_raw_excel_id_origem
  ON public.fcr_raw_excel (batch_id, id_origem_texto);

-- (B) fcr_sugestoes_pendencias: amplia CHECK preservando os 7 tipos atuais
ALTER TABLE public.fcr_sugestoes_pendencias
  DROP CONSTRAINT IF EXISTS fcr_sugestoes_pendencias_tipo_pendencia_check;

ALTER TABLE public.fcr_sugestoes_pendencias
  ADD CONSTRAINT fcr_sugestoes_pendencias_tipo_pendencia_check
  CHECK (tipo_pendencia = ANY (ARRAY[
    'sem_de_para'::text,
    'de_para_ambiguo'::text,
    'classificacao_nova'::text,
    'banco_nao_reconhecido'::text,
    'linha_calculada_ambigua'::text,
    'a_conciliar'::text,
    'empresa_nao_resolvida'::text,
    'transferencia_sem_par'::text,
    'id_origem_duplicado'::text,
    'sinal_inconsistente'::text,
    'fora_do_periodo'::text
  ]));