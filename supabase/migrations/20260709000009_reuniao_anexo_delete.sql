-- Exclusão de anexo no nível da reunião (aba "Anexos") — mesmo padrão de
-- acesso das demais operações da tela, não é restrito ao autor do upload.

DROP POLICY IF EXISTS reuniao_anexo_delete ON public.reuniao_anexo;
CREATE POLICY reuniao_anexo_delete ON public.reuniao_anexo
  FOR DELETE TO authenticated
  USING (public.tem_acesso_menu('central_servicos_reunioes'));
