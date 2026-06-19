-- Módulo "Sistemas" + tela "Solicitações ERP": kanban de 8 etapas.
-- Permissão 100% por usuário (sem bypass de role, mesmo modelo de
-- list_accessible_menus) tanto pra ver a rota quanto pra cada transição
-- de etapa — ver migrations 20260612000002/20260612000004.

-- 1) Módulo + menus -------------------------------------------------------
INSERT INTO public.app_modulo (codigo, nome, ordem, icone)
SELECT 'sistemas', 'Sistemas',
       COALESCE((SELECT ordem FROM public.app_modulo WHERE codigo = 'encarregados'), 200) + 5,
       'Laptop2'
WHERE NOT EXISTS (SELECT 1 FROM public.app_modulo WHERE codigo = 'sistemas');

INSERT INTO public.app_menu (modulo_id, codigo, nome, rota, ordem)
SELECT m.id, x.codigo, x.nome, x.rota, x.ordem
  FROM (VALUES
    ('sistemas_solicitacoes_erp', 'Solicitações ERP', '/app/sistemas/solicitacoes-erp', 10),
    ('sistemas_criar_solicitacao', 'Criar Solicitação', NULL, 20),
    ('sistemas_mover_solicitacoes_aprovado_presidencia', 'Mover: Solicitações → Aprovado Presidência', NULL, 30),
    ('sistemas_mover_aprovado_presidencia_projetos', 'Mover: Aprovado Presidência → Projetos e Definição de Responsável', NULL, 40),
    ('sistemas_mover_projetos_em_andamento', 'Mover: Projetos e Definição de Responsável → Em Andamento', NULL, 50),
    ('sistemas_mover_em_andamento_validacao_presidencia', 'Mover: Em Andamento → Validação Presidência', NULL, 60),
    ('sistemas_mover_validacao_presidencia_teste_setor', 'Mover: Validação Presidência → Teste com Setor Responsável', NULL, 70),
    ('sistemas_mover_teste_setor_treinamentos', 'Mover: Teste com Setor Responsável → Treinamentos', NULL, 80),
    ('sistemas_mover_treinamentos_implantacao', 'Mover: Treinamentos → Implantação', NULL, 90)
  ) AS x(codigo, nome, rota, ordem)
  JOIN public.app_modulo m ON m.codigo = 'sistemas'
ON CONFLICT (modulo_id, codigo) DO NOTHING;

-- 2) Tabela dos cards ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sistema_solicitacao (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      text NOT NULL,
  descricao   text,
  etapa       text NOT NULL DEFAULT 'solicitacoes' CHECK (etapa IN (
                'solicitacoes',
                'aprovado_presidencia',
                'projetos_definicao_responsavel',
                'em_andamento',
                'validacao_presidencia',
                'teste_setor_responsavel',
                'treinamentos',
                'implantacao'
              )),
  criado_por  uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sistema_solicitacao_etapa ON public.sistema_solicitacao(etapa);

DROP TRIGGER IF EXISTS trg_sistema_solicitacao_updated ON public.sistema_solicitacao;
CREATE TRIGGER trg_sistema_solicitacao_updated
  BEFORE UPDATE ON public.sistema_solicitacao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Helper de permissão por usuário ---------------------------------------
-- Mesma regra de list_accessible_menus: só allow=true explícito em
-- screen_permission_user concede acesso — cargo/role não interfere.
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

-- 4) RLS --------------------------------------------------------------------
ALTER TABLE public.sistema_solicitacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sistema_solicitacao_select ON public.sistema_solicitacao;
CREATE POLICY sistema_solicitacao_select ON public.sistema_solicitacao
  FOR SELECT TO authenticated
  USING (public.tem_acesso_menu('sistemas_solicitacoes_erp'));

DROP POLICY IF EXISTS sistema_solicitacao_insert ON public.sistema_solicitacao;
CREATE POLICY sistema_solicitacao_insert ON public.sistema_solicitacao
  FOR INSERT TO authenticated
  WITH CHECK (
    public.tem_acesso_menu('sistemas_solicitacoes_erp')
    AND public.tem_acesso_menu('sistemas_criar_solicitacao')
    AND etapa = 'solicitacoes'
  );

DROP POLICY IF EXISTS sistema_solicitacao_update ON public.sistema_solicitacao;
CREATE POLICY sistema_solicitacao_update ON public.sistema_solicitacao
  FOR UPDATE TO authenticated
  USING (public.tem_acesso_menu('sistemas_solicitacoes_erp'))
  WITH CHECK (public.tem_acesso_menu('sistemas_solicitacoes_erp'));

-- 5) Trigger de transição ---------------------------------------------------
-- Só permite avançar pra próxima etapa exata (fluxo linear, sem pular nem
-- voltar) e só se o usuário tiver o toggle daquela transição específica
-- ligado. Sem isso, desabilitar o botão no front é só cosmético — qualquer
-- chamada direta à API conseguiria mover o card sem permissão.
CREATE OR REPLACE FUNCTION public.checar_transicao_sistema_solicitacao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_codigo text;
BEGIN
  IF NEW.etapa = OLD.etapa THEN
    RETURN NEW;
  END IF;

  v_codigo := CASE
    WHEN OLD.etapa = 'solicitacoes' AND NEW.etapa = 'aprovado_presidencia'
      THEN 'sistemas_mover_solicitacoes_aprovado_presidencia'
    WHEN OLD.etapa = 'aprovado_presidencia' AND NEW.etapa = 'projetos_definicao_responsavel'
      THEN 'sistemas_mover_aprovado_presidencia_projetos'
    WHEN OLD.etapa = 'projetos_definicao_responsavel' AND NEW.etapa = 'em_andamento'
      THEN 'sistemas_mover_projetos_em_andamento'
    WHEN OLD.etapa = 'em_andamento' AND NEW.etapa = 'validacao_presidencia'
      THEN 'sistemas_mover_em_andamento_validacao_presidencia'
    WHEN OLD.etapa = 'validacao_presidencia' AND NEW.etapa = 'teste_setor_responsavel'
      THEN 'sistemas_mover_validacao_presidencia_teste_setor'
    WHEN OLD.etapa = 'teste_setor_responsavel' AND NEW.etapa = 'treinamentos'
      THEN 'sistemas_mover_teste_setor_treinamentos'
    WHEN OLD.etapa = 'treinamentos' AND NEW.etapa = 'implantacao'
      THEN 'sistemas_mover_treinamentos_implantacao'
    ELSE NULL
  END;

  IF v_codigo IS NULL THEN
    RAISE EXCEPTION 'Transição de etapa não permitida: % → %', OLD.etapa, NEW.etapa;
  END IF;

  IF NOT public.tem_acesso_menu(v_codigo) THEN
    RAISE EXCEPTION 'Sem permissão para mover de % para %', OLD.etapa, NEW.etapa;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checar_transicao_sistema_solicitacao ON public.sistema_solicitacao;
CREATE TRIGGER trg_checar_transicao_sistema_solicitacao
  BEFORE UPDATE ON public.sistema_solicitacao
  FOR EACH ROW EXECUTE FUNCTION public.checar_transicao_sistema_solicitacao();
