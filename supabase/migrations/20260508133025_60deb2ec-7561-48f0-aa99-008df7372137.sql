
-- ENUMs
DO $$ BEGIN
  CREATE TYPE public.pre_titulo_status AS ENUM ('rascunho','em_aprovacao','aprovado','rejeitado','promovido','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.malote_status AS ENUM ('rascunho','enviado','executado','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TABLES
CREATE TABLE IF NOT EXISTS public.pre_titulo_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  fornecedor_id uuid REFERENCES public.fornecedor(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  numero_documento text,
  competencia date,
  data_emissao date NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento date NOT NULL,
  valor numeric(15,2) NOT NULL CHECK (valor > 0),
  conta_contabil_id uuid REFERENCES public.conta_contabil(id) ON DELETE SET NULL,
  centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  contrato_id uuid REFERENCES public.contrato(id) ON DELETE SET NULL,
  forma_pagamento public.titulo_receber_meio,
  status public.pre_titulo_status NOT NULL DEFAULT 'rascunho',
  solicitante_id uuid,
  aprovador_id uuid,
  aprovado_em timestamptz,
  motivo_rejeicao text,
  titulo_pagar_id uuid REFERENCES public.titulo_pagar(id) ON DELETE SET NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pre_titulo_status ON public.pre_titulo_pagar(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_pre_titulo_solicitante ON public.pre_titulo_pagar(solicitante_id);

CREATE TABLE IF NOT EXISTS public.malote_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  conta_bancaria_id uuid NOT NULL REFERENCES public.conta_bancaria(id) ON DELETE RESTRICT,
  data_pagamento date NOT NULL,
  descricao text,
  status public.malote_status NOT NULL DEFAULT 'rascunho',
  qtd_titulos int NOT NULL DEFAULT 0,
  valor_total numeric(15,2) NOT NULL DEFAULT 0,
  remessa_id uuid REFERENCES public.remessa_cnab(id) ON DELETE SET NULL,
  criado_por uuid,
  enviado_em timestamptz,
  executado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_malote_empresa_data ON public.malote_pagamento(empresa_id, data_pagamento);

CREATE TABLE IF NOT EXISTS public.malote_titulo (
  malote_id uuid NOT NULL REFERENCES public.malote_pagamento(id) ON DELETE CASCADE,
  titulo_pagar_id uuid NOT NULL REFERENCES public.titulo_pagar(id) ON DELETE CASCADE,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (malote_id, titulo_pagar_id)
);

-- TRIGGER updated_at
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS tg_pre_titulo_updated ON public.pre_titulo_pagar;
CREATE TRIGGER tg_pre_titulo_updated BEFORE UPDATE ON public.pre_titulo_pagar
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

DROP TRIGGER IF EXISTS tg_malote_updated ON public.malote_pagamento;
CREATE TRIGGER tg_malote_updated BEFORE UPDATE ON public.malote_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- RLS
ALTER TABLE public.pre_titulo_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.malote_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.malote_titulo ENABLE ROW LEVEL SECURITY;

-- pre_titulo: financeiro/controladoria/admin/diretor_adm da empresa
CREATE POLICY "pretitulo_select" ON public.pre_titulo_pagar FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR ((public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm'))
        AND empresa_id = public.get_user_empresa(auth.uid()))
  );
CREATE POLICY "pretitulo_insert" ON public.pre_titulo_pagar FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR ((public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm') OR public.has_role(auth.uid(),'gestor_cc'))
        AND empresa_id = public.get_user_empresa(auth.uid()))
  );
CREATE POLICY "pretitulo_update" ON public.pre_titulo_pagar FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR ((public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm'))
        AND empresa_id = public.get_user_empresa(auth.uid()))
  );

CREATE POLICY "malote_select" ON public.malote_pagamento FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR ((public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm'))
        AND empresa_id = public.get_user_empresa(auth.uid()))
  );
CREATE POLICY "malote_insert" ON public.malote_pagamento FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR ((public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm'))
        AND empresa_id = public.get_user_empresa(auth.uid()))
  );
CREATE POLICY "malote_update" ON public.malote_pagamento FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR ((public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm'))
        AND empresa_id = public.get_user_empresa(auth.uid()))
  );

CREATE POLICY "malote_titulo_select" ON public.malote_titulo FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.malote_pagamento m WHERE m.id = malote_id
                 AND (public.has_role(auth.uid(),'admin')
                      OR ((public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm'))
                          AND m.empresa_id = public.get_user_empresa(auth.uid())))));
CREATE POLICY "malote_titulo_insert" ON public.malote_titulo FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.malote_pagamento m WHERE m.id = malote_id
                      AND (public.has_role(auth.uid(),'admin')
                           OR ((public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm'))
                               AND m.empresa_id = public.get_user_empresa(auth.uid())))));
CREATE POLICY "malote_titulo_delete" ON public.malote_titulo FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.malote_pagamento m WHERE m.id = malote_id
                 AND (public.has_role(auth.uid(),'admin')
                      OR ((public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm'))
                          AND m.empresa_id = public.get_user_empresa(auth.uid())))));

-- ===== RPCs =====

