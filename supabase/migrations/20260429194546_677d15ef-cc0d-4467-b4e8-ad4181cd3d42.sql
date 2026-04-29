-- ============================================================================
-- Enums
-- ============================================================================
CREATE TYPE public.orcamento_ciclo_status AS ENUM ('aberto','em_aprovacao','aprovado','encerrado');
CREATE TYPE public.orcamento_contrato_status AS ENUM ('rascunho','em_aprovacao','aprovado','rejeitado','encerrado');
CREATE TYPE public.orcamento_linha_source AS ENUM ('licitacao','obz','manual','recorrente','dissidio','calculado');
CREATE TYPE public.aprov_decisao AS ENUM ('pendente','aprovado','rejeitado','devolvido');
CREATE TYPE public.cronograma_status AS ENUM ('previsto','emitido','recebido','atrasado','cancelado');
CREATE TYPE public.desbloqueio_status AS ENUM ('pendente','aprovado','rejeitado');
CREATE TYPE public.fluxo_tipo AS ENUM ('entrada','saida');

-- parametro_orcamento
CREATE TABLE public.parametro_orcamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL UNIQUE,
  pct_encargos_sociais numeric NOT NULL DEFAULT 71.00,
  pct_fgts numeric NOT NULL DEFAULT 8.00,
  pct_provisoes numeric NOT NULL DEFAULT 12.00,
  pct_tributos_receita numeric NOT NULL DEFAULT 14.53,
  pct_lucro_meta numeric NOT NULL DEFAULT 10.00,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.parametro_orcamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po_select" ON public.parametro_orcamento FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY "po_write" ON public.parametro_orcamento FOR ALL TO authenticated
  USING ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria'))
         AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria'))
              AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())));
CREATE TRIGGER po_set_updated BEFORE UPDATE ON public.parametro_orcamento
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- orcamento_ciclo
CREATE TABLE public.orcamento_ciclo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  ano integer NOT NULL,
  nome text NOT NULL,
  status orcamento_ciclo_status NOT NULL DEFAULT 'aberto',
  data_inicio date,
  data_fim date,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, ano, nome)
);
CREATE INDEX idx_oc_empresa ON public.orcamento_ciclo(empresa_id);
ALTER TABLE public.orcamento_ciclo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oc_select" ON public.orcamento_ciclo FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY "oc_write" ON public.orcamento_ciclo FOR ALL TO authenticated
  USING ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
         AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
              AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())));
CREATE TRIGGER oc_set_updated BEFORE UPDATE ON public.orcamento_ciclo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- orcamento_contrato
CREATE TABLE public.orcamento_contrato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  ciclo_id uuid NOT NULL REFERENCES public.orcamento_ciclo(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES public.contrato(id) ON DELETE CASCADE,
  status orcamento_contrato_status NOT NULL DEFAULT 'rascunho',
  valor_receita_total numeric NOT NULL DEFAULT 0,
  valor_custo_total numeric NOT NULL DEFAULT 0,
  margem_estimada numeric NOT NULL DEFAULT 0,
  gerado_em timestamptz,
  gerado_por uuid,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ciclo_id, contrato_id)
);
CREATE INDEX idx_octr_empresa ON public.orcamento_contrato(empresa_id);
CREATE INDEX idx_octr_contrato ON public.orcamento_contrato(contrato_id);
ALTER TABLE public.orcamento_contrato ENABLE ROW LEVEL SECURITY;
CREATE POLICY "octr_select" ON public.orcamento_contrato FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY "octr_write" ON public.orcamento_contrato FOR ALL TO authenticated
  USING ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
         AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
              AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())));
CREATE TRIGGER octr_set_updated BEFORE UPDATE ON public.orcamento_contrato
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- orcamento_contrato_linha
CREATE TABLE public.orcamento_contrato_linha (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  orcamento_contrato_id uuid NOT NULL REFERENCES public.orcamento_contrato(id) ON DELETE CASCADE,
  dre_linha_id uuid NOT NULL REFERENCES public.dre_linhas(id),
  centro_custo_id uuid REFERENCES public.centros_custo(id),
  competencia date NOT NULL,
  valor_previsto numeric NOT NULL DEFAULT 0,
  source orcamento_linha_source NOT NULL DEFAULT 'manual',
  locked boolean NOT NULL DEFAULT false,
  memoria_calculo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ocl_orc ON public.orcamento_contrato_linha(orcamento_contrato_id);
CREATE INDEX idx_ocl_competencia ON public.orcamento_contrato_linha(competencia);
CREATE INDEX idx_ocl_dre ON public.orcamento_contrato_linha(dre_linha_id);
CREATE UNIQUE INDEX uq_ocl ON public.orcamento_contrato_linha
  (orcamento_contrato_id, dre_linha_id, competencia, COALESCE(centro_custo_id,'00000000-0000-0000-0000-000000000000'::uuid), source);
ALTER TABLE public.orcamento_contrato_linha ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ocl_select" ON public.orcamento_contrato_linha FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY "ocl_write" ON public.orcamento_contrato_linha FOR ALL TO authenticated
  USING ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
         AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
              AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())));
