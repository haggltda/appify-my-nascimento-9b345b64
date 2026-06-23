-- Solicitações ERP: troca o fluxo de 8 para 13 etapas e remove todo o
-- modelo de permissão granular (visualizar / criar / mover por transição)
-- que existia em /app/administracao?tab=modulos no dropdown "Sistemas".
-- A partir desta migration, a tela fica liberada para qualquer usuário
-- autenticado: ver, criar card e mover entre quaisquer das 13 colunas, em
-- qualquer ordem. Não havia dados reais cadastrados, então a tabela é
-- zerada antes de trocar o conjunto de etapas (sem mapeamento 8→13).
--
-- O que NÃO é permissão de admin e por isso continua igual (funcionalidade
-- do card, não regra configurável): responsável só edita progresso/data
-- final da própria solicitação.

-- 1) Zera os dados existentes (anexo/comentário caem em cascata) ------------
TRUNCATE public.sistema_solicitacao CASCADE;

-- 2) Novo conjunto de 13 etapas ---------------------------------------------
ALTER TABLE public.sistema_solicitacao
  DROP CONSTRAINT IF EXISTS sistema_solicitacao_etapa_check;

ALTER TABLE public.sistema_solicitacao
  ALTER COLUMN etapa SET DEFAULT 'registro_oficial';

ALTER TABLE public.sistema_solicitacao
  ADD CONSTRAINT sistema_solicitacao_etapa_check CHECK (etapa IN (
    'registro_oficial',
    'triagem_inicial_comite',
    'projeto',
    'aprovacoes_priorizacao',
    'definicao_responsavel',
    'desenvolvimento_ajustes',
    'validacao',
    'homologacao_tecnica',
    'homologacao_usuario',
    'treinamentos',
    'implantacao',
    'acompanhamento_assistido',
    'encerramento'
  ));

-- 3) RLS sem checagem de permissão ------------------------------------------
DROP POLICY IF EXISTS sistema_solicitacao_select ON public.sistema_solicitacao;
CREATE POLICY sistema_solicitacao_select ON public.sistema_solicitacao
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS sistema_solicitacao_insert ON public.sistema_solicitacao;
CREATE POLICY sistema_solicitacao_insert ON public.sistema_solicitacao
  FOR INSERT TO authenticated
  WITH CHECK (etapa = 'registro_oficial');

DROP POLICY IF EXISTS sistema_solicitacao_update ON public.sistema_solicitacao;
CREATE POLICY sistema_solicitacao_update ON public.sistema_solicitacao
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS sistema_solicitacao_anexo_select ON public.sistema_solicitacao_anexo;
CREATE POLICY sistema_solicitacao_anexo_select ON public.sistema_solicitacao_anexo
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS sistema_solicitacao_anexo_insert ON public.sistema_solicitacao_anexo;
CREATE POLICY sistema_solicitacao_anexo_insert ON public.sistema_solicitacao_anexo
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS sistema_solicitacao_comentario_select ON public.sistema_solicitacao_comentario;
CREATE POLICY sistema_solicitacao_comentario_select ON public.sistema_solicitacao_comentario
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS sistema_solicitacao_comentario_insert ON public.sistema_solicitacao_comentario;
CREATE POLICY sistema_solicitacao_comentario_insert ON public.sistema_solicitacao_comentario
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 4) Storage do bucket sem checagem de permissão ----------------------------
DROP POLICY IF EXISTS "sistema solicitacoes anexo select" ON storage.objects;
CREATE POLICY "sistema solicitacoes anexo select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'sistema-solicitacoes');

DROP POLICY IF EXISTS "sistema solicitacoes anexo insert" ON storage.objects;
CREATE POLICY "sistema solicitacoes anexo insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sistema-solicitacoes');

-- 5) Trigger simplificado -----------------------------------------------------
-- Mantém só as regras de identidade (quem é o responsável da solicitação),
-- que são comportamento do card. Remove a checagem de transição etapa-a-etapa
-- e a restrição de etapa pra definir responsável — ambas eram permissão de
-- admin, agora removida.
CREATE OR REPLACE FUNCTION public.checar_transicao_sistema_solicitacao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.progresso_pct IS DISTINCT FROM OLD.progresso_pct THEN
    IF OLD.responsavel_user_id IS NULL OR auth.uid() <> OLD.responsavel_user_id THEN
      RAISE EXCEPTION 'Só o responsável atual da solicitação pode atualizar o percentual de progresso.';
    END IF;
  END IF;

  IF NEW.data_fim IS DISTINCT FROM OLD.data_fim THEN
    IF OLD.responsavel_user_id IS NULL OR auth.uid() <> OLD.responsavel_user_id THEN
      RAISE EXCEPTION 'Só o responsável atual da solicitação pode preencher a data final.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 6) Remove os toggles do dropdown "Sistemas" em administração --------------
DELETE FROM public.screen_permission_user
 WHERE menu_codigo IN (
   'sistemas_solicitacoes_erp',
   'sistemas_criar_solicitacao',
   'sistemas_mover_solicitacoes_aprovado_presidencia',
   'sistemas_mover_aprovado_presidencia_projetos',
   'sistemas_mover_projetos_em_andamento',
   'sistemas_mover_em_andamento_validacao_presidencia',
   'sistemas_mover_validacao_presidencia_teste_setor',
   'sistemas_mover_teste_setor_treinamentos',
   'sistemas_mover_treinamentos_implantacao'
 );

DELETE FROM public.app_menu
 WHERE codigo IN (
   'sistemas_solicitacoes_erp',
   'sistemas_criar_solicitacao',
   'sistemas_mover_solicitacoes_aprovado_presidencia',
   'sistemas_mover_aprovado_presidencia_projetos',
   'sistemas_mover_projetos_em_andamento',
   'sistemas_mover_em_andamento_validacao_presidencia',
   'sistemas_mover_validacao_presidencia_teste_setor',
   'sistemas_mover_teste_setor_treinamentos',
   'sistemas_mover_treinamentos_implantacao'
 );

DELETE FROM public.app_modulo WHERE codigo = 'sistemas';

-- 7) Função de permissão não é mais usada por nenhum módulo ------------------
DROP FUNCTION IF EXISTS public.tem_acesso_menu(text, text);
