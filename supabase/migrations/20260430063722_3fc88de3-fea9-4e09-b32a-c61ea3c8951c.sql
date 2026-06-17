-- Limpa qualquer mapeamento parcial e popula
DELETE FROM public.integration_layout_columns;

-- Helper: insere com identificação por código de layout
DO $$
DECLARE
  l_colab_full uuid;
  l_colab_ativ uuid;
  l_contr_mast uuid;
  l_fluxo_real uuid;
  l_licit      uuid;
  l_clientes   uuid;
BEGIN
  SELECT id INTO l_colab_full FROM public.integration_layouts WHERE codigo='colaborador_full_v1';
  SELECT id INTO l_colab_ativ FROM public.integration_layouts WHERE codigo='colaborador_ativo_v1';
  SELECT id INTO l_contr_mast FROM public.integration_layouts WHERE codigo='contrato_master_v1';
  SELECT id INTO l_fluxo_real FROM public.integration_layouts WHERE codigo='fluxo_realizado_v1';
  SELECT id INTO l_licit      FROM public.integration_layouts WHERE codigo='licitacoes_v1';
  SELECT id INTO l_clientes   FROM public.integration_layouts WHERE codigo='cliente_cnpj_v1';

  -- COLABORADOR FULL (planilha: Filial, Empresa, Nome, CPF, Admissão, Cadastro, Cargo, Valor Salário, Situação, Descrição (Situação), Sexo, Apelido (Filial))
  INSERT INTO public.integration_layout_columns (layout_id, nome_origem, aliases, nome_destino, tipo_dado, obrigatorio, ordem) VALUES
    (l_colab_full, 'Filial',              ARRAY['filial','unidade','apelido_filial','apelido (filial)'], 'filial',         'texto',  false, 1),
    (l_colab_full, 'Empresa',             ARRAY['empresa','razao_social','razao social'],                'empresa_origem', 'texto',  false, 2),
    (l_colab_full, 'Nome',                ARRAY['nome','colaborador','funcionario','nome_completo'],     'nome',           'texto',  true,  3),
    (l_colab_full, 'CPF',                 ARRAY['cpf','cpf_colaborador','documento'],                    'cpf',            'texto',  true,  4),
    (l_colab_full, 'Cadastro',            ARRAY['cadastro','matricula','matrícula','registro'],          'cadastro',       'texto',  false, 5),
    (l_colab_full, 'Situação',            ARRAY['situacao','situação','status','descricao_situacao','descrição (situação)'], 'situacao', 'texto', false, 6);

  -- COLABORADOR ATIVO
  INSERT INTO public.integration_layout_columns (layout_id, nome_origem, aliases, nome_destino, tipo_dado, obrigatorio, ordem) VALUES
    (l_colab_ativ, 'Nome',                 ARRAY['nome','colaborador','funcionario'],            'nome',                    'texto', true,  1),
    (l_colab_ativ, 'CPF',                  ARRAY['cpf','documento'],                             'cpf',                     'texto', true,  2),
    (l_colab_ativ, 'Cadastro',             ARRAY['cadastro','matricula','matrícula'],            'cadastro',                'texto', false, 3),
    (l_colab_ativ, 'Situação',             ARRAY['situacao','situação','status'],                'situacao',                'texto', false, 4),
    (l_colab_ativ, 'Centro de Custo',      ARRAY['centro_custo','cc','codigo_cc','cód. centro de custo'], 'centro_custo_codigo', 'texto', false, 5),
    (l_colab_ativ, 'Descrição CC',         ARRAY['descricao_cc','descrição cc','centro_custo_descricao'], 'centro_custo_descricao','texto', false, 6),
    (l_colab_ativ, 'Filial',               ARRAY['filial','apelido_filial'],                      'filial_apelido',          'texto', false, 7);

  -- CONTRATOS MASTER
  INSERT INTO public.integration_layout_columns (layout_id, nome_origem, aliases, nome_destino, tipo_dado, obrigatorio, ordem) VALUES
    (l_contr_mast, 'Contrato',            ARRAY['contrato','nome_contrato','contrato_nome'],     'contrato_nome',     'texto',   true,  1),
    (l_contr_mast, 'Responsável',         ARRAY['responsavel','responsável','gestor'],           'responsavel',       'texto',   false, 2),
    (l_contr_mast, 'Cidade',              ARRAY['cidade','municipio','município'],               'cidade',            'texto',   false, 3),
    (l_contr_mast, 'Data Início',         ARRAY['data_inicio','data início','inicio','início','data_inicial'], 'data_inicio', 'data', false, 4),
    (l_contr_mast, 'Edital',              ARRAY['numero_edital','número edital','edital','numero do edital'], 'numero_edital', 'texto', false, 5),
    (l_contr_mast, 'Funcionários',        ARRAY['quant_funcionarios','funcionarios','funcionários','qtd_funcionarios'], 'quant_funcionarios', 'numero', false, 6),
    (l_contr_mast, 'Valor Mensal',        ARRAY['valor_mensal','valor mensal','faturamento_mensal','mensalidade'], 'valor_mensal', 'numero', false, 7);

  -- FLUXO REALIZADO
  INSERT INTO public.integration_layout_columns (layout_id, nome_origem, aliases, nome_destino, tipo_dado, obrigatorio, ordem) VALUES
    (l_fluxo_real, 'ID',                  ARRAY['id_origem','id origem','codigo'],               'id_origem',              'texto',  false, 1),
    (l_fluxo_real, 'Data',                ARRAY['data','data_lancamento','data lançamento','data lancamento'], 'data_lancamento', 'data', true, 2),
    (l_fluxo_real, 'Tipo',                ARRAY['tipo','natureza','d_c','debito_credito'],       'tipo',                   'texto',  false, 3),
    (l_fluxo_real, 'Classificação',       ARRAY['classificacao','classificação','categoria'],    'classificacao',          'texto',  false, 4),
    (l_fluxo_real, 'Histórico',           ARRAY['historico','histórico','descricao','descrição'], 'historico',             'texto',  false, 5),
    (l_fluxo_real, 'Empresa',             ARRAY['empresa','empresa_origem','razao_social'],      'empresa_origem',         'texto',  false, 6),
    (l_fluxo_real, 'Centro de Custo',     ARRAY['centro_custo','centro_custo_origem','cc'],      'centro_custo_origem',    'texto',  false, 7),
    (l_fluxo_real, 'Banco',               ARRAY['banco','banco_origem','conta_banco'],           'banco_origem',           'texto',  false, 8),
    (l_fluxo_real, 'Forma Pagamento',     ARRAY['forma_pagamento','forma_pagamento_origem','meio_pagamento'], 'forma_pagamento_origem','texto',false,9),
    (l_fluxo_real, 'Valor',               ARRAY['valor','valor_lancamento','montante'],          'valor',                  'numero', true,  10);

  -- LICITAÇÕES
  IF l_licit IS NOT NULL THEN
    INSERT INTO public.integration_layout_columns (layout_id, nome_origem, aliases, nome_destino, tipo_dado, obrigatorio, ordem)
    SELECT l_licit, x.no, x.al, x.nd, x.tp, x.ob, x.od
    FROM (VALUES
      ('Edital',  ARRAY['edital','numero_edital','número'],          'edital',     'texto', false, 1),
      ('Objeto',  ARRAY['objeto','descricao','descrição'],            'objeto',     'texto', false, 2),
      ('Cidade',  ARRAY['cidade','municipio'],                        'cidade',     'texto', false, 3),
      ('UF',      ARRAY['uf','estado'],                                'uf',         'texto', false, 4),
      ('Data Sessão', ARRAY['data_sessao','data sessão','data'],     'data_sessao','data',  false, 5),
      ('Fase',    ARRAY['fase','etapa','status','modalidade'],        'fase',       'texto', false, 6),
      ('Status',  ARRAY['status','observacoes_status','status_obs'], 'status_obs', 'texto', false, 7),
      ('Empresa', ARRAY['empresa','empresa_obs'],                    'empresa_obs','texto', false, 8)
    ) AS x(no, al, nd, tp, ob, od);
  END IF;

  -- CLIENTES / CNPJ
  IF l_clientes IS NOT NULL THEN
    INSERT INTO public.integration_layout_columns (layout_id, nome_origem, aliases, nome_destino, tipo_dado, obrigatorio, ordem)
    SELECT l_clientes, x.no, x.al, x.nd, x.tp, x.ob, x.od
    FROM (VALUES
      ('Empresa',  ARRAY['empresa','razao_social','empresa_origem'], 'empresa_origem',  'texto', false, 1),
      ('Filial',   ARRAY['filial','unidade'],                         'filial',          'texto', false, 2),
      ('Contrato', ARRAY['contrato','contrato_origem'],               'contrato_origem', 'texto', false, 3),
      ('CNPJ',     ARRAY['cnpj','documento'],                         'cnpj',            'texto', true,  4),
      ('Início',   ARRAY['data_inicio','inicio','início'],            'data_inicio',     'data',  false, 5),
      ('Fim',      ARRAY['data_fim','fim','encerramento'],            'data_fim',        'data',  false, 6)
    ) AS x(no, al, nd, tp, ob, od);
  END IF;
END$$;

-- Reabre o batch BATCH-2026-04-30-QU2C que está vazio para permitir re-materialização
UPDATE public.integration_batches
   SET status = 'rascunho'::integ_batch_status,
       total_linhas = 0, linhas_validas = 0, linhas_invalidas = 0,
       observacoes = COALESCE(observacoes,'') || E'\n[REABERTO] mapeamento de colunas estava ausente — re-materialize.',
       updated_at = now()
 WHERE codigo = 'BATCH-2026-04-30-QU2C';

UPDATE public.integration_batch_files
   SET materializado_em = NULL, linhas_inseridas = NULL
 WHERE batch_id = (SELECT id FROM public.integration_batches WHERE codigo='BATCH-2026-04-30-QU2C');

DELETE FROM public.stg_colaboradores_base
 WHERE batch_id = (SELECT id FROM public.integration_batches WHERE codigo='BATCH-2026-04-30-QU2C');

DELETE FROM public.integration_validation_results
 WHERE batch_id = (SELECT id FROM public.integration_batches WHERE codigo='BATCH-2026-04-30-QU2C');