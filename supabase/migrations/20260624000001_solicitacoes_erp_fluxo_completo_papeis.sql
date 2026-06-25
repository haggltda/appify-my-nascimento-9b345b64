-- Solicitações ERP: fluxo completo de 12 etapas com 7 papéis configuráveis
-- por usuário em /app/administracao?tab=modulos (módulo "Sistemas"), visibilidade
-- restrita (criador / convidado / "ver todas" / papéis de ação veem tudo),
-- regras específicas por coluna e log de auditoria de tudo que acontece no card.
--
-- Desfaz o modelo "acesso livre, movimento livre" da migration anterior
-- (20260623000001) — agora cada ação é novamente gated por papel.

-- 1) Novas colunas em sistema_solicitacao -----------------------------------
ALTER TABLE public.sistema_solicitacao
  ADD COLUMN IF NOT EXISTS recusado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prioridade integer,
  ADD COLUMN IF NOT EXISTS levantamento_funcional_texto text,
  ADD COLUMN IF NOT EXISTS levantamento_funcional_prazo date,
  ADD COLUMN IF NOT EXISTS documentacao_tecnica_texto text,
  ADD COLUMN IF NOT EXISTS documentacao_tecnica_prazo date,
  ADD COLUMN IF NOT EXISTS analise_tecnica_texto text,
  ADD COLUMN IF NOT EXISTS analise_tecnica_prazo date,
  ADD COLUMN IF NOT EXISTS treinamento_data date,
  ADD COLUMN IF NOT EXISTS implantacao_status text,
  ADD COLUMN IF NOT EXISTS finalizado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS etapa_entrada_em timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.sistema_solicitacao
  DROP CONSTRAINT IF EXISTS sistema_solicitacao_implantacao_status_check;
ALTER TABLE public.sistema_solicitacao
  ADD CONSTRAINT sistema_solicitacao_implantacao_status_check
  CHECK (implantacao_status IS NULL OR implantacao_status IN ('sim', 'nao', 'em_implantacao'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_sistema_solicitacao_prioridade_unica
  ON public.sistema_solicitacao (prioridade)
  WHERE etapa = 'aprovacoes_priorizacao';

-- 2) Etapa "validacao" deixa de existir — remapeia eventuais cards nela -----
UPDATE public.sistema_solicitacao SET etapa = 'homologacao_tecnica' WHERE etapa = 'validacao';

ALTER TABLE public.sistema_solicitacao DROP CONSTRAINT IF EXISTS sistema_solicitacao_etapa_check;
ALTER TABLE public.sistema_solicitacao ADD CONSTRAINT sistema_solicitacao_etapa_check CHECK (etapa IN (
  'registro_oficial',
  'triagem_inicial_comite',
  'projeto',
  'aprovacoes_priorizacao',
  'definicao_responsavel',
  'desenvolvimento_ajustes',
  'homologacao_tecnica',
  'homologacao_usuario',
  'treinamentos',
  'implantacao',
  'acompanhamento_assistido',
  'encerramento'
));

-- 3) Tags em anexo/comentário pra campos/ações específicas -------------------
ALTER TABLE public.sistema_solicitacao_anexo ADD COLUMN IF NOT EXISTS campo text;
ALTER TABLE public.sistema_solicitacao_comentario ADD COLUMN IF NOT EXISTS tipo text;

-- 4) Tabela de convidados -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sistema_solicitacao_convidado (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.sistema_solicitacao(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (solicitacao_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_sistema_solicitacao_convidado_solicitacao ON public.sistema_solicitacao_convidado(solicitacao_id);

-- 5) Tabela de log de auditoria -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.sistema_solicitacao_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.sistema_solicitacao(id) ON DELETE CASCADE,
  user_id        uuid REFERENCES auth.users(id),
  acao           text NOT NULL,
  etapa_de       text,
  etapa_para     text,
  detalhe        text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sistema_solicitacao_log_solicitacao ON public.sistema_solicitacao_log(solicitacao_id);

-- 6) Helpers de permissão e visibilidade --------------------------------------
-- Mesmo padrão de antes (allow=true explícito em screen_permission_user,
-- sem bypass de role/cargo).
CREATE OR REPLACE FUNCTION public.tem_acesso_menu(_menu_codigo text, _acao text DEFAULT 'visualizar')
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.screen_permission_user
     WHERE user_id      = auth.uid()
       AND menu_codigo   = _menu_codigo
       AND acao          = _acao::public.app_acao
       AND allow         = true
       AND empresa_id IS NULL
  );
