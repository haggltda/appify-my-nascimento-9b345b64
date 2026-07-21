-- Botão "Excluir reunião" (exclusão de verdade, sem volta — diferente de
-- "Cancelar reunião", que só muda a etapa). A tabela reuniao nunca teve
-- policy de DELETE (RLS nega tudo por padrão sem policy permissiva) — só
-- criador, organizador ou responsável pela ata podem excluir, mesmo grupo
-- que já pode cancelar/editar hoje (podeGerenciar no frontend).
--
-- Todas as tabelas filhas (pauta, resposta, convidado, anexo, comentário,
-- assinatura, decisão/ação, assunto fora da pauta, log, home_ocultada) já
-- têm ON DELETE CASCADE até reuniao(id) — a exclusão em cascata já
-- funciona sozinha. Os arquivos no Storage (anexos) não são apagados pelo
-- banco; o frontend remove-os antes de excluir a linha.

DROP POLICY IF EXISTS reuniao_delete ON public.reuniao;
CREATE POLICY reuniao_delete ON public.reuniao
  FOR DELETE TO authenticated
  USING (
    public.tem_acesso_menu('central_servicos_reunioes')
    AND auth.uid() IN (criado_por, responsavel_preenchimento_user_id, organizador_user_id)
  );
