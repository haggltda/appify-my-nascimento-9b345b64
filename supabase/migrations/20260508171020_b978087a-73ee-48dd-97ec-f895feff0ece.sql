
-- Tabela de rateio do pré-título por centro de custo
CREATE TABLE IF NOT EXISTS public.pre_titulo_rateio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pre_titulo_id UUID NOT NULL REFERENCES public.pre_titulo_pagar(id) ON DELETE CASCADE,
  centro_custo_id UUID NOT NULL REFERENCES public.centros_custo(id),
  conta_contabil_id UUID REFERENCES public.conta_contabil(id),
  descricao TEXT,
  percentual NUMERIC(7,4),
  valor NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pretit_rateio_pretit ON public.pre_titulo_rateio(pre_titulo_id);
ALTER TABLE public.pre_titulo_rateio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read pretit_rateio" ON public.pre_titulo_rateio FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write pretit_rateio" ON public.pre_titulo_rateio FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Anexos (NF, rescisão, comprovantes)
CREATE TABLE IF NOT EXISTS public.pre_titulo_anexo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pre_titulo_id UUID NOT NULL REFERENCES public.pre_titulo_pagar(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  tipo TEXT, -- 'nf', 'rescisao', 'boleto', 'outro'
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pretit_anexo_pretit ON public.pre_titulo_anexo(pre_titulo_id);
ALTER TABLE public.pre_titulo_anexo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read pretit_anexo" ON public.pre_titulo_anexo FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write pretit_anexo" ON public.pre_titulo_anexo FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Bucket para documentos fiscais
INSERT INTO storage.buckets (id, name, public) VALUES ('pre-titulos-fiscal', 'pre-titulos-fiscal', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth read pretit fiscal bucket" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id='pre-titulos-fiscal');
CREATE POLICY "auth upload pretit fiscal bucket" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id='pre-titulos-fiscal');
CREATE POLICY "auth delete pretit fiscal bucket" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id='pre-titulos-fiscal');
