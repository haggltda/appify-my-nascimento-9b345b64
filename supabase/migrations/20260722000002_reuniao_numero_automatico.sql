-- Número automático da reunião (ex.: "R-2026-000125"), igual ao protótipo.

CREATE SEQUENCE IF NOT EXISTS public.reuniao_numero_seq;

ALTER TABLE public.reuniao ADD COLUMN IF NOT EXISTS numero text;

CREATE OR REPLACE FUNCTION public.gerar_numero_reuniao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.numero IS NULL THEN
    NEW.numero := 'R-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.reuniao_numero_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reuniao_numero ON public.reuniao;
CREATE TRIGGER trg_reuniao_numero
  BEFORE INSERT ON public.reuniao
  FOR EACH ROW EXECUTE FUNCTION public.gerar_numero_reuniao();

-- Backfill das reuniões existentes, em ordem de criação, consumindo a
-- mesma sequence do trigger (loop, não set-based, pra garantir que cada
-- linha puxe um nextval() distinto e não colida com reuniões novas).
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id, created_at FROM public.reuniao WHERE numero IS NULL ORDER BY created_at LOOP
    UPDATE public.reuniao
    SET numero = 'R-' || to_char(rec.created_at, 'YYYY') || '-' || lpad(nextval('public.reuniao_numero_seq')::text, 6, '0')
    WHERE id = rec.id;
  END LOOP;
END;
$$;

ALTER TABLE public.reuniao ALTER COLUMN numero SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS reuniao_numero_uk ON public.reuniao(numero);

-- listar_reunioes_calendario() passa a devolver numero também (DROP
-- necessário porque CREATE OR REPLACE não deixa mudar a lista de colunas
-- do retorno).
DROP FUNCTION IF EXISTS public.listar_reunioes_calendario();
CREATE OR REPLACE FUNCTION public.listar_reunioes_calendario()
RETURNS TABLE (
  id                                 uuid,
  numero                             text,
  titulo                             text,
  data_hora                          timestamptz,
  duracao_minutos                    int,
  tipo_local                         text,
  local_ou_link                      text,
  etapa                              text,
  criado_por                         uuid,
  organizador_user_id                uuid,
  responsavel_preenchimento_user_id  uuid,
  convidados                         uuid[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT r.id, r.numero, r.titulo, r.data_hora, r.duracao_minutos, r.tipo_local, r.local_ou_link, r.etapa,
         r.criado_por, r.organizador_user_id, r.responsavel_preenchimento_user_id,
         COALESCE(array_agg(c.user_id) FILTER (WHERE c.user_id IS NOT NULL), '{}')
    FROM public.reuniao r
    LEFT JOIN public.reuniao_convidado c ON c.reuniao_id = r.id
   WHERE public.tem_acesso_menu('central_servicos_reunioes')
   GROUP BY r.id
   ORDER BY r.data_hora;
$$;

REVOKE ALL ON FUNCTION public.listar_reunioes_calendario() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_reunioes_calendario() TO authenticated;

NOTIFY pgrst, 'reload schema';
