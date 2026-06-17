-- PR-2.2 Fase A: campos de progresso/checkpoint em fcr_batch + tabela de erros por chunk

ALTER TABLE public.fcr_batch
  ADD COLUMN IF NOT EXISTS linhas_lidas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS linhas_inseridas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chunks_total integer,
  ADD COLUMN IF NOT EXISTS chunk_atual integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parse_iniciado_em timestamptz,
  ADD COLUMN IF NOT EXISTS parse_finalizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultimo_erro text;

CREATE TABLE IF NOT EXISTS public.fcr_parse_chunk_erro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.fcr_batch(id) ON DELETE CASCADE,
  chunk_idx integer NOT NULL,
  linha_inicio integer NOT NULL,
  linha_fim integer NOT NULL,
  tentativa integer NOT NULL,
  erro_msg text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fcr_parse_chunk_erro_batch
  ON public.fcr_parse_chunk_erro(batch_id, chunk_idx);

ALTER TABLE public.fcr_parse_chunk_erro ENABLE ROW LEVEL SECURITY;

-- Mesmo escopo do batch dono: admin/presidencia/diretor_adm veem tudo;
-- controladoria/financeiro veem se forem da mesma empresa do batch (ou consolidado).
CREATE POLICY "fcr_parse_chunk_erro_select"
  ON public.fcr_parse_chunk_erro
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.fcr_batch b
      WHERE b.id = fcr_parse_chunk_erro.batch_id
        AND (
          public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'presidencia')
          OR public.has_role(auth.uid(), 'diretor_adm')
          OR (
            (public.has_role(auth.uid(), 'controladoria') OR public.has_role(auth.uid(), 'financeiro'))
            AND (b.empresa_id IS NULL OR b.empresa_id = public.get_user_empresa(auth.uid()))
          )
        )
    )
  );

-- Só edge function (service role) escreve nesta tabela; sem policy de INSERT para authenticated.