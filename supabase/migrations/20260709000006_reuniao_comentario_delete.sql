-- Exclusão de comentário — só o autor do comentário ou quem organiza a
-- reunião (criador ou responsável pelo preenchimento) pode apagar.

DROP POLICY IF EXISTS reuniao_comentario_delete ON public.reuniao_comentario;
CREATE POLICY reuniao_comentario_delete ON public.reuniao_comentario
  FOR DELETE TO authenticated
  USING (
    autor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.reuniao r
       WHERE r.id = reuniao_id
         AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id)
    )
  );
