-- Motor de envio da régua de cobrança: schema novo
-- (contrato_email_cobranca, novo status de aprovação, setor remetente por etapa)

-- 1) Novo status pra etapas que exigem revisão humana antes de sair
ALTER TYPE public.regua_etapa_status ADD VALUE IF NOT EXISTS 'aguardando_aprovacao';

-- 2) Setor responsável pelo envio de cada etapa (decide qual caixa do Graph manda)
DO $$ BEGIN
  CREATE TYPE public.regua_setor_remetente AS ENUM ('financeiro', 'juridico');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.regua_cobranca_etapa
  ADD COLUMN IF NOT EXISTS setor_remetente public.regua_setor_remetente;

-- 3) E-mails padrão do tomador por contrato (substitui o casamento de texto aproximado
--    que o app antigo fazia contra uma planilha — aqui é uma FK de verdade)
CREATE TABLE IF NOT EXISTS public.contrato_email_cobranca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.contrato(id) ON DELETE CASCADE,
  email text NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contrato_email_cobranca_contrato
  ON public.contrato_email_cobranca(contrato_id);

ALTER TABLE public.contrato_email_cobranca ENABLE ROW LEVEL SECURITY;

CREATE POLICY cec_select ON public.contrato_email_cobranca FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.contrato c
    WHERE c.id = contrato_id AND c.empresa_id = public.get_user_empresa(auth.uid())
  )
);

CREATE POLICY cec_write ON public.contrato_email_cobranca FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.contrato c
    WHERE c.id = contrato_id
      AND (public.has_role(auth.uid(), 'controladoria') OR public.has_role(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'juridico'))
      AND c.empresa_id = public.get_user_empresa(auth.uid())
  )
) WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.contrato c
    WHERE c.id = contrato_id
      AND (public.has_role(auth.uid(), 'controladoria') OR public.has_role(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'juridico'))
      AND c.empresa_id = public.get_user_empresa(auth.uid())
  )
);