$$;
REVOKE ALL ON FUNCTION public.tem_acesso_menu(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tem_acesso_menu(text, text) TO authenticated;

-- Visibilidade: criador, convidado, "ver todas", ou qualquer um dos 4 papéis
-- de ação (que precisam ver o board inteiro pra trabalhar nas suas etapas).
CREATE OR REPLACE FUNCTION public.sistema_pode_ver(_criado_por uuid, _solicitacao_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
    _criado_por = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.sistema_solicitacao_convidado
       WHERE solicitacao_id = _solicitacao_id AND user_id = auth.uid()
    )
    OR public.tem_acesso_menu('sistemas_ver_todas_solicitacoes')
    OR public.tem_acesso_menu('sistemas_comite')
    OR public.tem_acesso_menu('sistemas_controladoria')
    OR public.tem_acesso_menu('sistemas_gerente_sistemas')
    OR public.tem_acesso_menu('sistemas_desenvolvedores');
$$;
REVOKE ALL ON FUNCTION public.sistema_pode_ver(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sistema_pode_ver(uuid, uuid) TO authenticated;

-- Elegibilidade pra agir na Homologação do Usuário: quem criou, quem foi
-- convidado naquela solicitação específica, ou Controladoria.
CREATE OR REPLACE FUNCTION public.sistema_pode_agir_homologacao_usuario(_criado_por uuid, _solicitacao_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
    _criado_por = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.sistema_solicitacao_convidado
       WHERE solicitacao_id = _solicitacao_id AND user_id = auth.uid()
    )
    OR public.tem_acesso_menu('sistemas_controladoria');
$$;
REVOKE ALL ON FUNCTION public.sistema_pode_agir_homologacao_usuario(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sistema_pode_agir_homologacao_usuario(uuid, uuid) TO authenticated;

-- 7) RLS: sistema_solicitacao --------------------------------------------------
DROP POLICY IF EXISTS sistema_solicitacao_select ON public.sistema_solicitacao;
CREATE POLICY sistema_solicitacao_select ON public.sistema_solicitacao
  FOR SELECT TO authenticated
  USING (public.sistema_pode_ver(criado_por, id));

DROP POLICY IF EXISTS sistema_solicitacao_insert ON public.sistema_solicitacao;
CREATE POLICY sistema_solicitacao_insert ON public.sistema_solicitacao
  FOR INSERT TO authenticated
  WITH CHECK (
    etapa = 'registro_oficial'
    AND criado_por = auth.uid()
    AND public.tem_acesso_menu('sistemas_criar_solicitacao')
  );

DROP POLICY IF EXISTS sistema_solicitacao_update ON public.sistema_solicitacao;
CREATE POLICY sistema_solicitacao_update ON public.sistema_solicitacao
  FOR UPDATE TO authenticated
  USING (public.sistema_pode_ver(criado_por, id))
  WITH CHECK (public.sistema_pode_ver(criado_por, id));

-- Excluir (card 2, botão "Excluir" no estado recusado): só Controladoria.
DROP POLICY IF EXISTS sistema_solicitacao_delete ON public.sistema_solicitacao;
CREATE POLICY sistema_solicitacao_delete ON public.sistema_solicitacao
  FOR DELETE TO authenticated
  USING (recusado = true AND etapa = 'triagem_inicial_comite' AND public.tem_acesso_menu('sistemas_controladoria'));

-- 8) RLS: anexo, comentário, convidado, log -----------------------------------
DROP POLICY IF EXISTS sistema_solicitacao_anexo_select ON public.sistema_solicitacao_anexo;
CREATE POLICY sistema_solicitacao_anexo_select ON public.sistema_solicitacao_anexo
  FOR SELECT TO authenticated
  USING (public.sistema_pode_ver((SELECT criado_por FROM public.sistema_solicitacao WHERE id = solicitacao_id), solicitacao_id));

DROP POLICY IF EXISTS sistema_solicitacao_anexo_insert ON public.sistema_solicitacao_anexo;
CREATE POLICY sistema_solicitacao_anexo_insert ON public.sistema_solicitacao_anexo
  FOR INSERT TO authenticated
  WITH CHECK (public.sistema_pode_ver((SELECT criado_por FROM public.sistema_solicitacao WHERE id = solicitacao_id), solicitacao_id));

DROP POLICY IF EXISTS sistema_solicitacao_comentario_select ON public.sistema_solicitacao_comentario;
CREATE POLICY sistema_solicitacao_comentario_select ON public.sistema_solicitacao_comentario
  FOR SELECT TO authenticated
  USING (public.sistema_pode_ver((SELECT criado_por FROM public.sistema_solicitacao WHERE id = solicitacao_id), solicitacao_id));

DROP POLICY IF EXISTS sistema_solicitacao_comentario_insert ON public.sistema_solicitacao_comentario;
CREATE POLICY sistema_solicitacao_comentario_insert ON public.sistema_solicitacao_comentario
  FOR INSERT TO authenticated
  WITH CHECK (public.sistema_pode_ver((SELECT criado_por FROM public.sistema_solicitacao WHERE id = solicitacao_id), solicitacao_id));

ALTER TABLE public.sistema_solicitacao_convidado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sistema_solicitacao_convidado_select ON public.sistema_solicitacao_convidado;
CREATE POLICY sistema_solicitacao_convidado_select ON public.sistema_solicitacao_convidado
  FOR SELECT TO authenticated
  USING (public.sistema_pode_ver((SELECT criado_por FROM public.sistema_solicitacao WHERE id = solicitacao_id), solicitacao_id));

DROP POLICY IF EXISTS sistema_solicitacao_convidado_insert ON public.sistema_solicitacao_convidado;
CREATE POLICY sistema_solicitacao_convidado_insert ON public.sistema_solicitacao_convidado
  FOR INSERT TO authenticated
  WITH CHECK (public.sistema_pode_ver((SELECT criado_por FROM public.sistema_solicitacao WHERE id = solicitacao_id), solicitacao_id));

DROP POLICY IF EXISTS sistema_solicitacao_convidado_delete ON public.sistema_solicitacao_convidado;
CREATE POLICY sistema_solicitacao_convidado_delete ON public.sistema_solicitacao_convidado
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sistema_solicitacao s
       WHERE s.id = solicitacao_id AND s.criado_por = auth.uid() AND s.etapa = 'registro_oficial'
    )
  );

