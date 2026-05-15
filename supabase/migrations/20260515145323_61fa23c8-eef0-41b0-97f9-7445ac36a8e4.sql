
DO $$
DECLARE
  v_empresa RECORD;
  v_hagg_id uuid;
BEGIN
  SELECT id INTO v_hagg_id FROM empresas
   WHERE upper(coalesce(nome_fantasia, razao_social)) LIKE '%HAGG%'
   LIMIT 1;

  FOR v_empresa IN SELECT id FROM empresas LOOP

    UPDATE regra_contabilizacao SET
      conta_debito_id  = (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='04.1.3.03.003'),
      conta_credito_id = (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='02.1.1.01'),
      prioridade=10, ativo=true
    WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-002';

    UPDATE regra_contabilizacao SET
      conta_debito_id  = (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='04.2.1.03.020'),
      conta_credito_id = (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='02.1.1.01'),
      prioridade=10, ativo=true
    WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-003';

    UPDATE regra_contabilizacao SET
      conta_debito_id  = (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='02.1.1.01'),
      conta_credito_id = (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='01.1.1.02'),
      prioridade=10, ativo=true
    WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-004';

    UPDATE regra_contabilizacao SET
      conta_debito_id  = (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='01.1.2.01'),
      conta_credito_id = (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='03.1.1.03.003'),
      prioridade=10, ativo=true
    WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-005';

    UPDATE regra_contabilizacao SET
      conta_debito_id  = (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='04.1.3.02.013'),
      conta_credito_id = (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='02.1.2.01'),
      prioridade=10, ativo=true
    WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-008';

    UPDATE regra_contabilizacao SET
      conta_debito_id  = (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='02.1.2.01'),
      conta_credito_id = (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='01.1.1.02'),
      prioridade=10, ativo=true
    WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-009';

    UPDATE regra_contabilizacao SET
      conta_debito_id  = (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='02.1.2.04'),
      conta_credito_id = (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='01.1.1.02'),
      prioridade=10, ativo=true
    WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-010';

    UPDATE regra_contabilizacao SET
      conta_debito_id  = (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='01.1.2.03'),
      conta_credito_id = (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='01.1.1.02'),
      prioridade=10, ativo=true
    WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-011';

    UPDATE regra_contabilizacao SET
      conta_debito_id  = (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='01.1.1.02'),
      conta_credito_id = (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='02.1.4'),
      prioridade=10, ativo=true
    WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-012';

    UPDATE regra_contabilizacao SET
      conta_debito_id  = (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='04.2.1.03.020'),
      conta_credito_id = (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='02.1.4'),
      prioridade=10, ativo=true
    WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-013';

    UPDATE regra_contabilizacao SET
      conta_debito_id=NULL, conta_credito_id=NULL,
      prioridade=10, ativo=true,
      observacao='Ajuste contábil manual - contas definidas no lançamento'
    WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-014';

    UPDATE regra_contabilizacao SET
      conta_debito_id  = (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='04.1.3.03.003'),
      conta_credito_id = (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='01.1.4.03'),
      prioridade=10, ativo=true
    WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-015';

    UPDATE regra_contabilizacao SET
      prioridade=99, ativo=false,
      observacao='Substituída por sub-regras EVT-001-A/B/C'
    WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-001';

    UPDATE regra_contabilizacao SET
      prioridade=99, ativo=false,
      observacao='Substituída por sub-regras EVT-006-A/B/C/D'
    WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-006';

    UPDATE regra_contabilizacao SET
      conta_debito_id  = (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='01.1.1.02'),
      conta_credito_id = (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='01.1.2.01'),
      prioridade=10, ativo=true
    WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-007';

    INSERT INTO regra_contabilizacao (empresa_id, evento, codigo_evento, descricao, conta_debito_id, conta_credito_id, prioridade, ativo, filtro, exige_contrato, exige_centro_custo, requer_pedido)
    SELECT v_empresa.id, (SELECT evento FROM regra_contabilizacao WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-001' LIMIT 1),
           'EVT-001-A', 'NF entrada — Limpeza',
           (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='01.1.4.01'),
           (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='02.1.1.01'),
           10, true, '{"categoria":"limpeza"}'::jsonb, false, false, false
    WHERE NOT EXISTS (SELECT 1 FROM regra_contabilizacao WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-001-A');

    INSERT INTO regra_contabilizacao (empresa_id, evento, codigo_evento, descricao, conta_debito_id, conta_credito_id, prioridade, ativo, filtro, exige_contrato, exige_centro_custo, requer_pedido)
    SELECT v_empresa.id, (SELECT evento FROM regra_contabilizacao WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-001' LIMIT 1),
           'EVT-001-B', 'NF entrada — EPIs/Uniformes',
           (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='01.1.4.02'),
           (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='02.1.1.01'),
           10, true, '{"categoria":"epi_uniforme"}'::jsonb, false, false, false
    WHERE NOT EXISTS (SELECT 1 FROM regra_contabilizacao WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-001-B');

    INSERT INTO regra_contabilizacao (empresa_id, evento, codigo_evento, descricao, conta_debito_id, conta_credito_id, prioridade, ativo, filtro, exige_contrato, exige_centro_custo, requer_pedido)
    SELECT v_empresa.id, (SELECT evento FROM regra_contabilizacao WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-001' LIMIT 1),
           'EVT-001-C', 'NF entrada — Peças/Equipamentos',
           (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='01.1.4.03'),
           (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='02.1.1.01'),
           10, true, '{"categoria":"pecas_equip"}'::jsonb, false, false, false
    WHERE NOT EXISTS (SELECT 1 FROM regra_contabilizacao WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-001-C');

    INSERT INTO regra_contabilizacao (empresa_id, evento, codigo_evento, descricao, conta_debito_id, conta_credito_id, prioridade, ativo, filtro, exige_contrato, exige_centro_custo, requer_pedido)
    SELECT v_empresa.id, (SELECT evento FROM regra_contabilizacao WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-006' LIMIT 1),
           'EVT-006-A', 'Tributos faturamento — PIS',
           (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='03.1.2.02.002'),
           (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='02.1.3.02'),
           10, true, '{"tributo":"PIS"}'::jsonb, false, false, false
    WHERE NOT EXISTS (SELECT 1 FROM regra_contabilizacao WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-006-A');

    INSERT INTO regra_contabilizacao (empresa_id, evento, codigo_evento, descricao, conta_debito_id, conta_credito_id, prioridade, ativo, filtro, exige_contrato, exige_centro_custo, requer_pedido)
    SELECT v_empresa.id, (SELECT evento FROM regra_contabilizacao WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-006' LIMIT 1),
           'EVT-006-B', 'Tributos faturamento — COFINS',
           (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='03.1.2.02.003'),
           (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='02.1.3.03'),
           10, true, '{"tributo":"COFINS"}'::jsonb, false, false, false
    WHERE NOT EXISTS (SELECT 1 FROM regra_contabilizacao WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-006-B');

    INSERT INTO regra_contabilizacao (empresa_id, evento, codigo_evento, descricao, conta_debito_id, conta_credito_id, prioridade, ativo, filtro, exige_contrato, exige_centro_custo, requer_pedido)
    SELECT v_empresa.id, (SELECT evento FROM regra_contabilizacao WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-006' LIMIT 1),
           'EVT-006-C', 'Tributos faturamento — ISS',
           (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='03.1.2.02.007'),
           (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='02.1.3.01'),
           10, true, '{"tributo":"ISS"}'::jsonb, false, false, false
    WHERE NOT EXISTS (SELECT 1 FROM regra_contabilizacao WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-006-C');

    INSERT INTO regra_contabilizacao (empresa_id, evento, codigo_evento, descricao, conta_debito_id, conta_credito_id, prioridade, ativo, filtro, exige_contrato, exige_centro_custo, requer_pedido)
    SELECT v_empresa.id, (SELECT evento FROM regra_contabilizacao WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-006' LIMIT 1),
           'EVT-006-D', 'Tributos faturamento — Simples Nacional',
           (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='03.1.2.02.008'),
           (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='02.1.3.04'),
           10, (v_empresa.id = v_hagg_id), '{"tributo":"SIMPLES"}'::jsonb, false, false, false
    WHERE NOT EXISTS (SELECT 1 FROM regra_contabilizacao WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-006-D');

    INSERT INTO regra_contabilizacao (empresa_id, evento, codigo_evento, descricao, conta_debito_id, conta_credito_id, prioridade, ativo, filtro, exige_contrato, exige_centro_custo, requer_pedido)
    SELECT v_empresa.id, (SELECT evento FROM regra_contabilizacao WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-007' LIMIT 1),
           'EVT-007-A', 'Retenção INSS s/ recebimento',
           (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='01.1.3.03'),
           (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='01.1.2.01'),
           20, true, '{"retencao":"INSS"}'::jsonb, false, false, false
    WHERE NOT EXISTS (SELECT 1 FROM regra_contabilizacao WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-007-A');

    INSERT INTO regra_contabilizacao (empresa_id, evento, codigo_evento, descricao, conta_debito_id, conta_credito_id, prioridade, ativo, filtro, exige_contrato, exige_centro_custo, requer_pedido)
    SELECT v_empresa.id, (SELECT evento FROM regra_contabilizacao WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-007' LIMIT 1),
           'EVT-007-B', 'Retenção ISS s/ recebimento',
           (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='01.1.3.04'),
           (SELECT id FROM conta_contabil WHERE empresa_id=v_empresa.id AND classificacao='01.1.2.01'),
           20, true, '{"retencao":"ISS"}'::jsonb, false, false, false
    WHERE NOT EXISTS (SELECT 1 FROM regra_contabilizacao WHERE empresa_id=v_empresa.id AND codigo_evento='EVT-007-B');

  END LOOP;
END $$;
