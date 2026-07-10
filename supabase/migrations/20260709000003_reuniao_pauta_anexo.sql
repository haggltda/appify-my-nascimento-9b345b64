-- Anexo por tópico de pauta — mesmo padrão de reuniao_anexo, só que
-- amarrado ao tópico (pauta_id) em vez da reunião inteira. Mesmo bucket de
-- storage "reunioes", path "<pauta_id>/<timestamp>-<nome>".

CREATE TABLE IF NOT EXISTS public.reuniao_pauta_anexo (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pauta_id      uuid NOT NULL REFERENCES public.reuniao_pauta(id) ON DELETE CASCADE,
  storage_path  text NOT NULL,
  nome_arquivo  text NOT NULL,
  mime_type     text,
  tamanho_bytes bigint,
  enviado_por   uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reuniao_pauta_anexo_pauta ON public.reuniao_pauta_anexo(pauta_id);

ALTER TABLE public.reuniao_pauta_anexo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reuniao_pauta_anexo_select ON public.reuniao_pauta_anexo;
CREATE POLICY reuniao_pauta_anexo_select ON public.reuniao_pauta_anexo
  FOR SELECT TO authenticated
  USING (public.tem_acesso_menu('central_servicos_reunioes'));

DROP POLICY IF EXISTS reuniao_pauta_anexo_insert ON public.reuniao_pauta_anexo;
CREATE POLICY reuniao_pauta_anexo_insert ON public.reuniao_pauta_anexo
  FOR INSERT TO authenticated
  WITH CHECK (public.tem_acesso_menu('central_servicos_reunioes'));

DROP POLICY IF EXISTS reuniao_pauta_anexo_delete ON public.reuniao_pauta_anexo;
CREATE POLICY reuniao_pauta_anexo_delete ON public.reuniao_pauta_anexo
  FOR DELETE TO authenticated
  USING (public.tem_acesso_menu('central_servicos_reunioes'));

-- Path de storage é "<pauta_id>/...", não "<reuniao_id>/..." — o bucket
-- "reunioes" já libera qualquer path pra quem tem acesso ao menu (ver
-- 20260706000003_reunioes_storage.sql), então nenhuma policy de storage
-- nova é necessária aqui.
