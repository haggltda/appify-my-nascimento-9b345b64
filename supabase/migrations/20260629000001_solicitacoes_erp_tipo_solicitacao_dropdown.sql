-- Solicitações ERP: "Tipo da Solicitação" deixa de ser texto livre na abertura e
-- passa a ser um dropdown fixo com 7 opções (Correção/Melhoria/Novo Módulo/
-- Integração/Relatório/Automação/Alteração Legal). Os campos "Impacto Financeiro"
-- e os 7 campos de comentário "Detalhe, se aplicável" saem do formulário — as
-- colunas continuam existindo no banco (não apagamos dado já preenchido em
-- cards existentes), só não são mais usadas pelo front-end.
--
-- NOT VALID porque tipo_solicitacao já existia como texto livre antes dessa
-- mudança — não queremos que a migration falhe por causa de valor antigo que
-- não bate com o enum novo. A partir de agora, todo INSERT/UPDATE novo já
-- respeita o CHECK.

ALTER TABLE public.sistema_solicitacao
  ADD CONSTRAINT sistema_solicitacao_tipo_solicitacao_check
    CHECK (tipo_solicitacao IS NULL OR tipo_solicitacao IN (
      'correcao', 'melhoria', 'novo_modulo', 'integracao', 'relatorio', 'automacao', 'alteracao_legal'
    )) NOT VALID;
