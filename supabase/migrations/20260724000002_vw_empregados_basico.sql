-- VW_EMPREGADOS_BASICO — view pública (sem colunas sensíveis) p/ o formulário
-- público (FormularioPublico.tsx, roda como anon quando não há sessão).
--
-- Contexto: a tabela EMPREGADOS teve o SELECT restrito a usuários logados com
-- acesso por menu (hotfix 20260717190010). O formulário público não tem login,
-- então lê os colaboradores por esta view — só 5 colunas não sensíveis
-- (sem CPF/salário/PIS) — liberada para anon + authenticated.
--
-- A view roda com os privilégios do dono (security invoker desligado, o padrão),
-- então enxerga a EMPREGADOS ignorando a RLS da tabela — expõe apenas as 5
-- colunas do SELECT abaixo, nada mais.
--
-- Idempotente (CREATE OR REPLACE). Espelha o que a migration 20260717190010 já
-- fez na branch main; este arquivo garante que o BANCO DO APP também tenha.

CREATE OR REPLACE VIEW public."VW_EMPREGADOS_BASICO" AS
SELECT "ID", "Nome", "Setor_ERP", "Título do Cargo", "Situação"
FROM public."EMPREGADOS";

GRANT SELECT ON public."VW_EMPREGADOS_BASICO" TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