CREATE TRIGGER ocl_set_updated BEFORE UPDATE ON public.orcamento_contrato_linha
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.ocl_locked_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.locked = true AND NEW.valor_previsto IS DISTINCT FROM OLD.valor_previsto THEN
    IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria')) THEN
      RAISE EXCEPTION 'Linha trancada — solicite desbloqueio';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER ocl_locked_guard_trg BEFORE UPDATE ON public.orcamento_contrato_linha
  FOR EACH ROW EXECUTE FUNCTION public.ocl_locked_guard();

-- fluxo_caixa_projetado
CREATE TABLE public.fluxo_caixa_projetado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  contrato_id uuid REFERENCES public.contrato(id) ON DELETE CASCADE,
  orcamento_contrato_id uuid REFERENCES public.orcamento_contrato(id) ON DELETE CASCADE,
  data_prevista date NOT NULL,
  tipo fluxo_tipo NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  descricao text,
  origem text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fcp_empresa ON public.fluxo_caixa_projetado(empresa_id);
CREATE INDEX idx_fcp_data ON public.fluxo_caixa_projetado(data_prevista);
CREATE INDEX idx_fcp_contrato ON public.fluxo_caixa_projetado(contrato_id);
ALTER TABLE public.fluxo_caixa_projetado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fcp_select" ON public.fluxo_caixa_projetado FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY "fcp_write" ON public.fluxo_caixa_projetado FOR ALL TO authenticated
  USING ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
         AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
              AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())));
CREATE TRIGGER fcp_set_updated BEFORE UPDATE ON public.fluxo_caixa_projetado
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- cronograma_faturamento
CREATE TABLE public.cronograma_faturamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  contrato_id uuid NOT NULL REFERENCES public.contrato(id) ON DELETE CASCADE,
  orcamento_contrato_id uuid REFERENCES public.orcamento_contrato(id) ON DELETE SET NULL,
  competencia date NOT NULL,
  data_emissao_prevista date,
  data_recebimento_previsto date,
  valor_previsto numeric NOT NULL DEFAULT 0,
  valor_emitido numeric NOT NULL DEFAULT 0,
  valor_recebido numeric NOT NULL DEFAULT 0,
  status cronograma_status NOT NULL DEFAULT 'previsto',
  numero_nf text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contrato_id, competencia)
);
CREATE INDEX idx_cf_empresa ON public.cronograma_faturamento(empresa_id);
CREATE INDEX idx_cf_competencia ON public.cronograma_faturamento(competencia);
ALTER TABLE public.cronograma_faturamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cf_select" ON public.cronograma_faturamento FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY "cf_write" ON public.cronograma_faturamento FOR ALL TO authenticated
  USING ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
         AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
              AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())));
CREATE TRIGGER cf_set_updated BEFORE UPDATE ON public.cronograma_faturamento
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- aprov_etapa
CREATE TABLE public.aprov_etapa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  ordem integer NOT NULL,
  nome text NOT NULL,
  role_required app_role NOT NULL,
  valor_min numeric DEFAULT 0,
  valor_max numeric,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, ordem)
);
ALTER TABLE public.aprov_etapa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ae_select" ON public.aprov_etapa FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY "ae_write" ON public.aprov_etapa FOR ALL TO authenticated
  USING ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria'))
         AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria'))
              AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())));
CREATE TRIGGER ae_set_updated BEFORE UPDATE ON public.aprov_etapa
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- aprov_instancia
CREATE TABLE public.aprov_instancia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  orcamento_contrato_id uuid NOT NULL REFERENCES public.orcamento_contrato(id) ON DELETE CASCADE,
  etapa_id uuid NOT NULL REFERENCES public.aprov_etapa(id),
  ordem integer NOT NULL,
  decisao aprov_decisao NOT NULL DEFAULT 'pendente',
  decidido_por uuid,
  decidido_em timestamptz,
  comentario text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_orc ON public.aprov_instancia(orcamento_contrato_id);