ALTER TABLE public.sistema_solicitacao_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sistema_solicitacao_log_select ON public.sistema_solicitacao_log;
CREATE POLICY sistema_solicitacao_log_select ON public.sistema_solicitacao_log
  FOR SELECT TO authenticated
  USING (public.sistema_pode_ver((SELECT criado_por FROM public.sistema_solicitacao WHERE id = solicitacao_id), solicitacao_id));
-- Sem policy de insert/update/delete pra usuários — só o trigger (SECURITY DEFINER) escreve.

-- 9) Trigger BEFORE INSERT: convidado só pelo criador, só na coluna 1, e só
-- pra usuário com a permissão "Convidado" habilitada -------------------------
CREATE OR REPLACE FUNCTION public.checar_convidado_sistema_solicitacao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_etapa text;
  v_criado_por uuid;
BEGIN
  SELECT etapa, criado_por INTO v_etapa, v_criado_por
    FROM public.sistema_solicitacao WHERE id = NEW.solicitacao_id;

  IF v_criado_por IS DISTINCT FROM auth.uid() OR v_etapa <> 'registro_oficial' THEN
    RAISE EXCEPTION 'Convidado só pode ser adicionado pelo criador, enquanto o card está em "Solicitações Registro Oficial".';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.screen_permission_user
     WHERE user_id = NEW.user_id AND menu_codigo = 'sistemas_convidado'
       AND acao = 'visualizar' AND allow = true AND empresa_id IS NULL
  ) THEN
    RAISE EXCEPTION 'O usuário selecionado não tem a permissão de Convidado habilitada.';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_checar_convidado_sistema_solicitacao ON public.sistema_solicitacao_convidado;
CREATE TRIGGER trg_checar_convidado_sistema_solicitacao
  BEFORE INSERT ON public.sistema_solicitacao_convidado
  FOR EACH ROW EXECUTE FUNCTION public.checar_convidado_sistema_solicitacao();

