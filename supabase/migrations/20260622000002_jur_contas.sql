-- =========================================================================
-- JURÍDICO — Submódulo CONTAS (recorrentes) + lançamentos por mês
--
-- JUR_CONTAS            — conta-mestra (água, luz, internet...): onde pagar,
--                         recorrência (a cada 7/15/20/30 dias), valor de ref.
-- JUR_CONTA_LANCAMENTOS — ocorrência por competência (mês), com status próprio
--                         (Pendente / Pago / Vencido). UNIQUE(conta_id,vencimento)
--                         permite gerar o mês sem duplicar.
-- Idempotente.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public."JUR_CONTAS" (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  descricao          text NOT NULL,
  categoria          text,                 -- Água, Luz, Internet, Aluguel...
  empresa            text,
  responsavel        text,
  onde_pagar         text,                 -- URL do site de pagamento
  possui_recorrencia boolean NOT NULL DEFAULT false,
  intervalo_dias     int,                  -- 7, 15, 20, 30 (quando recorrente)
  data_inicio        date,                 -- referência p/ gerar ocorrências / 1º vencimento
  valor              numeric,
  status             text NOT NULL DEFAULT 'Ativo',  -- Ativo / Inativo
  observacoes        text
);

CREATE TABLE IF NOT EXISTS public."JUR_CONTA_LANCAMENTOS" (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  conta_id    bigint REFERENCES public."JUR_CONTAS"(id) ON DELETE CASCADE,
  competencia text,                        -- 'YYYY-MM'
  vencimento  date,
  valor       numeric,
  status      text NOT NULL DEFAULT 'Pendente',  -- Pendente, Pago, Vencido
  pago_em     date,
  UNIQUE (conta_id, vencimento)
);

CREATE INDEX IF NOT EXISTS jur_clanc_conta_idx ON public."JUR_CONTA_LANCAMENTOS"(conta_id);
CREATE INDEX IF NOT EXISTS jur_clanc_comp_idx  ON public."JUR_CONTA_LANCAMENTOS"(competencia);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['JUR_CONTAS','JUR_CONTA_LANCAMENTOS'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all_auth', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t || '_all_auth', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
