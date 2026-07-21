-- BUG CRÍTICO: reuniao_select (desde 20260710000002_reuniao_select_sem_recursao.sql)
-- comparava "c.reuniao_id = id" dentro do EXISTS contra reuniao_convidado —
-- como reuniao_convidado também tem uma coluna "id" (sua própria PK), o
-- Postgres resolvia "id" (sem qualificar) para reuniao_convidado.id, não
-- para reuniao.id da linha de fora. Resultado: a condição "é convidado"
-- nunca era verdadeira (reuniao_convidado.reuniao_id quase nunca é igual
-- a reuniao_convidado.id) — convidados nunca conseguiam ver a reunião pra
-- qual foram convidados, só criador e responsável pela ata.
--
-- Fix: qualifica explicitamente com "reuniao.id" (nome da tabela) pra
-- remover a ambiguidade. Aproveita e inclui organizador_user_id, que
-- também faltava nessa policy (só entrou nas tabelas filhas em
-- 20260718000001, nunca nesta policy específica de reuniao).

DROP POLICY IF EXISTS reuniao_select ON public.reuniao;
CREATE POLICY reuniao_select ON public.reuniao
  FOR SELECT TO authenticated
  USING (
    public.tem_acesso_menu('central_servicos_reunioes')
    AND (
      auth.uid() = criado_por
      OR auth.uid() = responsavel_preenchimento_user_id
      OR auth.uid() = organizador_user_id
      OR EXISTS (
        SELECT 1 FROM public.reuniao_convidado c
        WHERE c.reuniao_id = reuniao.id AND c.user_id = auth.uid()
      )
    )
  );