-- 10) Trigger BEFORE INSERT: anexo marcado com `campo` exige etapa+papel ------
CREATE OR REPLACE FUNCTION public.checar_anexo_campo_sistema_solicitacao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_etapa text;
BEGIN
  IF NEW.campo IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT etapa INTO v_etapa FROM public.sistema_solicitacao WHERE id = NEW.solicitacao_id;

  IF NEW.campo IN ('levantamento_funcional', 'documentacao_tecnica', 'analise_tecnica') THEN
    IF v_etapa <> 'projeto' OR NOT (public.tem_acesso_menu('sistemas_comite') OR public.tem_acesso_menu('sistemas_desenvolvedores')) THEN
      RAISE EXCEPTION 'Esse anexo só é permitido na etapa Projeto, por Comitê ou Desenvolvedores.';
    END IF;
  ELSIF NEW.campo = 'treinamento' THEN
    IF v_etapa <> 'treinamentos' OR NOT (public.tem_acesso_menu('sistemas_comite') OR public.tem_acesso_menu('sistemas_controladoria')) THEN
      RAISE EXCEPTION 'Esse anexo só é permitido na etapa Treinamentos, por Comitê ou Controladoria.';
    END IF;
  ELSIF NEW.campo IN ('acompanhamento', 'encerramento') THEN
    IF NOT public.tem_acesso_menu('sistemas_controladoria') THEN
      RAISE EXCEPTION 'Esse anexo só é permitido pra Controladoria.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_checar_anexo_campo_sistema_solicitacao ON public.sistema_solicitacao_anexo;
CREATE TRIGGER trg_checar_anexo_campo_sistema_solicitacao
  BEFORE INSERT ON public.sistema_solicitacao_anexo
  FOR EACH ROW EXECUTE FUNCTION public.checar_anexo_campo_sistema_solicitacao();

-- 11) Trigger BEFORE INSERT: comentário marcado com `tipo` exige etapa+papel --
CREATE OR REPLACE FUNCTION public.checar_comentario_tipo_sistema_solicitacao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_etapa text;
  v_criado_por uuid;
BEGIN
  IF NEW.tipo IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT etapa, criado_por INTO v_etapa, v_criado_por
    FROM public.sistema_solicitacao WHERE id = NEW.solicitacao_id;

  IF NEW.tipo = 'justificativa_retorno' THEN
    IF v_etapa <> 'homologacao_tecnica'
       OR NOT (public.tem_acesso_menu('sistemas_comite') OR public.tem_acesso_menu('sistemas_controladoria') OR public.tem_acesso_menu('sistemas_desenvolvedores')) THEN
      RAISE EXCEPTION 'Justificativa de retorno só é permitida na Homologação Técnica, por Comitê, Controladoria ou Desenvolvedores.';
    END IF;
  ELSIF NEW.tipo IN ('aprovado_ressalva', 'reprovado') THEN
    IF v_etapa <> 'homologacao_usuario' OR NOT public.sistema_pode_agir_homologacao_usuario(v_criado_por, NEW.solicitacao_id) THEN
      RAISE EXCEPTION 'Essa ação só é permitida na Homologação do Usuário, por quem criou, foi convidado, ou Controladoria.';
    END IF;
  ELSIF NEW.tipo IN ('faltou_funcoes', 'encontrado_bug') THEN
    IF v_etapa <> 'treinamentos' OR NOT (public.tem_acesso_menu('sistemas_comite') OR public.tem_acesso_menu('sistemas_controladoria')) THEN
      RAISE EXCEPTION 'Esse comentário só é permitido na etapa Treinamentos, por Comitê ou Controladoria.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_checar_comentario_tipo_sistema_solicitacao ON public.sistema_solicitacao_comentario;
CREATE TRIGGER trg_checar_comentario_tipo_sistema_solicitacao
  BEFORE INSERT ON public.sistema_solicitacao_comentario
  FOR EACH ROW EXECUTE FUNCTION public.checar_comentario_tipo_sistema_solicitacao();

