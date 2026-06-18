-- =========================================================================
-- INDICADORES DE TEMPO POR ETAPA (Recrutamento)
--
-- Objetivo: saber "quantos dias a vaga está parada no status atual" e ter
-- base para indicadores de qual etapa demora mais.
--
-- 1. Coluna status_changed_at em SISTEMA_RECRUTAMENTO (carimbo da última troca).
-- 2. Tabela de log de transições (status anterior → novo + dias no anterior).
-- 3. Trigger BEFORE UPDATE que carimba a data e grava o log a cada troca.
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- =========================================================================

ALTER TABLE public."SISTEMA_RECRUTAMENTO"
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz NOT NULL DEFAULT now();

-- Inicializa o carimbo das linhas antigas com a data de criação.
UPDATE public."SISTEMA_RECRUTAMENTO"
   SET status_changed_at = created_at
 WHERE status_changed_at IS NULL OR status_changed_at < created_at;

-- Log de transições de status (para indicadores de tempo por etapa).
CREATE TABLE IF NOT EXISTS public."SISTEMA_RECRUTAMENTO_STATUS_LOG" (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  solicitacao_id   integer REFERENCES public."SISTEMA_RECRUTAMENTO"(id) ON DELETE CASCADE,
  status_anterior  text,
  status_novo      text,
  dias_no_anterior numeric,
  changed_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS srsl_solicitacao_idx
  ON public."SISTEMA_RECRUTAMENTO_STATUS_LOG"(solicitacao_id);

ALTER TABLE public."SISTEMA_RECRUTAMENTO_STATUS_LOG" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public."SISTEMA_RECRUTAMENTO_STATUS_LOG" TO authenticated;

DROP POLICY IF EXISTS srsl_all_auth ON public."SISTEMA_RECRUTAMENTO_STATUS_LOG";
CREATE POLICY srsl_all_auth ON public."SISTEMA_RECRUTAMENTO_STATUS_LOG"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger: a cada troca de status, carimba status_changed_at e registra o log.
CREATE OR REPLACE FUNCTION public.sr_track_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_dias numeric;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_dias := EXTRACT(EPOCH FROM (now() - COALESCE(OLD.status_changed_at, OLD.created_at))) / 86400.0;
    NEW.status_changed_at := now();
    -- O log nunca pode bloquear a atualização principal da solicitação.
    BEGIN
      INSERT INTO public."SISTEMA_RECRUTAMENTO_STATUS_LOG"
        (solicitacao_id, status_anterior, status_novo, dias_no_anterior)
      VALUES (NEW.id, OLD.status, NEW.status, round(v_dias, 2));
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sr_track_status ON public."SISTEMA_RECRUTAMENTO";
CREATE TRIGGER trg_sr_track_status
  BEFORE UPDATE ON public."SISTEMA_RECRUTAMENTO"
  FOR EACH ROW EXECUTE FUNCTION public.sr_track_status_change();