ALTER TABLE public.aprov_instancia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_select" ON public.aprov_instancia FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY "ai_write" ON public.aprov_instancia FOR ALL TO authenticated
  USING ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm') OR has_role(auth.uid(),'diretor_op'))
         AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())))
  WITH CHECK ((has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm') OR has_role(auth.uid(),'diretor_op'))
              AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid())));
CREATE TRIGGER ai_set_updated BEFORE UPDATE ON public.aprov_instancia
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- solicitacao_desbloqueio
CREATE TABLE public.solicitacao_desbloqueio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  linha_id uuid NOT NULL REFERENCES public.orcamento_contrato_linha(id) ON DELETE CASCADE,
  motivo text NOT NULL,
  novo_valor numeric,
  status desbloqueio_status NOT NULL DEFAULT 'pendente',
  solicitado_por uuid NOT NULL,
  decidido_por uuid,
  decidido_em timestamptz,
  comentario_decisor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.solicitacao_desbloqueio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sd_select" ON public.solicitacao_desbloqueio FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY "sd_insert" ON public.solicitacao_desbloqueio FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa(auth.uid()) AND solicitado_por = auth.uid());
CREATE POLICY "sd_update" ON public.solicitacao_desbloqueio FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'));
CREATE TRIGGER sd_set_updated BEFORE UPDATE ON public.solicitacao_desbloqueio
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- View DRE consolidada
CREATE OR REPLACE VIEW public.vw_dre_contrato AS
SELECT 
  octr.id AS orcamento_contrato_id,
  octr.contrato_id,
  octr.empresa_id,
  octr.ciclo_id,
  ocl.dre_linha_id,
  dl.codigo AS dre_codigo,
  dl.descricao AS dre_descricao,
  dl.natureza AS dre_natureza,
  ocl.competencia,
  SUM(ocl.valor_previsto) AS valor_previsto
FROM public.orcamento_contrato octr
JOIN public.orcamento_contrato_linha ocl ON ocl.orcamento_contrato_id = octr.id
JOIN public.dre_linhas dl ON dl.id = ocl.dre_linha_id
GROUP BY octr.id, octr.contrato_id, octr.empresa_id, octr.ciclo_id, ocl.dre_linha_id, dl.codigo, dl.descricao, dl.natureza, ocl.competencia;

