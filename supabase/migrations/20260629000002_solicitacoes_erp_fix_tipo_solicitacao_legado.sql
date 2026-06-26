-- Fix da migration anterior (20260629000001): NOT VALID só pula a validação
-- retroativa no momento de criar a constraint — não isenta as linhas antigas de
-- validação em updates futuros. Cards criados antes do dropdown existir, com
-- "tipo_solicitacao" como texto livre (ex.: "Bug no sistema"), passaram a falhar
-- em QUALQUER update (mover etapa, editar campo etc.), porque o Postgres
-- revalida todas as constraints da linha em todo UPDATE, não só na coluna alterada.
--
-- Limpa (NULL) os valores que não batem com o enum novo e só então valida a
-- constraint de verdade — a partir daqui ela passa a ser garantida pra toda a tabela.

UPDATE public.sistema_solicitacao
SET tipo_solicitacao = NULL
WHERE tipo_solicitacao IS NOT NULL
  AND tipo_solicitacao NOT IN ('correcao', 'melhoria', 'novo_modulo', 'integracao', 'relatorio', 'automacao', 'alteracao_legal');

ALTER TABLE public.sistema_solicitacao
  VALIDATE CONSTRAINT sistema_solicitacao_tipo_solicitacao_check;
