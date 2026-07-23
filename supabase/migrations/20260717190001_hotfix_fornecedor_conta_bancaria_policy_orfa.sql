-- FASE 0 (hotfix emergencial) — fornecedor_conta_bancaria
--
-- Achado: a migration 20260527022852 tentou remover as policies antigas
-- (sem escopo de empresa, criadas em 20260518191240) mas errou o nome —
-- tentou dropar "perm select/insert/update/delete fornecedor_conta_bancaria"
-- (com sufixo "_bancaria"), quando o nome real das policies criadas em
-- 20260518191240 é "perm select/insert/update/delete fornecedor_conta"
-- (SEM o sufixo). DROP POLICY IF EXISTS não erra quando o nome não bate —
-- só não faz nada. Resultado: essas 4 policies órfãs continuam ativas até
-- hoje, e como o Postgres combina policies PERMISSIVE com OR, elas reabrem
-- exatamente o buraco que a migration de 20260527182227 achou que tinha
-- fechado — sem checar empresa_id, qualquer usuário com a permissão
-- genérica de "suprimentos" (has_permissao) vê contas bancárias de
-- fornecedores de TODAS as empresas, não só da sua.
--
-- Fix: dropar as 4 policies órfãs pelo nome exato. As policies corretas
-- (fcb_select/fcb_insert/fcb_update/fcb_delete, criadas na mesma migration
-- 20260527022852, já com o EXISTS de empresa_id/is_global) não são tocadas
-- e continuam valendo — este fix só remove o vazamento residual, não muda
-- nenhum comportamento pretendido.

DROP POLICY IF EXISTS "perm select fornecedor_conta" ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "perm insert fornecedor_conta" ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "perm update fornecedor_conta" ON public.fornecedor_conta_bancaria;
DROP POLICY IF EXISTS "perm delete fornecedor_conta" ON public.fornecedor_conta_bancaria;

-- Rollback: recriar as 4 policies removidas com o texto original de
-- 20260518191240 (não recomendado — reabre o vazamento; documentado aqui
-- só para reversão de emergência caso esta migration quebre algo
-- inesperado):
--
-- CREATE POLICY "perm select fornecedor_conta" ON public.fornecedor_conta_bancaria FOR SELECT TO authenticated USING (public.has_permissao(auth.uid(),'suprimentos','visualizar','fornecedor.conta_bancaria'));
-- CREATE POLICY "perm insert fornecedor_conta" ON public.fornecedor_conta_bancaria FOR INSERT TO authenticated WITH CHECK (public.has_permissao(auth.uid(),'suprimentos','incluir','fornecedor.conta_bancaria'));
-- CREATE POLICY "perm update fornecedor_conta" ON public.fornecedor_conta_bancaria FOR UPDATE TO authenticated USING (public.has_permissao(auth.uid(),'suprimentos','alterar','fornecedor.conta_bancaria')) WITH CHECK (public.has_permissao(auth.uid(),'suprimentos','alterar','fornecedor.conta_bancaria'));
-- CREATE POLICY "perm delete fornecedor_conta" ON public.fornecedor_conta_bancaria FOR DELETE TO authenticated USING (public.has_permissao(auth.uid(),'suprimentos','excluir','fornecedor.conta_bancaria'));

NOTIFY pgrst, 'reload schema';