CREATE OR REPLACE FUNCTION public.pre_titulo_submeter(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'financeiro') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm') OR has_role(auth.uid(),'gestor_cc')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  UPDATE pre_titulo_pagar SET status='em_aprovacao'::pre_titulo_status WHERE id=_id AND status='rascunho';
  IF NOT FOUND THEN RAISE EXCEPTION 'Pré-título não encontrado ou não está em rascunho'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.pre_titulo_aprovar(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm')) THEN
    RAISE EXCEPTION 'Apenas admin, controladoria ou diretor administrativo podem aprovar';
  END IF;
  UPDATE pre_titulo_pagar
     SET status='aprovado'::pre_titulo_status, aprovador_id=auth.uid(), aprovado_em=now()
   WHERE id=_id AND status='em_aprovacao';
  IF NOT FOUND THEN RAISE EXCEPTION 'Pré-título não encontrado ou não está em aprovação'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.pre_titulo_rejeitar(_id uuid, _motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'diretor_adm')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  UPDATE pre_titulo_pagar
     SET status='rejeitado'::pre_titulo_status, aprovador_id=auth.uid(), aprovado_em=now(), motivo_rejeicao=_motivo
   WHERE id=_id AND status='em_aprovacao';
  IF NOT FOUND THEN RAISE EXCEPTION 'Pré-título não encontrado ou não está em aprovação'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.pre_titulo_promover(_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_pt RECORD; v_titulo_id uuid;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'financeiro') OR has_role(auth.uid(),'diretor_adm')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  SELECT * INTO v_pt FROM pre_titulo_pagar WHERE id=_id;
  IF v_pt IS NULL THEN RAISE EXCEPTION 'Pré-título não encontrado'; END IF;
  IF v_pt.status <> 'aprovado' THEN RAISE EXCEPTION 'Pré-título precisa estar aprovado para virar título'; END IF;

  INSERT INTO titulo_pagar(
    empresa_id, fornecedor_id, numero_documento, competencia, data_emissao, data_vencimento,
    valor, conta_contabil_id, centro_custo_id, forma_pagamento, status, observacoes, parcela_num, parcela_total
  ) VALUES (
    v_pt.empresa_id, v_pt.fornecedor_id, COALESCE(v_pt.numero_documento, 'PT-'||left(v_pt.id::text,8)),
    COALESCE(v_pt.competencia, date_trunc('month', v_pt.data_vencimento)::date),
    v_pt.data_emissao, v_pt.data_vencimento,
    v_pt.valor, v_pt.conta_contabil_id, v_pt.centro_custo_id,
    COALESCE(v_pt.forma_pagamento::text::forma_pagamento, 'boleto'::forma_pagamento),
    'aberto'::titulo_status, v_pt.observacoes, 1, 1
  ) RETURNING id INTO v_titulo_id;

  UPDATE pre_titulo_pagar
     SET status='promovido'::pre_titulo_status, titulo_pagar_id=v_titulo_id
   WHERE id=_id;

  RETURN v_titulo_id;
END $$;

CREATE OR REPLACE FUNCTION public.malote_criar(_empresa_id uuid, _conta_bancaria_id uuid, _data_pagamento date, _descricao text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'financeiro') OR has_role(auth.uid(),'diretor_adm')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  INSERT INTO malote_pagamento(empresa_id, conta_bancaria_id, data_pagamento, descricao, criado_por)
  VALUES (_empresa_id, _conta_bancaria_id, _data_pagamento, _descricao, auth.uid()) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.malote_adicionar_titulo(_malote_id uuid, _titulo_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_m RECORD; v_t RECORD;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'financeiro') OR has_role(auth.uid(),'diretor_adm')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  SELECT * INTO v_m FROM malote_pagamento WHERE id=_malote_id;
  IF v_m IS NULL THEN RAISE EXCEPTION 'Malote não encontrado'; END IF;
  IF v_m.status <> 'rascunho' THEN RAISE EXCEPTION 'Malote já enviado/executado'; END IF;
  SELECT * INTO v_t FROM titulo_pagar WHERE id=_titulo_id;
  IF v_t IS NULL THEN RAISE EXCEPTION 'Título não encontrado'; END IF;
  IF v_t.empresa_id <> v_m.empresa_id THEN RAISE EXCEPTION 'Título de empresa diferente do malote'; END IF;
  IF v_t.status NOT IN ('aberto','agendado','parcial') THEN RAISE EXCEPTION 'Título não está em status pagável'; END IF;

  INSERT INTO malote_titulo(malote_id, titulo_pagar_id) VALUES (_malote_id, _titulo_id) ON CONFLICT DO NOTHING;
  UPDATE malote_pagamento m
     SET qtd_titulos = (SELECT COUNT(*) FROM malote_titulo WHERE malote_id=m.id),
         valor_total = (SELECT COALESCE(SUM(t.valor),0) FROM malote_titulo mt JOIN titulo_pagar t ON t.id=mt.titulo_pagar_id WHERE mt.malote_id=m.id)
   WHERE id=_malote_id;
END $$;

CREATE OR REPLACE FUNCTION public.malote_remover_titulo(_malote_id uuid, _titulo_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_m RECORD;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'financeiro') OR has_role(auth.uid(),'diretor_adm')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  SELECT * INTO v_m FROM malote_pagamento WHERE id=_malote_id;
  IF v_m.status <> 'rascunho' THEN RAISE EXCEPTION 'Malote já enviado/executado'; END IF;
  DELETE FROM malote_titulo WHERE malote_id=_malote_id AND titulo_pagar_id=_titulo_id;
  UPDATE malote_pagamento m
     SET qtd_titulos = (SELECT COUNT(*) FROM malote_titulo WHERE malote_id=m.id),
         valor_total = (SELECT COALESCE(SUM(t.valor),0) FROM malote_titulo mt JOIN titulo_pagar t ON t.id=mt.titulo_pagar_id WHERE mt.malote_id=m.id)
   WHERE id=_malote_id;
END $$;

CREATE OR REPLACE FUNCTION public.malote_executar(_malote_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_m RECORD; v_ids uuid[]; v_remessa jsonb;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'financeiro') OR has_role(auth.uid(),'diretor_adm')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  SELECT * INTO v_m FROM malote_pagamento WHERE id=_malote_id;
  IF v_m IS NULL THEN RAISE EXCEPTION 'Malote não encontrado'; END IF;
  IF v_m.status <> 'rascunho' THEN RAISE EXCEPTION 'Malote já enviado'; END IF;
  IF v_m.qtd_titulos = 0 THEN RAISE EXCEPTION 'Malote sem títulos'; END IF;

  SELECT array_agg(titulo_pagar_id) INTO v_ids FROM malote_titulo WHERE malote_id=_malote_id;
  v_remessa := cnab_gerar_remessa(v_m.conta_bancaria_id, v_ids);

  UPDATE malote_pagamento
     SET status='enviado'::malote_status,
         remessa_id = (v_remessa->>'remessa_id')::uuid,
         enviado_em = now()
   WHERE id=_malote_id;

  RETURN v_remessa;
END $$;

CREATE OR REPLACE FUNCTION public.titulo_pagar_baixar(
  _titulo_id uuid,
  _valor numeric,
  _data_baixa date DEFAULT CURRENT_DATE,
  _conta_bancaria_id uuid DEFAULT NULL,
  _juros numeric DEFAULT 0,
  _multa numeric DEFAULT 0,
  _desconto numeric DEFAULT 0,
  _observacoes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_t RECORD; v_saldo numeric; v_novo_pago numeric; v_novo_status titulo_status;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'financeiro') OR has_role(auth.uid(),'diretor_adm')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF _valor <= 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
  SELECT * INTO v_t FROM titulo_pagar WHERE id=_titulo_id FOR UPDATE;
  IF v_t IS NULL THEN RAISE EXCEPTION 'Título não encontrado'; END IF;
  IF v_t.status = 'pago' THEN RAISE EXCEPTION 'Título já pago'; END IF;
  IF v_t.status = 'cancelado' THEN RAISE EXCEPTION 'Título cancelado'; END IF;

  v_saldo := v_t.valor - COALESCE(v_t.valor_pago,0) + COALESCE(_juros,0) + COALESCE(_multa,0) - COALESCE(_desconto,0);
  IF _valor > v_saldo + 0.01 THEN RAISE EXCEPTION 'Valor maior que saldo (%) ', v_saldo; END IF;

  v_novo_pago := COALESCE(v_t.valor_pago,0) + _valor;
  v_novo_status := CASE
    WHEN v_novo_pago >= v_t.valor + COALESCE(_juros,0) + COALESCE(_multa,0) - COALESCE(_desconto,0) - 0.01 THEN 'pago'::titulo_status
    ELSE 'parcial'::titulo_status
  END;

  UPDATE titulo_pagar
     SET valor_pago = v_novo_pago,
         status = v_novo_status,
         data_pagamento = CASE WHEN v_novo_status='pago' THEN _data_baixa ELSE data_pagamento END,
         conta_bancaria_id = COALESCE(_conta_bancaria_id, conta_bancaria_id),
         observacoes = COALESCE(observacoes,'') || CASE WHEN _observacoes IS NOT NULL THEN E'\n[BAIXA '||to_char(_data_baixa,'DD/MM/YYYY')||'] '||_observacoes ELSE '' END
   WHERE id=_titulo_id;

  RETURN jsonb_build_object('titulo_id', _titulo_id, 'status', v_novo_status, 'valor_pago_total', v_novo_pago, 'saldo', v_t.valor - v_novo_pago);
END $$;

GRANT EXECUTE ON FUNCTION public.pre_titulo_submeter(uuid),
                          public.pre_titulo_aprovar(uuid),
                          public.pre_titulo_rejeitar(uuid,text),
                          public.pre_titulo_promover(uuid),
                          public.malote_criar(uuid,uuid,date,text),
                          public.malote_adicionar_titulo(uuid,uuid),
                          public.malote_remover_titulo(uuid,uuid),
                          public.malote_executar(uuid),
                          public.titulo_pagar_baixar(uuid,numeric,date,uuid,numeric,numeric,numeric,text)
TO authenticated;
