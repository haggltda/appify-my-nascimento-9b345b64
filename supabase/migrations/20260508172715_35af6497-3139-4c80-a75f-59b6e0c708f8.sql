-- Reset and seed saldos iniciais balanceados para cada empresa
DO $$
DECLARE
  emp RECORD;
  v_ativo_total numeric;
  v_passivo_pl_total numeric;
BEGIN
  FOR emp IN SELECT id, nome_fantasia FROM public.empresas LOOP
    -- Zerar saldos do balanço primeiro
    UPDATE public.conta_contabil
       SET saldo_inicial = 0
     WHERE empresa_id = emp.id
       AND grupo_dre IN ('balanco','balanco_gerencial');

    -- ATIVO CIRCULANTE - Disponibilidades / Caixa
    UPDATE public.conta_contabil SET saldo_inicial = 75000
     WHERE empresa_id = emp.id AND tipo='analitica' AND classificacao LIKE '01.1.1.01%';

    -- ATIVO - Bancos conta movimento (distribuir 1.500.000 entre as analíticas)
    WITH bancos AS (
      SELECT id, row_number() OVER (ORDER BY classificacao) AS rn, count(*) OVER () AS total
        FROM public.conta_contabil
       WHERE empresa_id = emp.id AND tipo='analitica' AND classificacao LIKE '01.1.1.02%'
    )
    UPDATE public.conta_contabil c
       SET saldo_inicial = round((1500000.0 / GREATEST(b.total,1))::numeric, 2)
      FROM bancos b WHERE c.id = b.id;

    -- ATIVO - Aplicações financeiras
    UPDATE public.conta_contabil SET saldo_inicial = 800000
     WHERE empresa_id = emp.id AND tipo='analitica' AND classificacao LIKE '01.1.1.03%';

    -- ATIVO - Clientes / Contas a Receber (01.1.2)
    WITH clientes AS (
      SELECT id, count(*) OVER () AS total FROM public.conta_contabil
       WHERE empresa_id = emp.id AND tipo='analitica' AND classificacao LIKE '01.1.2%'
    )
    UPDATE public.conta_contabil c
       SET saldo_inicial = round((2500000.0 / GREATEST(cl.total,1))::numeric, 2)
      FROM clientes cl WHERE c.id = cl.id;

    -- ATIVO - Estoques (01.1.3)
    WITH est AS (
      SELECT id, count(*) OVER () AS total FROM public.conta_contabil
       WHERE empresa_id = emp.id AND tipo='analitica' AND classificacao LIKE '01.1.3%'
    )
    UPDATE public.conta_contabil c
       SET saldo_inicial = round((350000.0 / GREATEST(est.total,1))::numeric, 2)
      FROM est WHERE c.id = est.id;

    -- ATIVO - Outros Créditos / Adiantamentos (01.1.4 / 01.1.5)
    WITH oc AS (
      SELECT id, count(*) OVER () AS total FROM public.conta_contabil
       WHERE empresa_id = emp.id AND tipo='analitica' 
       AND (classificacao LIKE '01.1.4%' OR classificacao LIKE '01.1.5%')
    )
    UPDATE public.conta_contabil c
       SET saldo_inicial = round((280000.0 / GREATEST(oc.total,1))::numeric, 2)
      FROM oc WHERE c.id = oc.id;

    -- ATIVO NÃO CIRCULANTE - Realizável a Longo Prazo (01.2)
    WITH alp AS (
      SELECT id, count(*) OVER () AS total FROM public.conta_contabil
       WHERE empresa_id = emp.id AND tipo='analitica' AND classificacao LIKE '01.2%'
    )
    UPDATE public.conta_contabil c
       SET saldo_inicial = round((420000.0 / GREATEST(alp.total,1))::numeric, 2)
      FROM alp WHERE c.id = alp.id;

    -- ATIVO - Imobilizado (01.3)
    WITH imob AS (
      SELECT id, count(*) OVER () AS total FROM public.conta_contabil
       WHERE empresa_id = emp.id AND tipo='analitica' AND classificacao LIKE '01.3%'
    )
    UPDATE public.conta_contabil c
       SET saldo_inicial = round((3200000.0 / GREATEST(imob.total,1))::numeric, 2)
      FROM imob WHERE c.id = imob.id;

    -- ATIVO - Intangível (01.4)
    WITH intg AS (
      SELECT id, count(*) OVER () AS total FROM public.conta_contabil
       WHERE empresa_id = emp.id AND tipo='analitica' AND classificacao LIKE '01.4%'
    )
    UPDATE public.conta_contabil c
       SET saldo_inicial = round((150000.0 / GREATEST(intg.total,1))::numeric, 2)
      FROM intg WHERE c.id = intg.id;

    -- Soma do ATIVO realmente lançado
    SELECT COALESCE(SUM(saldo_inicial),0) INTO v_ativo_total
      FROM public.conta_contabil
     WHERE empresa_id = emp.id AND tipo='analitica' AND classificacao LIKE '01%';

    -- PASSIVO CIRCULANTE - Fornecedores (02.1.1)
    WITH forn AS (
      SELECT id, count(*) OVER () AS total FROM public.conta_contabil
       WHERE empresa_id = emp.id AND tipo='analitica' AND classificacao LIKE '02.1.1%'
    )
    UPDATE public.conta_contabil c
       SET saldo_inicial = round((1100000.0 / GREATEST(forn.total,1))::numeric, 2)
      FROM forn WHERE c.id = forn.id;

    -- PASSIVO - Obrigações Trabalhistas (02.1.2)
    WITH trab AS (
      SELECT id, count(*) OVER () AS total FROM public.conta_contabil
       WHERE empresa_id = emp.id AND tipo='analitica' AND classificacao LIKE '02.1.2%'
    )
    UPDATE public.conta_contabil c
       SET saldo_inicial = round((680000.0 / GREATEST(trab.total,1))::numeric, 2)
      FROM trab WHERE c.id = trab.id;

    -- PASSIVO - Obrigações Fiscais / Tributárias (02.1.3)
    WITH trib AS (
      SELECT id, count(*) OVER () AS total FROM public.conta_contabil
       WHERE empresa_id = emp.id AND tipo='analitica' AND classificacao LIKE '02.1.3%'
    )
    UPDATE public.conta_contabil c
       SET saldo_inicial = round((420000.0 / GREATEST(trib.total,1))::numeric, 2)
      FROM trib WHERE c.id = trib.id;

    -- PASSIVO - Empréstimos / Financiamentos CP (02.1.4)
    WITH emp_cp AS (
      SELECT id, count(*) OVER () AS total FROM public.conta_contabil
       WHERE empresa_id = emp.id AND tipo='analitica' AND classificacao LIKE '02.1.4%'
    )
    UPDATE public.conta_contabil c
       SET saldo_inicial = round((550000.0 / GREATEST(emp_cp.total,1))::numeric, 2)
      FROM emp_cp WHERE c.id = emp_cp.id;

    -- PASSIVO NÃO CIRCULANTE (02.2)
    WITH pnc AS (
      SELECT id, count(*) OVER () AS total FROM public.conta_contabil
       WHERE empresa_id = emp.id AND tipo='analitica' AND classificacao LIKE '02.2%'
    )
    UPDATE public.conta_contabil c
       SET saldo_inicial = round((900000.0 / GREATEST(pnc.total,1))::numeric, 2)
      FROM pnc WHERE c.id = pnc.id;

    -- PATRIMÔNIO LÍQUIDO - Capital Social (02.3.1)
    WITH cap AS (
      SELECT id, count(*) OVER () AS total FROM public.conta_contabil
       WHERE empresa_id = emp.id AND tipo='analitica' AND classificacao LIKE '02.3.1%'
    )
    UPDATE public.conta_contabil c
       SET saldo_inicial = round((2500000.0 / GREATEST(cap.total,1))::numeric, 2)
      FROM cap WHERE c.id = cap.id;

    -- PATRIMÔNIO LÍQUIDO - Reservas (02.3.2)
    WITH res AS (
      SELECT id, count(*) OVER () AS total FROM public.conta_contabil
       WHERE empresa_id = emp.id AND tipo='analitica' AND classificacao LIKE '02.3.2%'
    )
    UPDATE public.conta_contabil c
       SET saldo_inicial = round((600000.0 / GREATEST(res.total,1))::numeric, 2)
      FROM res WHERE c.id = res.id;

    -- Calcula Passivo+PL atual
    SELECT COALESCE(SUM(saldo_inicial),0) INTO v_passivo_pl_total
      FROM public.conta_contabil
     WHERE empresa_id = emp.id AND tipo='analitica' AND classificacao LIKE '02%';

    -- Ajusta Lucros/Prejuízos Acumulados (02.3.3) para fechar Ativo = Passivo+PL
    WITH lucros AS (
      SELECT id, row_number() OVER (ORDER BY classificacao) AS rn, count(*) OVER () AS total
        FROM public.conta_contabil
       WHERE empresa_id = emp.id AND tipo='analitica' AND classificacao LIKE '02.3.3%'
    ), primary_lucro AS (
      SELECT id FROM lucros WHERE rn = 1
    )
    UPDATE public.conta_contabil c
       SET saldo_inicial = (v_ativo_total - v_passivo_pl_total)
      FROM primary_lucro p
     WHERE c.id = p.id;

    -- Se não houver conta 02.3.3, usar primeira analítica do PL para fechar
    IF NOT EXISTS (
      SELECT 1 FROM public.conta_contabil
       WHERE empresa_id = emp.id AND tipo='analitica' AND classificacao LIKE '02.3.3%'
    ) THEN
      WITH pl AS (
        SELECT id FROM public.conta_contabil
         WHERE empresa_id = emp.id AND tipo='analitica' AND classificacao LIKE '02.3%'
         ORDER BY classificacao DESC LIMIT 1
      )
      UPDATE public.conta_contabil c
         SET saldo_inicial = saldo_inicial + (v_ativo_total - v_passivo_pl_total)
        FROM pl WHERE c.id = pl.id;
    END IF;
  END LOOP;
END $$;