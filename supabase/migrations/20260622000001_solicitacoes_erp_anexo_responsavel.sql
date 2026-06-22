-- Solicitações ERP: campo de responsável + anexos no card.
-- Responsável só pode ser definido/alterado com o card na etapa
-- "projetos_definicao_responsavel" e só por quem tem a permissão de mover
-- o card dessa etapa pra "em_andamento" (sistemas_mover_projetos_em_andamento).
-- Anexo é aberto a qualquer um que acessa a tela (sistemas_solicitacoes_erp).

-- 1) Coluna responsável -----------------------------------------------------
ALTER TABLE public.sistema_solicitacao
  ADD COLUMN IF NOT EXISTS responsavel_user_id uuid REFERENCES auth.users(id);

-- 2) Tabela de anexos --------------------------------------------------------
-- Tabela dedicada (não a genérica "anexos", que exige empresa_id NOT NULL —
-- sistema_solicitacao não é por empresa).
CREATE TABLE IF NOT EXISTS public.sistema_solicitacao_anexo (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.sistema_solicitacao(id) ON DELETE CASCADE,
  storage_path   text NOT NULL,
  nome_arquivo   text NOT NULL,
  mime_type      text,
  tamanho_bytes  bigint,
  enviado_por    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sistema_solicitacao_anexo_solicitacao ON public.sistema_solicitacao_anexo(solicitacao_id);

ALTER TABLE public.sistema_solicitacao_anexo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sistema_solicitacao_anexo_select ON public.sistema_solicitacao_anexo;
CREATE POLICY sistema_solicitacao_anexo_select ON public.sistema_solicitacao_anexo
  FOR SELECT TO authenticated
  USING (public.tem_acesso_menu('sistemas_solicitacoes_erp'));

DROP POLICY IF EXISTS sistema_solicitacao_anexo_insert ON public.sistema_solicitacao_anexo;
CREATE POLICY sistema_solicitacao_anexo_insert ON public.sistema_solicitacao_anexo
  FOR INSERT TO authenticated
  WITH CHECK (public.tem_acesso_menu('sistemas_solicitacoes_erp'));

-- 3) Bucket de storage --------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('sistema-solicitacoes', 'sistema-solicitacoes', false, 26214400) -- 25 MB
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "sistema solicitacoes anexo select" ON storage.objects;
CREATE POLICY "sistema solicitacoes anexo select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'sistema-solicitacoes' AND public.tem_acesso_menu('sistemas_solicitacoes_erp'));

DROP POLICY IF EXISTS "sistema solicitacoes anexo insert" ON storage.objects;
CREATE POLICY "sistema solicitacoes anexo insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sistema-solicitacoes' AND public.tem_acesso_menu('sistemas_solicitacoes_erp'));

-- 4) RPC pra listar usuários ativos -------------------------------------------
-- profiles só permite SELECT da própria linha (exceto admin) — esta function
-- expõe só id+display_name, pra popular o dropdown de responsável sem
-- afrouxar a RLS da tabela inteira.
CREATE OR REPLACE FUNCTION public.listar_usuarios_ativos()
RETURNS TABLE(id uuid, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT id, display_name FROM public.profiles WHERE ativo = true ORDER BY display_name;
$$;
REVOKE ALL ON FUNCTION public.listar_usuarios_ativos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_usuarios_ativos() TO authenticated;

-- 5) Estende o trigger de transição pra validar mudança de responsável -------
CREATE OR REPLACE FUNCTION public.checar_transicao_sistema_solicitacao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_codigo text;
BEGIN
  IF NEW.responsavel_user_id IS DISTINCT FROM OLD.responsavel_user_id THEN
    IF OLD.etapa <> 'projetos_definicao_responsavel'
       OR NOT public.tem_acesso_menu('sistemas_mover_projetos_em_andamento') THEN
      RAISE EXCEPTION 'Responsável só pode ser definido na etapa "Projetos e Definição de Responsável", por quem pode mover o card dessa etapa.';
    END IF;
  END IF;

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
