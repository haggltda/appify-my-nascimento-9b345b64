-- HOTFIX — empresas SELECT quebrou o contexto de empresa ativa pra qualquer
-- usuário sem perfil_acesso cobrindo o menu 'empresas' (achado em produção:
-- Plano de Ações sumindo da sidebar pra usuários normais, mas na verdade
-- afeta qualquer coisa que dependa de EmpresaAtivaContext).
--
-- Causa: 20260718100001 (fase3 lote 1) trocou o SELECT de empresas pra
-- can_access(auth.uid(),'empresas','visualizar') — a permissão da TELA
-- Controladoria > Empresas. Mas EmpresaAtivaContext.tsx lê essa tabela
-- direto do client só pra popular "em qual empresa este usuário está
-- operando" — toda sessão autenticada precisa disso, independente de ter
-- permissão pra GERENCIAR empresas. Sem nenhuma linha retornada, o
-- contexto de empresa nunca carrega e qualquer tela que dependa dele some.
--
-- Fix: SELECT volta a valer por vínculo real de empresa
-- (user_pode_atuar_empresa: has_role(admin) OR acessa_todas_empresas OR
-- user_empresa) — não é a mesma coisa que "permissão de tela", é "em quais
-- empresas este usuário pode operar", uma pergunta estrutural de sessão,
-- não uma permissão de negócio. INSERT/UPDATE continuam via can_access
-- (só quem pode gerenciar empresas cria/edita), não mexidos aqui.

DROP POLICY IF EXISTS empresas_select_scoped ON public.empresas;
CREATE POLICY empresas_select_scoped ON public.empresas FOR SELECT TO authenticated
  USING (public.user_pode_atuar_empresa(auth.uid(), id));

NOTIFY pgrst, 'reload schema';
