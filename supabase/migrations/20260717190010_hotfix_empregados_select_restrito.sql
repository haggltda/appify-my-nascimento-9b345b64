-- FASE 0 (hotfix emergencial) — EMPREGADOS (SELECT completo)
--
-- Confirmado: a policy de SELECT (erp_auth_read_empregados) é USING(true)
-- só para {authenticated} — não vaza pra anon/público (achado crítico #2 do
-- mapeamento não se confirma), mas qualquer funcionário logado, de
-- qualquer setor, lê a tabela inteira via API — inclusive salário, CPF e
-- PIS de qualquer colega.
--
-- Mapeei TODOS os consumidores reais (grep completo por .from("EMPREGADOS")
-- em src/**, incluindo os que o mapeamento anterior não pegou:
-- useVinculoEmpregado, Colaboradores.tsx, NovasAdmissoes.tsx, IntegrarCargos,
-- ImportarColaboradores). Categorização:
--
--   • Autoconsulta (useVinculoEmpregado.ts) — TEM que sempre funcionar,
--     não importa o menu. Vira auth_user_id = auth.uid().
--   • RH (Colaboradores.tsx, NovasAdmissoes.tsx, IntegrarCargos.tsx,
--     ImportarColaboradores.tsx) — menu 'colaboradores'.
--   • Recrutamento (Recrutamento.tsx, precisa salário) — 'recrutamento_gestao'.
--   • SST/Jurídico-Candidatos (CandidatoInfo.tsx é usado dentro de
--     AsoCandidatos/VerificacaoCandidatos também) — 'sst_aso'/'candidatos'.
--   • Encarregados (MinhasSolicitacoes.tsx, precisa salário) — 'encarregados_minhas_solicitacoes'.
--   • Jurídico Processos (precisa salário+PIS) — 'processos'.
--   • Jurídico Patrimônios/Dúvidas (só ID/Nome/Setor, sem salário) — 'patrimonios'/'duvidas'.
--   • Central de Serviços Formulários (EmpregadoDetalheModal.tsx, FormularioEditor.tsx,
--     FormularioRespostas.tsx, ModulosMenusTab.tsx) — 'central_servicos_formularios'.
--     Inclui a única ESCRITA fora do RH (definir/remover líder no modal).
--   • Formulário PÚBLICO (FormularioPublico.tsx, sem login) — não cabe em
--     nenhum menu (roda como anon quando não há sessão). Criamos uma VIEW
--     com só as 5 colunas não sensíveis (nome/setor/cargo/situação — sem
--     CPF/salário/PIS) e liberamos ela pra anon+authenticated. A tabela
--     completa continua fechada pros demais.
--
-- Limitação conhecida (mesma already documentada p/ WA_CURRICULOS): RLS
-- não distingue COLUNA, só LINHA — quem tem qualquer um dos menus acima lê
-- a linha inteira, inclusive salário. Column-level de verdade exigiria
-- views próprias por consumidor; fica pra uma fase futura.

CREATE OR REPLACE VIEW public."VW_EMPREGADOS_BASICO" AS
SELECT "ID", "Nome", "Setor_ERP", "Título do Cargo", "Situação"
FROM public."EMPREGADOS";

GRANT SELECT ON public."VW_EMPREGADOS_BASICO" TO anon, authenticated;

DROP POLICY IF EXISTS erp_auth_read_empregados ON public."EMPREGADOS";
CREATE POLICY erp_auth_read_empregados ON public."EMPREGADOS" FOR SELECT TO authenticated
USING (
  auth_user_id = auth.uid()
  OR public.has_screen_access(auth.uid(), 'colaboradores', 'visualizar'::app_acao)
  OR public.has_screen_access(auth.uid(), 'recrutamento_gestao', 'visualizar'::app_acao)
  OR public.has_screen_access(auth.uid(), 'sst_aso', 'visualizar'::app_acao)
  OR public.has_screen_access(auth.uid(), 'candidatos', 'visualizar'::app_acao)
  OR public.has_screen_access(auth.uid(), 'encarregados_minhas_solicitacoes', 'visualizar'::app_acao)
  OR public.has_screen_access(auth.uid(), 'processos', 'visualizar'::app_acao)
  OR public.has_screen_access(auth.uid(), 'patrimonios', 'visualizar'::app_acao)
  OR public.has_screen_access(auth.uid(), 'duvidas', 'visualizar'::app_acao)
  OR public.has_screen_access(auth.uid(), 'central_servicos_formularios', 'visualizar'::app_acao)
);

-- UPDATE: soma o caso do EmpregadoDetalheModal.tsx (define/remove líder) ao
-- que já valia desde a migration 005 (RH via 'colaboradores').
DROP POLICY IF EXISTS empregados_update_rh ON public."EMPREGADOS";
CREATE POLICY empregados_update_rh ON public."EMPREGADOS" FOR UPDATE TO authenticated
  USING (
    public.has_screen_access(auth.uid(), 'colaboradores', 'alterar'::app_acao)
    OR public.has_screen_access(auth.uid(), 'central_servicos_formularios', 'alterar'::app_acao)
  )
  WITH CHECK (
    public.has_screen_access(auth.uid(), 'colaboradores', 'alterar'::app_acao)
    OR public.has_screen_access(auth.uid(), 'central_servicos_formularios', 'alterar'::app_acao)
  );

-- INSERT: só cadastro de colaborador (NovasAdmissoes.tsx, ImportarColaboradores.tsx) — RH.
DROP POLICY IF EXISTS empregados_insert_auth ON public."EMPREGADOS";
CREATE POLICY empregados_insert_auth ON public."EMPREGADOS" FOR INSERT TO authenticated
  WITH CHECK (public.has_screen_access(auth.uid(), 'colaboradores', 'incluir'::app_acao));

-- Nota operacional: NovasAdmissoes.tsx também escreve em WA_CURRICULOS/
-- RECRUTAMENTO_HISTORICO (gateados em 20260717190008 por recrutamento_gestao/
-- sst_aso/candidatos/encarregados, SEM 'colaboradores' na lista). Se alguém
-- só tiver 'colaboradores' (RH puro, sem recrutamento_gestao), a tela de
-- Novas Admissões pode falhar nesse passo — teste com um usuário real antes
-- de liberar em produção e, se precisar, adicione 'colaboradores' como
-- opção extra nas policies de WA_CURRICULOS/RECRUTAMENTO_HISTORICO.

-- Rollback: recriar as 3 policies com USING(true)/WITH CHECK(true) e
-- DROP VIEW public."VW_EMPREGADOS_BASICO".

NOTIFY pgrst, 'reload schema';
