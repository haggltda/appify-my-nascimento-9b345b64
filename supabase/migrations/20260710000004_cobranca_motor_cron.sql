-- Cron horário do motor de envio da régua de cobrança (mesmo padrão do sla-escalonamento-tick)

DO $$
BEGIN
  PERFORM cron.unschedule('regua-cobranca-tick');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'regua-cobranca-tick',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://fwmzeaztjxrxxzxzxmgc.supabase.co/functions/v1/regua-cobranca-tick',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3bXplYXp0anhyeHh6eHp4bWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MDc0NTAsImV4cCI6MjA5MjE4MzQ1MH0.i08oF2-9N6w-CxDVy8ink29-ydHTJEc-eQBZDYRxGwI"}'::jsonb,
    body := jsonb_build_object('tick_at', now())
  );
  $$
);

CREATE INDEX IF NOT EXISTS idx_regua_cobranca_execucao_pendente
  ON public.regua_cobranca_execucao (status, agendado_para)
  WHERE status = 'pendente';
