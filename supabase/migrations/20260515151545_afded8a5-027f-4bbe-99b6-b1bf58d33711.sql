
-- =========================================================================
-- BLOCO D — Disparadores automáticos de contabilização
-- =========================================================================

-- Helper: resolve conta_contabil de uma conta_bancaria
CREATE OR REPLACE FUNCTION public._conta_contabil_de_banco(p_conta_bancaria_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT conta_contabil_id FROM conta_bancaria WHERE id = p_conta_bancaria_id;
$$;

-- =========================================================================
-- 1. NF SAÍDA AUTORIZADA → EVT-005 + impostos EVT-006-A/B/C
-- =========================================================================
CREATE OR REPLACE FUNCTION public.trg_contabilizar_nf_saida()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_lanc uuid;
BEGIN
  IF NEW.status = 'autorizada' AND COALESCE(OLD.status::text,'') <> 'autorizada' THEN
    BEGIN
      v_lanc := gerar_lancamento_contabil(
        NEW.empresa_id, 'EVT-005', NEW.data_emissao::date, NEW.valor_total,
        'Faturamento NF '||COALESCE(NEW.numero::text, NEW.id::text),
        'nota_fiscal', NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'NF saída % EVT-005 falhou: %', NEW.id, SQLERRM;
    END;

    IF COALESCE(NEW.valor_pis,0) > 0 THEN
      BEGIN v_lanc := gerar_lancamento_contabil(NEW.empresa_id,'EVT-006-A',NEW.data_emissao::date,NEW.valor_pis,'PIS s/ NF '||COALESCE(NEW.numero::text,NEW.id::text),'nota_fiscal',NEW.id);
      EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'PIS NF % falhou: %', NEW.id, SQLERRM; END;
    END IF;
    IF COALESCE(NEW.valor_cofins,0) > 0 THEN
      BEGIN v_lanc := gerar_lancamento_contabil(NEW.empresa_id,'EVT-006-B',NEW.data_emissao::date,NEW.valor_cofins,'COFINS s/ NF '||COALESCE(NEW.numero::text,NEW.id::text),'nota_fiscal',NEW.id);
      EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'COFINS NF % falhou: %', NEW.id, SQLERRM; END;
    END IF;
    IF COALESCE(NEW.valor_iss,0) > 0 THEN
      BEGIN v_lanc := gerar_lancamento_contabil(NEW.empresa_id,'EVT-006-C',NEW.data_emissao::date,NEW.valor_iss,'ISS s/ NF '||COALESCE(NEW.numero::text,NEW.id::text),'nota_fiscal',NEW.id);
      EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'ISS NF % falhou: %', NEW.id, SQLERRM; END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contabilizar_nf_saida ON public.nota_fiscal;
CREATE TRIGGER trg_contabilizar_nf_saida
AFTER UPDATE OF status ON public.nota_fiscal
FOR EACH ROW EXECUTE FUNCTION public.trg_contabilizar_nf_saida();

-- =========================================================================
-- 2. TÍTULO A PAGAR → pago → EVT-004
-- =========================================================================
CREATE OR REPLACE FUNCTION public.trg_contabilizar_pagamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_conta_banco uuid;
  v_lanc uuid;
  v_valor numeric;
BEGIN
  IF NEW.status = 'pago' AND COALESCE(OLD.status::text,'') <> 'pago' THEN
    v_valor := COALESCE(NEW.valor_pago, NEW.valor);
    v_conta_banco := _conta_contabil_de_banco(NEW.conta_bancaria_id);
    IF v_conta_banco IS NULL THEN
      RAISE NOTICE 'Pagamento título %: conta bancária sem conta contábil vinculada', NEW.id;
      RETURN NEW;
    END IF;
    BEGIN
      v_lanc := gerar_lancamento_contabil(
        NEW.empresa_id, 'EVT-004',
        COALESCE(NEW.data_pagamento, CURRENT_DATE), v_valor,
        'Pagamento título a pagar',
        'titulo_pagar', NEW.id, NULL, v_conta_banco);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'EVT-004 título % falhou: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contabilizar_pagamento ON public.titulo_pagar;
CREATE TRIGGER trg_contabilizar_pagamento
AFTER UPDATE OF status ON public.titulo_pagar
FOR EACH ROW EXECUTE FUNCTION public.trg_contabilizar_pagamento();

-- =========================================================================
-- 3. TÍTULO A RECEBER → pago → EVT-007
-- =========================================================================
CREATE OR REPLACE FUNCTION public.trg_contabilizar_recebimento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_conta_banco uuid;
  v_lanc uuid;
  v_valor numeric;
BEGIN
  IF NEW.status = 'pago' AND COALESCE(OLD.status::text,'') <> 'pago' THEN
    v_valor := COALESCE(NEW.valor_recebido, NEW.valor);
    v_conta_banco := _conta_contabil_de_banco(NEW.conta_bancaria_id);
    IF v_conta_banco IS NULL THEN
      RAISE NOTICE 'Recebimento título %: conta bancária sem conta contábil vinculada', NEW.id;
      RETURN NEW;
    END IF;
    BEGIN
      v_lanc := gerar_lancamento_contabil(
        NEW.empresa_id, 'EVT-007',
        COALESCE(NEW.data_recebimento, CURRENT_DATE), v_valor,
        'Recebimento título a receber',
        'titulo_receber', NEW.id, NULL, v_conta_banco);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'EVT-007 título % falhou: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contabilizar_recebimento ON public.titulo_receber;
CREATE TRIGGER trg_contabilizar_recebimento
AFTER UPDATE OF status ON public.titulo_receber
FOR EACH ROW EXECUTE FUNCTION public.trg_contabilizar_recebimento();

-- =========================================================================
-- 4. NF ENTRADA — função pública para chamada explícita
-- (categoria limpeza/epi/peças/consumo/admin não auto-detectável)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.contabilizar_nf_entrada(
  p_nf_id uuid,
  p_codigo_evento text  -- 'EVT-001-A','EVT-001-B','EVT-001-C','EVT-002' ou 'EVT-003'
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_nf nf_entrada%ROWTYPE;
  v_lanc uuid;
BEGIN
  SELECT * INTO v_nf FROM nf_entrada WHERE id = p_nf_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NF entrada % não encontrada', p_nf_id; END IF;
  IF p_codigo_evento NOT IN ('EVT-001-A','EVT-001-B','EVT-001-C','EVT-002','EVT-003') THEN
    RAISE EXCEPTION 'Evento inválido para NF entrada: %', p_codigo_evento;
  END IF;
  v_lanc := gerar_lancamento_contabil(
    v_nf.empresa_id, p_codigo_evento, v_nf.data_emissao, v_nf.valor_total,
    'NF entrada', 'nf_entrada', v_nf.id);
  RETURN v_lanc;
END;
$$;
