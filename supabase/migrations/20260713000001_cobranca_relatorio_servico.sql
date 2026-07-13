-- Snapshot do "Relatório de Serviços" (planilha do Financeiro, hoje em
-- S:\Gestão Financeira\Faturamento contratos\...) — fonte real de quais notas
-- estão em aberto, enquanto titulo_receber não é alimentado por ela. Cada
-- importação SUBSTITUI o snapshot inteiro (mesmo comportamento do app antigo,
-- que recarregava "todas_as_notas" do zero a cada leitura da planilha).

CREATE TABLE IF NOT EXISTS public.cobranca_relatorio_nota (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  empresa_codigo text NOT NULL,
  contrato_id uuid REFERENCES public.contrato(id) ON DELETE SET NULL,
  cliente_contrato text NOT NULL,
  nota text NOT NULL,
  competencia text,
  data_referencia date NOT NULL,
  valor numeric(15,2) NOT NULL DEFAULT 0,
  dias_atraso integer NOT NULL,
  faixa text NOT NULL,
  importado_em timestamptz NOT NULL DEFAULT now(),
  importado_por uuid
);

CREATE INDEX IF NOT EXISTS idx_cobranca_relatorio_nota_empresa ON public.cobranca_relatorio_nota(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cobranca_relatorio_nota_contrato ON public.cobranca_relatorio_nota(contrato_id);
CREATE INDEX IF NOT EXISTS idx_cobranca_relatorio_nota_faixa ON public.cobranca_relatorio_nota(faixa);

ALTER TABLE public.cobranca_relatorio_nota ENABLE ROW LEVEL SECURITY;

CREATE POLICY crn_select ON public.cobranca_relatorio_nota FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    (public.has_role(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'controladoria') OR public.has_role(auth.uid(), 'juridico'))
    AND (empresa_id IS NULL OR empresa_id = public.get_user_empresa(auth.uid()))
  )
);

CREATE POLICY crn_write ON public.cobranca_relatorio_nota FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'controladoria')
) WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'controladoria')
);
