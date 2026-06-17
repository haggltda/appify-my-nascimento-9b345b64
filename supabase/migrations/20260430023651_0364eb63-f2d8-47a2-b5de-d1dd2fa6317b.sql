
DO $$ BEGIN
  CREATE TYPE public.regra_evento AS ENUM (
    'nf_servico_autorizada','nf_produto_autorizada','baixa_receber','baixa_pagar',
    'impostos_faturamento','provisao_folha','manual'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.regra_contabilizacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  evento public.regra_evento NOT NULL,
  descricao text NOT NULL,
  conta_debito_id uuid REFERENCES public.conta_contabil(id),
  conta_credito_id uuid REFERENCES public.conta_contabil(id),
  centro_custo_padrao text,
  prioridade integer NOT NULL DEFAULT 100,
  ativo boolean NOT NULL DEFAULT true,
  filtro jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_regra_contab_emp_evento ON public.regra_contabilizacao(empresa_id, evento, ativo);

ALTER TABLE public.lancamento_contabil
  ADD COLUMN IF NOT EXISTS origem_tipo text,
  ADD COLUMN IF NOT EXISTS origem_id uuid,
  ADD COLUMN IF NOT EXISTS competencia date,
  ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE INDEX IF NOT EXISTS idx_lanc_origem ON public.lancamento_contabil(origem_tipo, origem_id);
CREATE INDEX IF NOT EXISTS idx_lanc_emp_data ON public.lancamento_contabil(empresa_id, data_lancamento);

CREATE OR REPLACE FUNCTION public.proximo_numero_lancamento(_empresa_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _seq integer; _ano text;
BEGIN
  _ano := to_char(now(),'YYYY');
  SELECT COALESCE(MAX((regexp_match(numero,'LC-'||_ano||'-(\d+)'))[1]::int),0)+1 INTO _seq
  FROM public.lancamento_contabil
  WHERE empresa_id=_empresa_id AND numero LIKE 'LC-'||_ano||'-%';
  RETURN 'LC-'||_ano||'-'||lpad(_seq::text,5,'0');
END $$;

CREATE OR REPLACE FUNCTION public.contabilizar_nota_fiscal(_nota_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _nf record; _regra record; _lanc_id uuid; _numero text; _evento public.regra_evento; _valor numeric;
BEGIN
  SELECT * INTO _nf FROM public.nota_fiscal WHERE id=_nota_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nota fiscal não encontrada'; END IF;
  IF _nf.status::text<>'autorizada' THEN RAISE EXCEPTION 'Nota não autorizada'; END IF;
  IF EXISTS (SELECT 1 FROM public.lancamento_contabil WHERE origem_tipo='nota_fiscal' AND origem_id=_nota_id) THEN
    RETURN (SELECT id FROM public.lancamento_contabil WHERE origem_tipo='nota_fiscal' AND origem_id=_nota_id LIMIT 1);
  END IF;
  _evento := CASE WHEN _nf.tipo::text='nfse' THEN 'nf_servico_autorizada'::public.regra_evento
                  ELSE 'nf_produto_autorizada'::public.regra_evento END;
  SELECT * INTO _regra FROM public.regra_contabilizacao
   WHERE empresa_id=_nf.empresa_id AND evento=_evento AND ativo
   ORDER BY prioridade LIMIT 1;
  IF NOT FOUND OR _regra.conta_debito_id IS NULL OR _regra.conta_credito_id IS NULL THEN
    RAISE EXCEPTION 'Regra de contabilização não configurada para evento %', _evento;
  END IF;
  _valor := COALESCE(_nf.valor_liquido,_nf.valor_total,_nf.valor_servicos,0);
  _numero := public.proximo_numero_lancamento(_nf.empresa_id);
  INSERT INTO public.lancamento_contabil(empresa_id,numero,data_lancamento,historico,valor_total,origem,status,origem_tipo,origem_id,competencia)
  VALUES (_nf.empresa_id,_numero,COALESCE(_nf.data_emissao::date,CURRENT_DATE),
    'NF '||COALESCE(_nf.numero::text,'s/n')||' - '||_nf.tomador_nome,
    _valor,'fiscal','efetivado','nota_fiscal',_nota_id,_nf.competencia)
  RETURNING id INTO _lanc_id;
  INSERT INTO public.lancamento_partida(lancamento_id,conta_contabil_id,dc,valor,historico) VALUES
    (_lanc_id,_regra.conta_debito_id,'D',_valor,_regra.descricao),
    (_lanc_id,_regra.conta_credito_id,'C',_valor,_regra.descricao);
  RETURN _lanc_id;
END $$;

CREATE OR REPLACE FUNCTION public.contabilizar_baixa_receber(_baixa_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _b record; _regra record; _lanc_id uuid; _numero text;
BEGIN
  SELECT b.*, t.numero_documento, t.cliente_nome
    INTO _b FROM public.titulo_receber_baixa b
    JOIN public.titulo_receber t ON t.id=b.titulo_id
   WHERE b.id=_baixa_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Baixa não encontrada'; END IF;
  IF EXISTS (SELECT 1 FROM public.lancamento_contabil WHERE origem_tipo='titulo_receber_baixa' AND origem_id=_baixa_id) THEN
    RETURN (SELECT id FROM public.lancamento_contabil WHERE origem_tipo='titulo_receber_baixa' AND origem_id=_baixa_id LIMIT 1);
  END IF;
  SELECT * INTO _regra FROM public.regra_contabilizacao
   WHERE empresa_id=_b.empresa_id AND evento='baixa_receber' AND ativo
   ORDER BY prioridade LIMIT 1;
  IF NOT FOUND OR _regra.conta_debito_id IS NULL OR _regra.conta_credito_id IS NULL THEN
    RAISE EXCEPTION 'Regra baixa_receber não configurada';
  END IF;
  _numero := public.proximo_numero_lancamento(_b.empresa_id);
  INSERT INTO public.lancamento_contabil(empresa_id,numero,data_lancamento,historico,valor_total,origem,status,origem_tipo,origem_id,competencia)
  VALUES (_b.empresa_id,_numero,_b.data_baixa,
    'Recebimento '||COALESCE(_b.numero_documento,'')||' '||COALESCE(_b.cliente_nome,''),
    _b.valor,'financeiro','efetivado','titulo_receber_baixa',_baixa_id,date_trunc('month',_b.data_baixa)::date)
  RETURNING id INTO _lanc_id;
  INSERT INTO public.lancamento_partida(lancamento_id,conta_contabil_id,dc,valor,historico) VALUES
    (_lanc_id,_regra.conta_debito_id,'D',_b.valor,_regra.descricao),
    (_lanc_id,_regra.conta_credito_id,'C',_b.valor,_regra.descricao);
  RETURN _lanc_id;
END $$;

CREATE OR REPLACE FUNCTION public.contabilizar_baixa_pagar(_titulo_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _t record; _regra record; _lanc_id uuid; _numero text; _valor numeric;
BEGIN
  SELECT * INTO _t FROM public.titulo_pagar WHERE id=_titulo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Título não encontrado'; END IF;
  IF _t.data_pagamento IS NULL THEN RAISE EXCEPTION 'Sem data de pagamento'; END IF;
  IF EXISTS (SELECT 1 FROM public.lancamento_contabil WHERE origem_tipo='titulo_pagar' AND origem_id=_titulo_id) THEN
    RETURN (SELECT id FROM public.lancamento_contabil WHERE origem_tipo='titulo_pagar' AND origem_id=_titulo_id LIMIT 1);
  END IF;
  SELECT * INTO _regra FROM public.regra_contabilizacao
   WHERE empresa_id=_t.empresa_id AND evento='baixa_pagar' AND ativo
   ORDER BY prioridade LIMIT 1;
  IF NOT FOUND OR _regra.conta_debito_id IS NULL OR _regra.conta_credito_id IS NULL THEN
    RAISE EXCEPTION 'Regra baixa_pagar não configurada';
  END IF;
  _valor := COALESCE(_t.valor_pago,_t.valor);
  _numero := public.proximo_numero_lancamento(_t.empresa_id);
  INSERT INTO public.lancamento_contabil(empresa_id,numero,data_lancamento,historico,valor_total,origem,status,origem_tipo,origem_id,competencia)
  VALUES (_t.empresa_id,_numero,_t.data_pagamento,'Pagamento '||COALESCE(_t.numero_documento,''),_valor,'financeiro','efetivado','titulo_pagar',_titulo_id,_t.competencia)
  RETURNING id INTO _lanc_id;
  INSERT INTO public.lancamento_partida(lancamento_id,conta_contabil_id,dc,valor,historico) VALUES
    (_lanc_id,_regra.conta_debito_id,'D',_valor,_regra.descricao),
    (_lanc_id,_regra.conta_credito_id,'C',_valor,_regra.descricao);
  RETURN _lanc_id;
END $$;

CREATE OR REPLACE FUNCTION public.trg_nf_autorizada_contabiliza()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status::text='autorizada' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    BEGIN PERFORM public.contabilizar_nota_fiscal(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.nota_fiscal_evento(nota_id,tipo,mensagem) VALUES (NEW.id,'erro_contabilizacao',SQLERRM);
    END;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_nf_contabiliza ON public.nota_fiscal;
CREATE TRIGGER trg_nf_contabiliza AFTER INSERT OR UPDATE OF status ON public.nota_fiscal
FOR EACH ROW EXECUTE FUNCTION public.trg_nf_autorizada_contabiliza();

CREATE OR REPLACE FUNCTION public.trg_baixa_receber_contabiliza()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  BEGIN PERFORM public.contabilizar_baixa_receber(NEW.id);
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_baixa_rec_contab ON public.titulo_receber_baixa;
CREATE TRIGGER trg_baixa_rec_contab AFTER INSERT ON public.titulo_receber_baixa
FOR EACH ROW EXECUTE FUNCTION public.trg_baixa_receber_contabiliza();

CREATE OR REPLACE FUNCTION public.trg_titulo_pagar_contabiliza()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.data_pagamento IS NOT NULL AND (TG_OP='INSERT' OR OLD.data_pagamento IS DISTINCT FROM NEW.data_pagamento) THEN
    BEGIN PERFORM public.contabilizar_baixa_pagar(NEW.id);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_tit_pag_contab ON public.titulo_pagar;
CREATE TRIGGER trg_tit_pag_contab AFTER INSERT OR UPDATE OF data_pagamento ON public.titulo_pagar
FOR EACH ROW EXECUTE FUNCTION public.trg_titulo_pagar_contabiliza();

CREATE OR REPLACE FUNCTION public.balancete(_empresa_id uuid, _data_ini date, _data_fim date)
RETURNS TABLE(conta_id uuid, classificacao text, descricao text, natureza text, debito numeric, credito numeric, saldo numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT c.id, c.classificacao, c.descricao, c.natureza::text,
    COALESCE(SUM(CASE WHEN p.dc='D' THEN p.valor END),0),
    COALESCE(SUM(CASE WHEN p.dc='C' THEN p.valor END),0),
    COALESCE(SUM(CASE WHEN p.dc='D' THEN p.valor ELSE -p.valor END),0) * CASE WHEN c.natureza='C' THEN -1 ELSE 1 END
  FROM public.conta_contabil c
  LEFT JOIN public.lancamento_partida p ON p.conta_contabil_id=c.id
  LEFT JOIN public.lancamento_contabil l ON l.id=p.lancamento_id
   AND l.empresa_id=_empresa_id AND l.status='efetivado'
   AND l.data_lancamento BETWEEN _data_ini AND _data_fim
  WHERE c.empresa_id=_empresa_id AND c.tipo='analitica'
  GROUP BY c.id, c.classificacao, c.descricao, c.natureza
  ORDER BY c.classificacao;
$$;

CREATE OR REPLACE FUNCTION public.dre_realizado(_empresa_id uuid, _data_ini date, _data_fim date)
RETURNS TABLE(grupo text, conta_id uuid, classificacao text, descricao text, valor numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT c.grupo_dre::text, c.id, c.classificacao, c.descricao,
    COALESCE(SUM(CASE WHEN p.dc='C' THEN p.valor ELSE -p.valor END),0)
  FROM public.conta_contabil c
  LEFT JOIN public.lancamento_partida p ON p.conta_contabil_id=c.id
  LEFT JOIN public.lancamento_contabil l ON l.id=p.lancamento_id
   AND l.empresa_id=_empresa_id AND l.status='efetivado'
   AND l.data_lancamento BETWEEN _data_ini AND _data_fim
  WHERE c.empresa_id=_empresa_id AND c.grupo_dre='dre' AND c.tipo='analitica'
  GROUP BY c.grupo_dre, c.id, c.classificacao, c.descricao
  ORDER BY c.classificacao;
$$;

CREATE OR REPLACE FUNCTION public.balanco_patrimonial(_empresa_id uuid, _data_corte date)
RETURNS TABLE(grupo text, conta_id uuid, classificacao text, descricao text, saldo numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    CASE WHEN left(c.classificacao,1)='1' THEN 'ATIVO'
         WHEN left(c.classificacao,1)='2' THEN 'PASSIVO'
         ELSE 'PATRIMONIO' END,
    c.id, c.classificacao, c.descricao,
    c.saldo_inicial + COALESCE(SUM(CASE WHEN p.dc='D' THEN p.valor ELSE -p.valor END),0) * CASE WHEN c.natureza='C' THEN -1 ELSE 1 END
  FROM public.conta_contabil c
  LEFT JOIN public.lancamento_partida p ON p.conta_contabil_id=c.id
  LEFT JOIN public.lancamento_contabil l ON l.id=p.lancamento_id
   AND l.empresa_id=_empresa_id AND l.status='efetivado'
   AND l.data_lancamento <= _data_corte
  WHERE c.empresa_id=_empresa_id AND c.grupo_dre IN ('balanco','balanco_gerencial') AND c.tipo='analitica'
  GROUP BY c.id, c.classificacao, c.descricao, c.natureza, c.saldo_inicial
  ORDER BY c.classificacao;
$$;

ALTER TABLE public.regra_contabilizacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS regra_contab_select ON public.regra_contabilizacao;
CREATE POLICY regra_contab_select ON public.regra_contabilizacao FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria') OR
  public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'fiscal') OR
  public.has_role(auth.uid(),'diretor_adm')
);

DROP POLICY IF EXISTS regra_contab_mod ON public.regra_contabilizacao;
CREATE POLICY regra_contab_mod ON public.regra_contabilizacao FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm')
)
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm')
);

DROP TRIGGER IF EXISTS trg_regra_contab_updated ON public.regra_contabilizacao;
CREATE TRIGGER trg_regra_contab_updated BEFORE UPDATE ON public.regra_contabilizacao
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
