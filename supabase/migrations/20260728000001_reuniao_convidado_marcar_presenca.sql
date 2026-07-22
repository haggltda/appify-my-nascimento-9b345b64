-- Bug: reuniao_convidado nunca teve policy de UPDATE — a coluna "presente"
-- (criada em 20260720000001_reuniao_modo_conducao.sql, pro Modo Condução)
-- nunca conseguia ser salva de verdade. Sem policy de UPDATE, o Postgres
-- não dá erro nenhum: o UPDATE roda, casa zero linhas, e volta como
-- sucesso — por isso os botões "Presente"/"Ausente" pareciam não fazer
-- nada, sem nenhum erro no console.
--
-- Mesmo grupo que já pode inserir/remover convidado (criador, responsável
-- pela ata ou organizador).

DROP POLICY IF EXISTS reuniao_convidado_update ON public.reuniao_convidado;
CREATE POLICY reuniao_convidado_update ON public.reuniao_convidado
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reuniao r
       WHERE r.id = reuniao_id AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id, r.organizador_user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reuniao r
       WHERE r.id = reuniao_id AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id, r.organizador_user_id)
    )
  );
