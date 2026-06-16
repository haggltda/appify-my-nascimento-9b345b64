-- 1) Add contrato_id column if missing
ALTER TABLE public.titulo_pagar ADD COLUMN IF NOT EXISTS contrato_id uuid;

-- 2) Add foreign keys (idempotent via DO blocks)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'titulo_pagar_fornecedor_fk') THEN
    ALTER TABLE public.titulo_pagar
      ADD CONSTRAINT titulo_pagar_fornecedor_fk
      FOREIGN KEY (fornecedor_id) REFERENCES public.fornecedor(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'titulo_pagar_centro_custo_fk') THEN
    ALTER TABLE public.titulo_pagar
      ADD CONSTRAINT titulo_pagar_centro_custo_fk
      FOREIGN KEY (centro_custo_id) REFERENCES public.centros_custo(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'titulo_pagar_conta_bancaria_fk') THEN
    ALTER TABLE public.titulo_pagar
      ADD CONSTRAINT titulo_pagar_conta_bancaria_fk
      FOREIGN KEY (conta_bancaria_id) REFERENCES public.conta_bancaria(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'titulo_pagar_contrato_fk') THEN
    ALTER TABLE public.titulo_pagar
      ADD CONSTRAINT titulo_pagar_contrato_fk
      FOREIGN KEY (contrato_id) REFERENCES public.contrato(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3) Add 'aprovado' to malote_status enum if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'malote_status' AND e.enumlabel = 'aprovado'
  ) THEN
    ALTER TYPE public.malote_status ADD VALUE 'aprovado';
  END IF;
END $$;

-- 4) Indexes for the new FKs
CREATE INDEX IF NOT EXISTS idx_titulo_pagar_contrato_id ON public.titulo_pagar(contrato_id);
CREATE INDEX IF NOT EXISTS idx_titulo_pagar_fornecedor_id ON public.titulo_pagar(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_titulo_pagar_centro_custo_id ON public.titulo_pagar(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_titulo_pagar_conta_bancaria_id ON public.titulo_pagar(conta_bancaria_id);