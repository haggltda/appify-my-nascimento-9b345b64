CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('sla-escalonamento-tick');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'sla-escalonamento-tick',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://fwmzeaztjxrxxzxzxmgc.supabase.co/functions/v1/sla-escalonamento-tick',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3bXplYXp0anhyeHh6eHp4bWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MDc0NTAsImV4cCI6MjA5MjE4MzQ1MH0.i08oF2-9N6w-CxDVy8ink29-ydHTJEc-eQBZDYRxGwI"}'::jsonb,
    body := jsonb_build_object('tick_at', now())
  );
  $$
);

CREATE INDEX IF NOT EXISTS idx_sup_aprov_inst_pendente
  ON public.sup_aprov_instancia (status, etapa_atual_id)
  WHERE status = 'pendente';

CREATE INDEX IF NOT EXISTS idx_sup_aprov_alerta_log_inst_etapa
  ON public.sup_aprov_alerta_log (instancia_id, etapa_id);