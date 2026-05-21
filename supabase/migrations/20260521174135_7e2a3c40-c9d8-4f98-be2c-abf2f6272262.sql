
-- Parcelamento da NF no pré-título
ALTER TABLE public.pre_titulo_pagar
  ADD COLUMN IF NOT EXISTS parcelado boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.pre_titulo_parcela (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pre_titulo_id uuid NOT NULL REFERENCES public.pre_titulo_pagar(id) ON DELETE CASCADE,
  numero integer NOT NULL CHECK (numero >= 1 AND numero <= 24),
  valor numeric(14,2) NOT NULL CHECK (valor > 0),
  data_vencimento date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pre_titulo_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_pre_titulo_parcela_pretit
  ON public.pre_titulo_parcela(pre_titulo_id);

ALTER TABLE public.pre_titulo_parcela ENABLE ROW LEVEL SECURITY;

-- Mesma política do pre_titulo_rateio: leitura/escrita seguem o pré-título pai.
-- Reaproveita o padrão "usuários autenticados gerenciam" já adotado nas tabelas
-- relacionadas a pré-título (rateio/anexo).
DROP POLICY IF EXISTS "auth read pre_titulo_parcela" ON public.pre_titulo_parcela;
CREATE POLICY "auth read pre_titulo_parcela"
  ON public.pre_titulo_parcela FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth write pre_titulo_parcela" ON public.pre_titulo_parcela;
CREATE POLICY "auth write pre_titulo_parcela"
  ON public.pre_titulo_parcela FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_pre_titulo_parcela_updated_at ON public.pre_titulo_parcela;
CREATE TRIGGER trg_pre_titulo_parcela_updated_at
  BEFORE UPDATE ON public.pre_titulo_parcela
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
