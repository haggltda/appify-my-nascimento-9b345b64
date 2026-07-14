-- =========================================================================
-- NASCIMENTO FORMULÁRIOS — snapshot do cadastro do respondente
--
-- Quando um usuário LOGADO responde, a página puxa o cadastro dele em
-- EMPREGADOS (via RPC meu_empregado) e anexa como snapshot na resposta:
-- nome, cpf, cargo, setor, líder, situação, filial, e-mail, etc. O botão
-- "Detalhes" na tela de respostas mostra tudo. O setor da classificação
-- (Administrativo × Operacional) passa a vir do cadastro (com fallback p/ a
-- pergunta de setor do formulário).
--
-- Idempotente.
-- =========================================================================

ALTER TABLE public."CS_FORM_RESPOSTAS"
  ADD COLUMN IF NOT EXISTS respondente_cadastro jsonb;

NOTIFY pgrst, 'reload schema';