-- 12) Trigger principal BEFORE UPDATE: transições de etapa + regras de campo -
CREATE OR REPLACE FUNCTION public.checar_transicao_sistema_solicitacao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_ok boolean;
BEGIN
  -- Recusar (fica na mesma coluna, recusado false -> true): só Comitê.
  IF NEW.recusado IS DISTINCT FROM OLD.recusado AND NEW.recusado = true THEN
    IF OLD.etapa <> 'triagem_inicial_comite' OR NOT public.tem_acesso_menu('sistemas_comite') THEN
      RAISE EXCEPTION 'Só o Comitê pode recusar, e só na Triagem Inicial.';
    END IF;
  END IF;

  -- Prioridade: só Comitê, só na coluna de Aprovações e Priorização.
  IF NEW.prioridade IS DISTINCT FROM OLD.prioridade THEN
    IF OLD.etapa <> 'aprovacoes_priorizacao' OR NOT public.tem_acesso_menu('sistemas_comite') THEN
      RAISE EXCEPTION 'Prioridade só pode ser definida na etapa Aprovações e Priorização, por Comitê.';
    END IF;
  END IF;

  -- Responsável: só Gerente de Sistemas, só na coluna Definição de Responsável.
  IF NEW.responsavel_user_id IS DISTINCT FROM OLD.responsavel_user_id THEN
    IF OLD.etapa <> 'definicao_responsavel' OR NOT public.tem_acesso_menu('sistemas_gerente_sistemas') THEN
      RAISE EXCEPTION 'Responsável só pode ser definido na etapa Definição de Responsável, por Gerente de Sistemas.';
    END IF;
  END IF;

  -- Progresso e prazo: só Desenvolvedores/Gerente de Sistemas, só em Desenvolvimento e Ajustes.
  IF NEW.progresso_pct IS DISTINCT FROM OLD.progresso_pct OR NEW.data_fim IS DISTINCT FROM OLD.data_fim THEN
    IF OLD.etapa <> 'desenvolvimento_ajustes' OR NOT (public.tem_acesso_menu('sistemas_desenvolvedores') OR public.tem_acesso_menu('sistemas_gerente_sistemas')) THEN
      RAISE EXCEPTION 'Progresso e prazo só podem ser atualizados na etapa Desenvolvimento e Ajustes, por Desenvolvedores ou Gerente de Sistemas.';
    END IF;
  END IF;

  -- Campos do card Projeto: só Comitê/Desenvolvedores, só na etapa Projeto.
  IF NEW.levantamento_funcional_texto IS DISTINCT FROM OLD.levantamento_funcional_texto
     OR NEW.levantamento_funcional_prazo IS DISTINCT FROM OLD.levantamento_funcional_prazo
     OR NEW.documentacao_tecnica_texto IS DISTINCT FROM OLD.documentacao_tecnica_texto
     OR NEW.documentacao_tecnica_prazo IS DISTINCT FROM OLD.documentacao_tecnica_prazo
     OR NEW.analise_tecnica_texto IS DISTINCT FROM OLD.analise_tecnica_texto
     OR NEW.analise_tecnica_prazo IS DISTINCT FROM OLD.analise_tecnica_prazo THEN
    IF OLD.etapa <> 'projeto' OR NOT (public.tem_acesso_menu('sistemas_comite') OR public.tem_acesso_menu('sistemas_desenvolvedores')) THEN
      RAISE EXCEPTION 'Esses campos só podem ser editados na etapa Projeto, por Comitê ou Desenvolvedores.';
    END IF;
  END IF;

  -- Data de treinamento: só Comitê/Controladoria, só na etapa Treinamentos.
  IF NEW.treinamento_data IS DISTINCT FROM OLD.treinamento_data THEN
    IF OLD.etapa <> 'treinamentos' OR NOT (public.tem_acesso_menu('sistemas_comite') OR public.tem_acesso_menu('sistemas_controladoria')) THEN
      RAISE EXCEPTION 'Data de treinamento só pode ser definida na etapa Treinamentos, por Comitê ou Controladoria.';
    END IF;
  END IF;

  -- Status de implantação: só Controladoria, só na etapa Implantação.
  IF NEW.implantacao_status IS DISTINCT FROM OLD.implantacao_status THEN
    IF OLD.etapa <> 'implantacao' OR NOT public.tem_acesso_menu('sistemas_controladoria') THEN
      RAISE EXCEPTION 'Status de implantação só pode ser definido na etapa Implantação, por Controladoria.';
    END IF;
  END IF;

  -- Finalizar demanda: só Controladoria, só na etapa Encerramento.
  IF NEW.finalizado IS DISTINCT FROM OLD.finalizado AND NEW.finalizado = true THEN
    IF OLD.etapa <> 'encerramento' OR NOT public.tem_acesso_menu('sistemas_controladoria') THEN
      RAISE EXCEPTION 'Só pode finalizar a demanda na etapa Encerramento, por Controladoria.';
    END IF;
  END IF;

  -- Transição de etapa.
  IF NEW.etapa IS DISTINCT FROM OLD.etapa THEN
    v_ok := CASE
      WHEN OLD.etapa = 'registro_oficial' AND NEW.etapa = 'triagem_inicial_comite'
        THEN public.tem_acesso_menu('sistemas_comite')
      WHEN OLD.etapa = 'triagem_inicial_comite' AND NEW.etapa = 'projeto'
        THEN public.tem_acesso_menu('sistemas_comite')
      WHEN OLD.etapa = 'triagem_inicial_comite' AND NEW.etapa = 'registro_oficial' AND OLD.recusado = false
        THEN public.tem_acesso_menu('sistemas_comite')
      WHEN OLD.etapa = 'triagem_inicial_comite' AND NEW.etapa = 'registro_oficial' AND OLD.recusado = true
        THEN public.tem_acesso_menu('sistemas_controladoria')
      WHEN OLD.etapa = 'projeto' AND NEW.etapa = 'aprovacoes_priorizacao'
        THEN public.tem_acesso_menu('sistemas_comite') OR public.tem_acesso_menu('sistemas_desenvolvedores')
      WHEN OLD.etapa = 'aprovacoes_priorizacao' AND NEW.etapa = 'definicao_responsavel'
        THEN public.tem_acesso_menu('sistemas_comite')
      WHEN OLD.etapa = 'definicao_responsavel' AND NEW.etapa = 'desenvolvimento_ajustes'
        THEN public.tem_acesso_menu('sistemas_gerente_sistemas')
      WHEN OLD.etapa = 'desenvolvimento_ajustes' AND NEW.etapa = 'homologacao_tecnica'
        THEN public.tem_acesso_menu('sistemas_desenvolvedores') OR public.tem_acesso_menu('sistemas_gerente_sistemas')
      WHEN OLD.etapa = 'homologacao_tecnica' AND NEW.etapa IN ('homologacao_usuario', 'desenvolvimento_ajustes')
        THEN public.tem_acesso_menu('sistemas_comite') OR public.tem_acesso_menu('sistemas_controladoria') OR public.tem_acesso_menu('sistemas_desenvolvedores')
      WHEN OLD.etapa = 'homologacao_usuario' AND NEW.etapa IN ('treinamentos', 'triagem_inicial_comite', 'desenvolvimento_ajustes')
        THEN public.sistema_pode_agir_homologacao_usuario(OLD.criado_por, OLD.id)
      WHEN OLD.etapa = 'treinamentos' AND NEW.etapa IN ('implantacao', 'triagem_inicial_comite', 'desenvolvimento_ajustes')
        THEN public.tem_acesso_menu('sistemas_comite') OR public.tem_acesso_menu('sistemas_controladoria')
      WHEN OLD.etapa = 'implantacao' AND NEW.etapa = 'acompanhamento_assistido'
        THEN public.tem_acesso_menu('sistemas_controladoria')
      WHEN OLD.etapa = 'acompanhamento_assistido' AND NEW.etapa = 'encerramento'
        THEN public.tem_acesso_menu('sistemas_controladoria')
      ELSE NULL
    END;

    IF v_ok IS NULL THEN
      RAISE EXCEPTION 'Transição de etapa não permitida: % → %', OLD.etapa, NEW.etapa;
    END IF;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'Sem permissão para mover de % para %', OLD.etapa, NEW.etapa;
    END IF;

    NEW.etapa_entrada_em := now();

    -- Voltar pra Registro Oficial (Devolver ou Voltar para Solicitações) sempre limpa o estado recusado.
    IF NEW.etapa = 'registro_oficial' THEN
      NEW.recusado := false;
    END IF;

    -- Saiu da coluna de Priorização: limpa a própria prioridade e reajusta os demais cards (1..N sem buracos).
    IF OLD.etapa = 'aprovacoes_priorizacao' THEN
      NEW.prioridade := NULL;
      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY prioridade) AS rn
          FROM public.sistema_solicitacao
         WHERE etapa = 'aprovacoes_priorizacao' AND id <> OLD.id AND prioridade IS NOT NULL
      )
      UPDATE public.sistema_solicitacao s
         SET prioridade = ranked.rn
        FROM ranked
       WHERE s.id = ranked.id AND s.prioridade IS DISTINCT FROM ranked.rn;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
