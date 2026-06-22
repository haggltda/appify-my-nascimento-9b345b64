-- ── Tabela de itens do checklist (estática, 63 registros do Excel) ──────────
CREATE TABLE IF NOT EXISTS public.checklist_items (
  id                  serial PRIMARY KEY,
  row_index           integer NOT NULL UNIQUE,
  setor               text NOT NULL,
  categoria           text,
  item                text NOT NULL,
  prazo_limite        text,
  tipo_resposta       text NOT NULL DEFAULT 'Descritivo', -- 'sim/não' | 'Descritivo'
  obs_default         text,
  momento             text,
  resp_questionamento text,
  plano_acao          text,
  responsavel_acao    text,
  onde                text,
  anotacoes           text
);

-- ── Tabela de respostas por contrato ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.checklist_respostas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  contrato_id  uuid NOT NULL REFERENCES public.implantacao_contrato(id) ON DELETE CASCADE,
  row_index    integer NOT NULL,
  resposta     text,
  obs          text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contrato_id, row_index)
);

-- RLS
ALTER TABLE public.checklist_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_respostas ENABLE ROW LEVEL SECURITY;

-- checklist_items é leitura pública para usuários autenticados
CREATE POLICY "checklist_items_select" ON public.checklist_items
  FOR SELECT TO authenticated USING (true);

-- checklist_respostas: acesso por empresa do usuário
CREATE POLICY "checklist_respostas_select" ON public.checklist_respostas
  FOR SELECT TO authenticated
  USING (empresa_id IN (
    SELECT empresa_id FROM public.user_empresa WHERE user_id = auth.uid()
  ));

CREATE POLICY "checklist_respostas_insert" ON public.checklist_respostas
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM public.user_empresa WHERE user_id = auth.uid()
  ));

CREATE POLICY "checklist_respostas_update" ON public.checklist_respostas
  FOR UPDATE TO authenticated
  USING (empresa_id IN (
    SELECT empresa_id FROM public.user_empresa WHERE user_id = auth.uid()
  ));

-- ── Seed: 63 itens do checklist ─────────────────────────────────────────────
INSERT INTO public.checklist_items
  (row_index, setor, categoria, item, prazo_limite, tipo_resposta, obs_default, momento, resp_questionamento, plano_acao, responsavel_acao, onde, anotacoes)
