INSERT INTO public.regra_contabilizacao
  (empresa_id, evento, descricao, codigo_evento, gatilho, exige_contrato, exige_centro_custo, entra_dre, requer_3way_match, requer_pedido, observacao, prioridade, ativo)
SELECT e.id, v.evento::regra_evento, v.descricao, v.codigo, v.gatilho,
       v.exige_contrato, v.exige_cc, v.entra_dre, v.req_3way, v.req_pedido, v.obs, v.prio, false
  FROM public.empresas e
 CROSS JOIN (VALUES
   ('EVT-001','nf_entrada_estoque',          'NF entrada de material para estoque',           'NF vinculada a pedido aprovado e recebimento validado', false, true,  true,  true,  true,  'Bloquear sem 3-way match', 10),
   ('EVT-002','nf_entrada_consumo_contrato', 'NF entrada material consumo direto contrato',   'Pedido + contrato + CC',                                 true,  true,  true,  false, true,  'Bloquear sem pedido',      20),
   ('EVT-003','nf_entrada_servico_admin',    'NF entrada de serviço administrativo',          'Pedido opcional + CC administrativo',                    false, true,  true,  false, false, 'Rateio se serviço comum',  30),
   ('EVT-004','baixa_pagar',                 'Pagamento fornecedor',                          'Título liberado em contas a pagar',                      false, false, false, false, false, 'Conciliação obrigatória',  40),
   ('EVT-005','nf_servico_autorizada',       'NF saída / faturamento contrato',               'Contrato ativo + medição + empenho + regra fiscal',      true,  true,  true,  false, false, 'Integração NFSe',          50),
   ('EVT-006','impostos_faturamento',        'Tributos sobre faturamento',                    'NF saída autorizada',                                    true,  true,  true,  false, false, 'ISS/PIS/COFINS conforme regime', 60),
   ('EVT-007','baixa_receber',               'Recebimento cliente',                           'Título em contas a receber',                             true,  true,  false, false, false, 'Baixa automática se conciliar',  70),
   ('EVT-008','provisao_folha',              'Provisão mensal de folha operacional',          'Fechamento folha do contrato',                           true,  true,  true,  false, false, 'Competência',              80),
   ('EVT-009','pagamento_folha',             'Pagamento folha',                               'Folha fechada e autorizada',                             true,  true,  false, false, false, 'Conciliação com banco',    90),
   ('EVT-010','recolhimento_encargos_folha', 'Recolhimento FGTS/INSS/tributos folha',         'Guia apurada',                                           true,  true,  false, false, false, 'Competência x caixa',     100),
   ('EVT-011','mutuo_intercompany_saida',    'Mútuo intercompany - saída',                    'Transferência entre CNPJs',                              false, true,  false, false, false, 'Eliminação no consolidado',110),
   ('EVT-012','mutuo_intercompany_entrada',  'Mútuo intercompany - entrada',                  'Transferência entre CNPJs',                              false, true,  false, false, false, 'Eliminação no consolidado',120),
   ('EVT-013','rateio_admin_intercompany',   'Rateio administrativo intercompany',            'Documento interno de rateio',                            false, true,  true,  false, false, 'Critério de rateio documentado', 130),
   ('EVT-014','manual',                      'Ajuste contábil manual',                        'Lote manual aprovado',                                   false, false, false, false, false, 'Exige alçada',            140),
   ('EVT-015','baixa_estoque_contrato',      'Baixa de estoque para contrato',                'Requisição atendida',                                    true,  true,  true,  false, false, 'Movimenta orçamento realizado', 150)
 ) AS v(codigo, evento, descricao, gatilho, exige_contrato, exige_cc, entra_dre, req_3way, req_pedido, obs, prio)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.regra_contabilizacao r
    WHERE r.empresa_id = e.id AND r.codigo_evento = v.codigo
 );