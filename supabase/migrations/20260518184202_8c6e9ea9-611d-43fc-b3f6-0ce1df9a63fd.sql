
CREATE TABLE IF NOT EXISTS public.fornecedor_conta_bancaria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedor(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  banco_codigo text NOT NULL,
  banco_nome text NOT NULL,
  agencia text NOT NULL,
  agencia_digito text,
  conta text NOT NULL,
  conta_digito text,
  tipo text NOT NULL DEFAULT 'corrente' CHECK (tipo IN ('corrente','poupanca','pagamento')),
  titular_nome text,
  titular_documento text,
  pix_tipo text CHECK (pix_tipo IN ('cpf','cnpj','email','telefone','aleatoria')),
  pix_chave text,
  principal boolean NOT NULL DEFAULT false,
  ativa boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fornecedor_conta_bancaria_forn ON public.fornecedor_conta_bancaria(fornecedor_id, ativa);
CREATE INDEX IF NOT EXISTS idx_fornecedor_conta_bancaria_emp ON public.fornecedor_conta_bancaria(empresa_id);

ALTER TABLE public.fornecedor_conta_bancaria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read fornecedor_conta_bancaria"
  ON public.fornecedor_conta_bancaria FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "auth insert fornecedor_conta_bancaria"
  ON public.fornecedor_conta_bancaria FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "auth update fornecedor_conta_bancaria"
  ON public.fornecedor_conta_bancaria FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "auth delete fornecedor_conta_bancaria"
  ON public.fornecedor_conta_bancaria FOR DELETE
  TO authenticated USING (true);

CREATE TRIGGER trg_fornecedor_conta_bancaria_updated_at
  BEFORE UPDATE ON public.fornecedor_conta_bancaria
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Garante apenas 1 conta principal por fornecedor
CREATE OR REPLACE FUNCTION public.fornecedor_conta_bancaria_principal_unica()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.principal = true THEN
    UPDATE public.fornecedor_conta_bancaria
       SET principal = false
     WHERE fornecedor_id = NEW.fornecedor_id
       AND id <> NEW.id
       AND principal = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fornecedor_conta_bancaria_principal
  AFTER INSERT OR UPDATE OF principal ON public.fornecedor_conta_bancaria
  FOR EACH ROW EXECUTE FUNCTION public.fornecedor_conta_bancaria_principal_unica();
