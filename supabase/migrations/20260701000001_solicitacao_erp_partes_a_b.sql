-- Migração: adiciona número sequencial (SD-AAAA-NNNN) e campos do FSD
-- Parte A (abertura pelo solicitante) e Parte B (triagem pela Controladoria).
-- ATENÇÃO: não auto-aplica no Supabase; executar manualmente no SQL Editor.

BEGIN;

-- ──────────────────────────────────────────────────────────────────
-- 1. Número sequencial da solicitação (exibição: SD-{ano}-{NNNN})
-- ──────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.sistema_solicitacao_numero_seq
  START WITH 1 INCREMENT BY 1;

ALTER TABLE public.sistema_solicitacao
  ADD COLUMN IF NOT EXISTS numero bigint;

UPDATE public.sistema_solicitacao
  SET numero = nextval('public.sistema_solicitacao_numero_seq')
  WHERE numero IS NULL;

ALTER TABLE public.sistema_solicitacao
  ALTER COLUMN numero SET DEFAULT nextval('public.sistema_solicitacao_numero_seq'),
  ALTER COLUMN numero SET NOT NULL;

-- ──────────────────────────────────────────────────────────────────
-- 2. Parte A — Seção 1: Identificação
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.sistema_solicitacao
  ADD COLUMN IF NOT EXISTS area_solicitante         text,
  ADD COLUMN IF NOT EXISTS responsavel_solicitacao  text,
  ADD COLUMN IF NOT EXISTS cargo_solicitante        text,
  ADD COLUMN IF NOT EXISTS email_solicitante        text,
  ADD COLUMN IF NOT EXISTS telefone_solicitante     text;

-- ──────────────────────────────────────────────────────────────────
-- 3. Parte A — Seção 2: Classificação da Demanda (multi-select)
--    Valores: correcao_falha, melhoria_processo, nova_funcionalidade,
--    novo_processo, novo_relatorio, integracao_sistemas, automacao,
--    alteracao_legal, outro
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.sistema_solicitacao
  ADD COLUMN IF NOT EXISTS classificacao_demanda text[];

-- ──────────────────────────────────────────────────────────────────
-- 4. Parte A — Seção 3: Descrição da Necessidade
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.sistema_solicitacao
  ADD COLUMN IF NOT EXISTS descricao_necessidade text;

-- ──────────────────────────────────────────────────────────────────
-- 5. Parte A — Seção 5: Situação Desejada
--    (Situação Atual usa o campo existente problema_atual)
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.sistema_solicitacao
  ADD COLUMN IF NOT EXISTS situacao_desejada text;

-- ──────────────────────────────────────────────────────────────────
-- 6. Parte A — Seção 7: Benefícios Esperados (multi-select)
--    Valores: reducao_tempo, aumento_produtividade, reducao_retrabalho,
--    maior_controle, reducao_custos, atendimento_legislacao, outro
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.sistema_solicitacao
  ADD COLUMN IF NOT EXISTS beneficios_esperados_lista text[];

-- ──────────────────────────────────────────────────────────────────
-- 7. Parte A — Seção 8: Impacto
--    impacto_tipo: apenas_minha_area | mais_de_uma_area | toda_empresa
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.sistema_solicitacao
  ADD COLUMN IF NOT EXISTS impacto_tipo    text,
  ADD COLUMN IF NOT EXISTS areas_impactadas text;

-- ──────────────────────────────────────────────────────────────────
-- 8. Parte A — Seção 9: Urgência
--    (grau_urgencia já existe; novo: justificativa textual)
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.sistema_solicitacao
  ADD COLUMN IF NOT EXISTS justificativa_urgencia text;

-- ──────────────────────────────────────────────────────────────────
-- 9. Parte A — Seção 10: Processo Documentado
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.sistema_solicitacao
  ADD COLUMN IF NOT EXISTS existe_processo_documentado boolean,
  ADD COLUMN IF NOT EXISTS codigo_processo             text;

-- ──────────────────────────────────────────────────────────────────
-- 10. Parte A — Seção 11: Documentos de Apoio (multi-select)
--     Valores: fluxograma, planilha, relatorio, print_tela, outro
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.sistema_solicitacao
  ADD COLUMN IF NOT EXISTS tipos_documentos_apoio text[];

-- ──────────────────────────────────────────────────────────────────
-- 11. Parte A — Seção 12: Observações
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.sistema_solicitacao
  ADD COLUMN IF NOT EXISTS observacoes_abertura text;

-- ──────────────────────────────────────────────────────────────────
-- 12. Parte B — Triagem Inicial (preenchida pela Controladoria)
--     triagem_classificacao: processo | sistema | treinamento | parametrizacao | outro
--     triagem_decisao: aprovado | reprovado | devolvido_ajustes
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.sistema_solicitacao
  ADD COLUMN IF NOT EXISTS triagem_recebido_por               text,
  ADD COLUMN IF NOT EXISTS triagem_concluida_em               date,
  ADD COLUMN IF NOT EXISTS triagem_classificacao              text,
  ADD COLUMN IF NOT EXISTS triagem_sem_desenvolvimento        boolean,
  ADD COLUMN IF NOT EXISTS triagem_sem_desenvolvimento_como   text,
  ADD COLUMN IF NOT EXISTS triagem_encaminhamento_para        text,
  ADD COLUMN IF NOT EXISTS triagem_encaminhamento_responsavel text,
  ADD COLUMN IF NOT EXISTS triagem_parecer                    text,
  ADD COLUMN IF NOT EXISTS triagem_decisao                    text,
  ADD COLUMN IF NOT EXISTS triagem_data_decisao               date;

COMMIT;