-- RPC gerar_orcamento_contrato
CREATE OR REPLACE FUNCTION public.gerar_orcamento_contrato(_contrato_id uuid, _ciclo_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_contrato RECORD;
  v_param RECORD;
  v_orc_id uuid;
  v_dre_receita uuid;
  v_dre_pessoal uuid;
  v_dre_beneficios uuid;
  v_dre_encargos uuid;
  v_dre_tributos uuid;
  v_competencia date;
  v_meses int;
  v_total_salarios numeric;
  v_total_beneficios numeric;
  v_total_encargos numeric;
  v_total_tributos numeric;
  v_receita_total numeric := 0;
  v_custo_total numeric := 0;
BEGIN
  SELECT * INTO v_contrato FROM public.contrato WHERE id = _contrato_id;
  IF v_contrato IS NULL THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;

  IF NOT (has_role(auth.uid(),'admin')
          OR ((has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm'))
              AND v_contrato.empresa_id = get_user_empresa(auth.uid()))) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT * INTO v_param FROM public.parametro_orcamento WHERE empresa_id = v_contrato.empresa_id;
  IF v_param IS NULL THEN
    INSERT INTO public.parametro_orcamento (empresa_id) VALUES (v_contrato.empresa_id)
    RETURNING * INTO v_param;
  END IF;

  SELECT id INTO v_dre_receita FROM public.dre_linhas
   WHERE (empresa_id = v_contrato.empresa_id OR empresa_id IS NULL)
     AND natureza = 'receita' ORDER BY ordem LIMIT 1;
  SELECT id INTO v_dre_pessoal FROM public.dre_linhas
   WHERE (empresa_id = v_contrato.empresa_id OR empresa_id IS NULL)
     AND descricao ILIKE '%pessoal%' AND natureza = 'custo' ORDER BY ordem LIMIT 1;
  IF v_dre_pessoal IS NULL THEN
    SELECT id INTO v_dre_pessoal FROM public.dre_linhas
     WHERE (empresa_id = v_contrato.empresa_id OR empresa_id IS NULL)
       AND natureza = 'custo' ORDER BY ordem LIMIT 1;
  END IF;
  SELECT id INTO v_dre_beneficios FROM public.dre_linhas
   WHERE (empresa_id = v_contrato.empresa_id OR empresa_id IS NULL)
     AND descricao ILIKE '%benef%' ORDER BY ordem LIMIT 1;
  IF v_dre_beneficios IS NULL THEN v_dre_beneficios := v_dre_pessoal; END IF;
  SELECT id INTO v_dre_encargos FROM public.dre_linhas
   WHERE (empresa_id = v_contrato.empresa_id OR empresa_id IS NULL)
     AND descricao ILIKE '%encargo%' ORDER BY ordem LIMIT 1;
  IF v_dre_encargos IS NULL THEN v_dre_encargos := v_dre_pessoal; END IF;
  SELECT id INTO v_dre_tributos FROM public.dre_linhas
   WHERE (empresa_id = v_contrato.empresa_id OR empresa_id IS NULL)
     AND descricao ILIKE '%tribut%' ORDER BY ordem LIMIT 1;
  IF v_dre_tributos IS NULL THEN
    SELECT id INTO v_dre_tributos FROM public.dre_linhas
     WHERE (empresa_id = v_contrato.empresa_id OR empresa_id IS NULL)
       AND natureza = 'deducao' ORDER BY ordem LIMIT 1;
  END IF;

  IF v_dre_receita IS NULL OR v_dre_pessoal IS NULL THEN
    RAISE EXCEPTION 'Plano DRE incompleto: cadastre linhas de receita e pessoal';
  END IF;

  INSERT INTO public.orcamento_contrato (empresa_id, ciclo_id, contrato_id, status, gerado_em, gerado_por)
  VALUES (v_contrato.empresa_id, _ciclo_id, _contrato_id, 'rascunho', now(), auth.uid())
  ON CONFLICT (ciclo_id, contrato_id) DO UPDATE SET gerado_em = now(), gerado_por = auth.uid()
  RETURNING id INTO v_orc_id;

  DELETE FROM public.orcamento_contrato_linha
   WHERE orcamento_contrato_id = v_orc_id AND source IN ('licitacao','calculado');
  DELETE FROM public.cronograma_faturamento WHERE orcamento_contrato_id = v_orc_id;
  DELETE FROM public.fluxo_caixa_projetado WHERE orcamento_contrato_id = v_orc_id;

  SELECT 
    COALESCE(SUM(quantidade * (salario_base 
      + salario_base * (insalubridade_pct + periculosidade_pct)/100)),0),
    COALESCE(SUM(quantidade * (va + vt + epis + uniformes)),0)
  INTO v_total_salarios, v_total_beneficios
  FROM public.contrato_posto WHERE contrato_id = _contrato_id AND ativo = true;

  v_total_encargos := v_total_salarios * (v_param.pct_encargos_sociais + v_param.pct_provisoes) / 100.0;
  v_total_tributos := v_contrato.faturamento_mensal * v_param.pct_tributos_receita / 100.0;

  v_competencia := date_trunc('month', v_contrato.vigencia_inicio)::date;
  v_meses := 0;
  WHILE v_competencia <= v_contrato.vigencia_fim AND v_meses < 60 LOOP
    INSERT INTO public.orcamento_contrato_linha
      (empresa_id, orcamento_contrato_id, dre_linha_id, centro_custo_id, competencia, valor_previsto, source, locked, memoria_calculo)
    VALUES (v_contrato.empresa_id, v_orc_id, v_dre_receita, v_contrato.centro_custo_id, v_competencia,
            v_contrato.faturamento_mensal, 'licitacao', true, 'Faturamento mensal contrato')
    ON CONFLICT DO NOTHING;
    v_receita_total := v_receita_total + v_contrato.faturamento_mensal;

    INSERT INTO public.orcamento_contrato_linha
      (empresa_id, orcamento_contrato_id, dre_linha_id, centro_custo_id, competencia, valor_previsto, source, locked, memoria_calculo)
    VALUES (v_contrato.empresa_id, v_orc_id, v_dre_pessoal, v_contrato.centro_custo_id, v_competencia,
            v_total_salarios, 'licitacao', true, 'Salários + adicionais (postos)')
    ON CONFLICT DO NOTHING;

    IF v_total_beneficios > 0 THEN
      INSERT INTO public.orcamento_contrato_linha
        (empresa_id, orcamento_contrato_id, dre_linha_id, centro_custo_id, competencia, valor_previsto, source, locked, memoria_calculo)
      VALUES (v_contrato.empresa_id, v_orc_id, v_dre_beneficios, v_contrato.centro_custo_id, v_competencia,
              v_total_beneficios, 'calculado', true, 'VA+VT+EPIs+Uniformes')
      ON CONFLICT DO NOTHING;
    END IF;

    INSERT INTO public.orcamento_contrato_linha
      (empresa_id, orcamento_contrato_id, dre_linha_id, centro_custo_id, competencia, valor_previsto, source, locked, memoria_calculo)
    VALUES (v_contrato.empresa_id, v_orc_id, v_dre_encargos, v_contrato.centro_custo_id, v_competencia,
            v_total_encargos, 'calculado', true,
            'Salarios x ('||v_param.pct_encargos_sociais||'% encargos + '||v_param.pct_provisoes||'% provisoes)')
    ON CONFLICT DO NOTHING;

    IF v_dre_tributos IS NOT NULL AND v_total_tributos > 0 THEN
      INSERT INTO public.orcamento_contrato_linha
        (empresa_id, orcamento_contrato_id, dre_linha_id, centro_custo_id, competencia, valor_previsto, source, locked, memoria_calculo)
      VALUES (v_contrato.empresa_id, v_orc_id, v_dre_tributos, v_contrato.centro_custo_id, v_competencia,
              v_total_tributos, 'calculado', true, 'Receita x '||v_param.pct_tributos_receita||'%')
      ON CONFLICT DO NOTHING;
    END IF;

    v_custo_total := v_custo_total + v_total_salarios + v_total_beneficios + v_total_encargos + v_total_tributos;

    INSERT INTO public.cronograma_faturamento
      (empresa_id, contrato_id, orcamento_contrato_id, competencia, data_emissao_prevista,
       data_recebimento_previsto, valor_previsto, status)
    VALUES (v_contrato.empresa_id, _contrato_id, v_orc_id, v_competencia,
            (v_competencia + interval '1 month - 5 days')::date,
            (v_competencia + interval '2 month')::date,
            v_contrato.faturamento_mensal, 'previsto')
    ON CONFLICT (contrato_id, competencia) DO UPDATE
      SET valor_previsto = EXCLUDED.valor_previsto, orcamento_contrato_id = v_orc_id;

    INSERT INTO public.fluxo_caixa_projetado
      (empresa_id, contrato_id, orcamento_contrato_id, data_prevista, tipo, valor, descricao, origem)
    VALUES (v_contrato.empresa_id, _contrato_id, v_orc_id,
            (v_competencia + interval '2 month')::date, 'entrada',
            v_contrato.faturamento_mensal, 'Recebimento previsto - '||v_contrato.numero, 'cronograma_faturamento');

    INSERT INTO public.fluxo_caixa_projetado
      (empresa_id, contrato_id, orcamento_contrato_id, data_prevista, tipo, valor, descricao, origem)
    VALUES (v_contrato.empresa_id, _contrato_id, v_orc_id,
            (v_competencia + interval '5 days')::date, 'saida',
            v_total_salarios + v_total_beneficios + v_total_encargos, 
            'Folha + benef + encargos - '||v_contrato.numero, 'orcamento_calculado');

    v_competencia := (v_competencia + interval '1 month')::date;
    v_meses := v_meses + 1;
  END LOOP;

  UPDATE public.orcamento_contrato
     SET valor_receita_total = v_receita_total,
         valor_custo_total = v_custo_total,
         margem_estimada = v_receita_total - v_custo_total
   WHERE id = v_orc_id;

  RETURN jsonb_build_object(
    'orcamento_contrato_id', v_orc_id,
    'meses_gerados', v_meses,
    'receita_total', v_receita_total,
    'custo_total', v_custo_total,
    'margem', v_receita_total - v_custo_total
  );
END;
$$;

-- Etapas padrão de aprovação por empresa
INSERT INTO public.aprov_etapa (empresa_id, ordem, nome, role_required, valor_min, valor_max)
SELECT e.id, 1, 'Operacional', 'diretor_op'::app_role, 0, NULL FROM public.empresas e
ON CONFLICT DO NOTHING;
INSERT INTO public.aprov_etapa (empresa_id, ordem, nome, role_required, valor_min, valor_max)
SELECT e.id, 2, 'Controladoria', 'controladoria'::app_role, 0, NULL FROM public.empresas e
ON CONFLICT DO NOTHING;
INSERT INTO public.aprov_etapa (empresa_id, ordem, nome, role_required, valor_min, valor_max)
SELECT e.id, 3, 'Diretoria Adm', 'diretor_adm'::app_role, 500000, NULL FROM public.empresas e
ON CONFLICT DO NOTHING;