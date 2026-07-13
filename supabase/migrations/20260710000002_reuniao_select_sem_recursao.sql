-- Corrige "new row violates row-level security policy for table 'reuniao'"
-- ao criar reunião. Causa: reuniao_select (de 20260710000001) chamava
-- tem_interacao_reuniao(id), que por sua vez faz SELECT em public.reuniao —
-- ou seja, a policy da própria tabela reuniao dependia de uma função que
-- reconsulta reuniao, gerando recursão na hora de validar o RETURNING do
-- INSERT (Postgres exige que a linha recém-inserida passe pela policy de
-- SELECT quando há RETURNING).
--
-- Fix: pra reuniao_select especificamente, compara as colunas direto (sem
-- chamar a função, sem reconsultar a própria tabela) — só usa EXISTS numa
-- tabela diferente (reuniao_convidado) pro caso de convidado. As tabelas
-- filhas (pauta, anexo, comentário etc.) continuam usando
-- tem_interacao_reuniao(reuniao_id) normalmente, porque ali não há
-- auto-referência (a policy é de uma tabela, a função consulta outra).

DROP POLICY IF EXISTS reuniao_select ON public.reuniao;
CREATE POLICY reuniao_select ON public.reuniao
  FOR SELECT TO authenticated
  USING (
    public.tem_acesso_menu('central_servicos_reunioes')
    AND (
      auth.uid() = criado_por
      OR auth.uid() = responsavel_preenchimento_user_id
      OR EXISTS (SELECT 1 FROM public.reuniao_convidado c WHERE c.reuniao_id = id AND c.user_id = auth.uid())
    )
  );