-- Trigger já existe (criado nas migrations anteriores) e continua apontando
-- pra esta função — CREATE OR REPLACE acima já é suficiente.

-- 13) Log de auditoria: registra criação e toda mudança relevante ------------
CREATE OR REPLACE FUNCTION public.log_sistema_solicitacao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, etapa_para, detalhe)
    VALUES (NEW.id, auth.uid(), 'criado', NEW.etapa, NEW.titulo);
    RETURN NEW;
  END IF;

  IF NEW.etapa IS DISTINCT FROM OLD.etapa THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, etapa_de, etapa_para)
    VALUES (NEW.id, auth.uid(), 'mover_etapa', OLD.etapa, NEW.etapa);
  END IF;
  IF NEW.recusado IS DISTINCT FROM OLD.recusado THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'recusado', NEW.recusado::text);
  END IF;
  IF NEW.responsavel_user_id IS DISTINCT FROM OLD.responsavel_user_id THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'definir_responsavel', NEW.responsavel_user_id::text);
  END IF;
  IF NEW.prioridade IS DISTINCT FROM OLD.prioridade THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'definir_prioridade', NEW.prioridade::text);
  END IF;
  IF NEW.progresso_pct IS DISTINCT FROM OLD.progresso_pct THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'atualizar_progresso', NEW.progresso_pct::text);
  END IF;
  IF NEW.data_fim IS DISTINCT FROM OLD.data_fim THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'definir_prazo', NEW.data_fim::text);
  END IF;
  IF NEW.implantacao_status IS DISTINCT FROM OLD.implantacao_status THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'definir_status_implantacao', NEW.implantacao_status);
  END IF;
  IF NEW.finalizado IS DISTINCT FROM OLD.finalizado THEN
    INSERT INTO public.sistema_solicitacao_log (solicitacao_id, user_id, acao, detalhe)
    VALUES (NEW.id, auth.uid(), 'finalizado', NEW.finalizado::text);
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_log_sistema_solicitacao ON public.sistema_solicitacao;
CREATE TRIGGER trg_log_sistema_solicitacao
  AFTER INSERT OR UPDATE ON public.sistema_solicitacao
  FOR EACH ROW EXECUTE FUNCTION public.log_sistema_solicitacao();