VALUES
  (0, 'Recrutamento', 'Equipe', 'Quadro será mantido ou haverá alterações?', '15 dias antes do inicio do contrato/Lista', 'sim/não', NULL, 'Reunião de alinhamento', 'Licitação', 'Não - recrutar / Sim - contratar', 'Recrutamento', 'ERP', 'Condução da reunião'),
  (1, 'Recrutamento', 'Funcionários', 'Sugestão de candidatos', '15 dias antes do inicio do contrato', 'sim/não', 'Enviar por email', 'Reunião de alinhamento', 'Licitação', 'Não - recrutar / Sim - contratar', 'Recrutamento', 'ERP', 'Criar padrão de impugnação de encarregados'),
  (2, 'Recrutamento', 'Funcionários', 'Dados dos colaboradores', '15 dias antes do inicio do contrato', 'Descritivo', NULL, 'Reunião de alinhamento', 'Licitação', 'Recebimento dados', 'Recrutamento', 'E-mail', 'Criar padrao de processo na justiça conrando questoes sem aceite de impugnação'),
  (3, 'Recrutamento', 'Operacional', 'Locais de cada posto de trabalho (Endereço)', 'Momento =', 'Descritivo', NULL, 'Capa de edital', 'Licitação', 'Recebimento dados', 'RH', 'ERP', NULL),
  (4, 'Recrutamento', 'Operacional', 'Escala de horario de postos', 'Momento =', 'Descritivo', NULL, 'Cadastro de edital', 'Licitação', 'Recebimento dados pelo ERP', 'RH', 'Senior', NULL),
  (5, 'Recrutamento', 'Responsáveis', 'Encarregados do contrato', '15 dias antes do inicio do contrato', 'Descritivo', NULL, 'Reunião de alinhamento', 'Licitação', 'Não - recrutar / Sim - contratar', 'Recrutamento', 'ERP', NULL),
  (6, 'Recrutamento', 'Treinamentos', 'Treinamento de integração', '2 dias antes', 'Descritivo', NULL, 'Reunião de implantação', 'Licitação', 'Recebimento dados', 'Recrutamento', 'ERP', NULL),
  (7, 'Recrutamento', 'Responsáveis', 'Contato do fiscal do contrato', '15 dias antes do inicio do contrato', 'Descritivo', NULL, 'Reunião de alinhamento', 'Licitação', 'Cadastro no sistema', 'Licitação', 'ERP', NULL),
  (8, 'Recrutamento', 'Envio', 'Forma de envio (e-mail, 1DOC, SEI, sistema interno)', 'Momento =', 'Descritivo', NULL, 'Capa de edital', 'Licitação', 'Recebimento dados', 'Financeiro', 'ERP', NULL),
  (9, 'Recrutamento', 'Faturamento', 'Documentação enviada antes ou junto da NF', 'Momento =', 'Descritivo', NULL, 'Capa de edital', 'Licitação', 'Recebimento dados', 'Financeiro', 'ERP', NULL),
  (10, 'Recrutamento', 'Faturamento', 'Existe medição de qualidade na execução do serviço (Descrever modalidade)', 'Momento =', 'Descritivo', NULL, 'Capa de edital', 'Licitação', 'Recebimento dados', 'Operação', 'ERP', NULL),
  (11, 'Recrutamento', 'Faturamento', 'Existe medição para faturamento (Descrever modalidade)', 'Momento =', 'Descritivo', NULL, 'Capa de edital', 'Licitação', 'Recebimento dados', 'Operação', 'ERP', NULL),
  (12, 'Recrutamento', 'Contratual', 'CNPJ do contratante', 'Momento =', 'Descritivo', NULL, 'Cadastro de edital', 'Licitação', 'Recebimento dados', 'Todos', 'ERP', NULL),
  (13, 'Recrutamento', 'Notas Fiscais', 'Emissão da nota por cidade, posto ou secretaria', '15 dias antes do inicio do contrato/Resposta', 'Descritivo', NULL, 'Reunião de alinhamento', 'Licitação', 'Cadastro no sistema', 'Operação', 'ERP', NULL),
  (14, 'Recrutamento', 'Conta Vinculada', 'Possui conta vinculada?', 'Momento =', 'sim/não', NULL, 'Capa de edital', 'Licitação', 'Recebimento dados', 'Financeiro', 'ERP', NULL),
  (15, 'Recrutamento', 'Conta Vinculada', 'Quem abre a conta vinculada?', '15 dias antes do inicio do contrato', 'Descritivo', NULL, 'Reunião de alinhamento', 'Licitação', 'Recebimento dados', 'Financeiro', 'ERP', NULL),
  (16, 'Recrutamento', 'Documentos', 'Documentos iniciais para a emissão da primeira nota', 'Momento =', 'Descritivo', NULL, 'Capa de edital', 'Licitação', 'Recebimento dados', 'Financeiro', 'ERP', NULL),
  (17, 'Recrutamento', 'Documentos', 'Documentos mensais para emissão da nota', 'Momento =', 'Descritivo', NULL, 'Cadastro de edital', 'Licitação', 'Recebimento dados', 'Financeiro', 'ERP', NULL),
  (18, 'Recrutamento', 'Competência', 'Competência da documentação', '15 dias antes do inicio do contrato', 'Descritivo', NULL, 'Reunião de alinhamento', 'Licitação', 'Recebimento dados', 'Financeiro', 'ERP', NULL),
  (19, 'SST', 'Atividades', 'Atividades por CBO', 'Momento =', 'Descritivo', NULL, 'Capa de edital', 'Licitação', 'Recebimento dados', 'SST', 'ERP', NULL),
  (20, 'SST', 'Riscos', 'Exposição a agentes', 'Momento =', 'Descritivo', NULL, 'Capa de edital', 'Licitação', 'Recebimento dados', 'SST', 'ERP', NULL),
  (21, 'SST', 'Contato', 'Contato com pacientes/resíduos', 'Momento =', 'Descritivo', NULL, 'Capa de edital', 'Licitação', 'Recebimento dados', 'SST', 'ERP', NULL),
  (22, 'SST', 'Treinamentos', 'Treinamentos exigidos', 'Momento =', 'Descritivo', NULL, 'Capa de edital', 'Licitação', 'Recebimento dados', 'SST/Treinamentos', 'ERP', NULL),
  (23, 'SST', 'Vacinação', 'Vacinação específica', 'Momento =', 'Descritivo', NULL, 'Capa de edital', 'Licitação', 'Recebimento dados', 'SST', 'ERP', NULL),
  (24, 'SST', 'Prazos', 'Prazo envio ASOs', 'Momento =', 'Descritivo', NULL, 'Cadastro de edital', 'Licitação', 'Recebimento dados', 'SST', 'ERP', NULL),
  (25, 'SST', 'Prazos', 'Prazo envio treinamentos', '15 dias antes do inicio do contrato', 'Descritivo', NULL, 'Reunião de alinhamento', 'Licitação', 'Recebimento dados', 'SST/Treinamentos', 'ERP', NULL),
  (26, 'SST', 'Exames', 'Exames complementares', '15 dias antes do inicio do contrato', 'Descritivo', NULL, 'Reunião de alinhamento', 'Licitação', 'Recebimento dados', 'SST', 'ERP', NULL),
  (27, 'SST', 'EPIs', 'EPIs especificados', 'Momento =', 'Descritivo', NULL, 'Cadastro de edital', 'Licitação', 'Recebimento dados', 'SST/Compras', 'ERP', NULL),
  (28, 'SST', 'Adicionais', 'Insalubridade/periculosidade', 'Momento =', 'Descritivo', NULL, 'Cadastro de edital', 'Licitação', 'Recebimento dados', 'Operação', 'ERP', NULL),
  (29, 'SST', 'Cotas', 'PCDs - Verificar se na sugestoes de nomes existe pessoas com laudo', '15 dias antes do inicio do contrato', 'Descritivo', NULL, 'Reunião de alinhamento', 'Licitação', 'Recebimento dados', 'SST/Treinamentos', 'ERP', NULL),
  (30, 'SST', 'Especiais', 'Atividades especiais (Atividade posterior ao inicio do contrato)', 'Momento =', 'Descritivo', NULL, 'Cadastro de edital', 'Licitação', 'Recebimento dados', 'SST', 'ERP', NULL),
  (31, 'Compras', 'Início', 'Data de início do contrato', 'Momento =', 'Descritivo', NULL, 'Reunião de alinhamento', 'Licitação', 'Recebimento dados', 'Todos', 'ERP', NULL),
  (32, 'Compras', 'Gestão', 'Supervisor e analista', 'Momento =', 'Descritivo', NULL, 'Cadastro de edital', 'Licitação', 'Recebimento dados', 'Todos', 'ERP', NULL),
  (33, 'Compras', 'Gestão', 'Distribuição de uniformes e equipamentos', '2 dias antes do inicio do contrato', 'Descritivo', NULL, 'Reunião de implantação', 'Licitação', 'Recebimento dados', 'Compras', 'ERP', NULL),
  (34, 'Compras', 'Gestão', 'Prazo de entrega de uniformes e equipamentos', '15 dias antes do inicio do contrato', 'Descritivo', NULL, 'Reunião de alinhamento', 'Licitação', 'Recebimento dados', 'Compras', 'ERP', NULL),
  (35, 'Compras', 'Uniformes', 'Prazo de entrega de uniformes iniciais', '15 dias antes do inicio do contrato', 'Descritivo', NULL, 'Reunião de alinhamento', 'Licitação', 'Recebimento dados', 'Compras', 'ERP', NULL),
  (36, 'Compras', 'Uniformes', 'Prazo de entrega de uniforme completo', '15 dias antes do inicio do contrato', 'Descritivo', NULL, 'Reunião de alinhamento', 'Licitação', 'Recebimento dados', 'Compras', 'ERP', NULL),
  (37, 'Compras', 'Uniformes', 'Solicitação da empresa de compras de uniformes emergencial', '10 dias antes do inicio do contrato', 'Descritivo', NULL, 'Reunião de implantação', 'Licitação', 'Recebimento dados', 'Compras', 'ERP', NULL),
  (38, 'Compras', 'Uniformes', 'Solicitação da empresa de compras de uniformes permanente', '60 dias após do inicio do contrato', 'Descritivo', NULL, 'Reunião de implantação', 'Licitação', 'Recebimento dados', 'Recrutamento', 'ERP', NULL),
  (39, 'Compras', 'Uniformes', 'Pedido de compras de uniformes', '60 dias após do inicio do contrato', 'Descritivo', NULL, 'Reunião de implantação', 'Licitação', 'Recebimento dados', 'Compras', 'ERP', NULL),
  (40, 'Compras', 'Uniformes', 'Compras de uniformes', '60 dias após do inicio do contrato', 'Descritivo', NULL, 'Reunião de implantação', 'Licitação', 'Recebimento dados', 'Compras', 'ERP', NULL),
  (41, 'Compras', 'Uniformes', 'Compras de cracha', '10 dias antes do inicio do contrato', 'Descritivo', NULL, 'Reunião de implantação', 'Licitação', 'Recebimento dados', 'Compras', 'ERP', NULL),
  (42, 'Compras', 'Alinhamentos', 'Particularidades operacionais, mudanças entre termo e execução.', '15 dias antes do inicio do contrato', 'Descritivo', NULL, 'Reunião de alinhamento', 'Licitação', 'Recebimento dados', 'Compras', 'ERP', NULL),
  (43, 'Presidência', 'Alinhamentos', 'Para quem reportar sobre trocas e substituições', '15 dias antes do inicio do contrato', 'Descritivo', NULL, 'Reunião de alinhamento', 'Licitação', 'Recebimento dados- Fiscal do posto ou do contrato', 'Operação', 'ERP', NULL),
  (44, 'Presidência', 'Alinhamentos', 'Ciencia de cotação de turnover 23% AT 5% AI', '15 dias antes do inicio do contrato', 'Descritivo', NULL, 'Reunião de alinhamento', 'Licitação', 'Recebimento dados', 'Operação', 'ERP', NULL),
  (45, 'Presidência', 'Alinhamentos', 'Fazem repactuação caso exceda % de turnover', '15 dias antes do inicio do contrato', 'Descritivo', NULL, 'Reunião de alinhamento', 'Licitação', 'Pedir repactuação', 'Licitação', 'ERP', NULL),
  (46, 'Presidência', 'Alinhamentos', 'Horarios de trasporte intermunicipal bate escala', NULL, 'Descritivo', NULL, 'Cadastro de edital', 'Licitação', 'Impugnar se não bater', 'Licitação', 'ERP', NULL),
  (47, 'Presidência', 'Inicio de processo', 'É uma atividade nova ou existe empresa executando o serviço', NULL, 'Descritivo', NULL, 'Captação', 'Licitação', 'Parte da descisão', 'Licitação', 'ERP', NULL),
  (48, 'Presidência', 'Descisão', 'Data da homologação', NULL, 'Descritivo', NULL, 'Grade de licitações', 'Licitação', 'Recebimento dados', 'Todos', 'ERP', NULL),
  (49, 'Presidência', 'Descisão', 'Data de abertura', NULL, 'Descritivo', NULL, 'Grade de licitações', 'Licitação', 'Recebimento dados', 'Todos', 'ERP', NULL),
  (50, 'Presidência', 'Descisão', 'Data captação', NULL, 'Descritivo', NULL, 'Grade de licitações', 'Licitação', 'Recebimento dados', 'Todos', 'ERP', NULL),
  (51, 'Presidência', 'Descisão', 'EDITAL', NULL, 'Descritivo', NULL, 'Grade de licitações', 'Licitação', 'Recebimento dados', 'Todos', 'ERP', NULL),
  (52, 'Presidência', 'Descisão', 'Horário', NULL, 'Descritivo', NULL, 'Grade de licitações', 'Licitação', 'Recebimento dados', 'Todos', 'ERP', NULL),
  (53, 'Presidência', 'Descisão', 'Cidade', NULL, 'Descritivo', NULL, 'Grade de licitações', 'Licitação', 'Recebimento dados', 'Todos', 'ERP', NULL),
  (54, 'Presidência', 'Descisão', 'Objeto', NULL, 'Descritivo', NULL, 'Grade de licitações', 'Licitação', 'Recebimento dados', 'Todos', 'ERP', NULL),
  (55, 'Presidência', 'Descisão', 'Empresa', NULL, 'Descritivo', NULL, 'Grade de licitações', 'Licitação', 'Recebimento dados', 'Todos', 'ERP', NULL),
  (56, 'Presidência', 'Descisão', 'Responsável', NULL, 'Descritivo', NULL, 'Grade de licitações', 'Licitação', 'Recebimento dados', 'Todos', 'ERP', NULL),
  (57, 'Presidência', 'Descisão', 'Posição', NULL, 'Descritivo', NULL, 'Grade de licitações', 'Licitação', 'Recebimento dados', 'Todos', 'ERP', NULL),
  (58, 'Presidência', 'Descisão', 'UF', NULL, 'Descritivo', NULL, 'Grade de licitações', 'Licitação', 'Recebimento dados', 'Todos', 'ERP', NULL),
  (59, 'Presidência', 'Descisão', 'Status', NULL, 'Descritivo', NULL, 'Grade de licitações', 'Licitação', 'Recebimento dados', 'Todos', 'ERP', NULL),
  (60, 'Presidência', 'Descisão', 'Fase', NULL, 'Descritivo', NULL, 'Grade de licitações', 'Licitação', 'Recebimento dados', 'Todos', 'ERP', NULL),
  (61, 'Presidência', 'Descisão', 'Valor global', NULL, 'Descritivo', NULL, 'Grade de licitações', 'Licitação', 'Recebimento dados', 'Todos', 'ERP', NULL),
  (62, 'Presidência', 'Descisão', 'Nº pessoas (Quantidade de postos)', NULL, 'Descritivo', NULL, 'Grade de licitações', 'Licitação', 'Recebimento dados', 'Todos', 'ERP', NULL)
ON CONFLICT (row_index) DO NOTHING;