-- 14) RPC: usuários elegíveis pra serem convidados ----------------------------
CREATE OR REPLACE FUNCTION public.listar_usuarios_convidaveis()
RETURNS TABLE(id uuid, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT p.id, p.display_name
    FROM public.profiles p
    JOIN public.screen_permission_user spu
      ON spu.user_id = p.id
     AND spu.menu_codigo = 'sistemas_convidado'
     AND spu.acao = 'visualizar'
     AND spu.allow = true
     AND spu.empresa_id IS NULL
   WHERE p.ativo = true
   ORDER BY p.display_name;
$$;
REVOKE ALL ON FUNCTION public.listar_usuarios_convidaveis() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_usuarios_convidaveis() TO authenticated;

-- 15) Módulo "Sistemas" + os 7 papéis configuráveis no admin ------------------
INSERT INTO public.app_modulo (codigo, nome, ordem, icone)
SELECT 'sistemas', 'Sistemas',
       COALESCE((SELECT ordem FROM public.app_modulo WHERE codigo = 'encarregados'), 200) + 5,
       'Laptop2'
WHERE NOT EXISTS (SELECT 1 FROM public.app_modulo WHERE codigo = 'sistemas');

INSERT INTO public.app_menu (modulo_id, codigo, nome, rota, ordem)
SELECT m.id, x.codigo, x.nome, NULL, x.ordem
  FROM (VALUES
    ('sistemas_comite', 'Comitê', 10),
    ('sistemas_controladoria', 'Controladoria', 20),
    ('sistemas_gerente_sistemas', 'Gerente de Sistemas', 30),
    ('sistemas_desenvolvedores', 'Desenvolvedores', 40),
    ('sistemas_criar_solicitacao', 'Criar Solicitação', 50),
    ('sistemas_convidado', 'Convidado', 60),
    ('sistemas_ver_todas_solicitacoes', 'Ver Todas Solicitações', 70)
  ) AS x(codigo, nome, ordem)
  JOIN public.app_modulo m ON m.codigo = 'sistemas'
ON CONFLICT (modulo_id, codigo) DO NOTHING;
