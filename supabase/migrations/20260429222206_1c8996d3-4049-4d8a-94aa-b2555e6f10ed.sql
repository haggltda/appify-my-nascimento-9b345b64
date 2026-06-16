
-- Enums
DO $$ BEGIN
  CREATE TYPE public.pcs_tipo AS ENUM ('criar','alterar','inativar');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pcs_status AS ENUM ('pendente','aprovada','rejeitada','aplicada','erro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela
CREATE TABLE IF NOT EXISTS public.plano_contas_solicitacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  tipo public.pcs_tipo NOT NULL,
  status public.pcs_status NOT NULL DEFAULT 'pendente',

  -- Alvo (para alterar/inativar)
  conta_contabil_id uuid REFERENCES public.conta_contabil(id) ON DELETE SET NULL,

  -- Proposta
  classificacao text,
  descricao text,
  tipo_conta public.conta_tipo,
  natureza public.conta_natureza,
  exige_contrato public.conta_exige_contrato,
  centro_custo_padrao text,
  entra_fluxo boolean,
  entra_orcamento boolean,
  parent_classificacao text,
  dre_linha_id uuid REFERENCES public.dre_linhas(id),
  grupo_dre public.conta_grupo_dre,
  ativo boolean,

  justificativa text NOT NULL,
  motivo_decisao text,

  solicitado_por uuid NOT NULL DEFAULT auth.uid(),
  solicitado_em timestamptz NOT NULL DEFAULT now(),
  decidido_por uuid,
  decidido_em timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pcs_empresa_status ON public.plano_contas_solicitacao(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_pcs_solicitante ON public.plano_contas_solicitacao(solicitado_por);

-- updated_at
DROP TRIGGER IF EXISTS trg_pcs_updated_at ON public.plano_contas_solicitacao;
CREATE TRIGGER trg_pcs_updated_at
  BEFORE UPDATE ON public.plano_contas_solicitacao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.plano_contas_solicitacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pcs_select ON public.plano_contas_solicitacao;
CREATE POLICY pcs_select ON public.plano_contas_solicitacao
  FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS pcs_insert ON public.plano_contas_solicitacao;
CREATE POLICY pcs_insert ON public.plano_contas_solicitacao
  FOR INSERT TO authenticated
  WITH CHECK (
    solicitado_por = auth.uid()
    AND (empresa_id = get_user_empresa(auth.uid()) OR has_role(auth.uid(),'admin'))
    AND status = 'pendente'
  );

-- Solicitante pode editar/cancelar a própria enquanto pendente
DROP POLICY IF EXISTS pcs_update_owner ON public.plano_contas_solicitacao;
CREATE POLICY pcs_update_owner ON public.plano_contas_solicitacao
  FOR UPDATE TO authenticated
  USING (solicitado_por = auth.uid() AND status = 'pendente')
  WITH CHECK (solicitado_por = auth.uid());

-- Aprovadores: admin, controladoria, diretor_adm
DROP POLICY IF EXISTS pcs_update_approver ON public.plano_contas_solicitacao;
CREATE POLICY pcs_update_approver ON public.plano_contas_solicitacao
  FOR UPDATE TO authenticated
  USING (
    (has_role(auth.uid(),'admin')
     OR has_role(auth.uid(),'controladoria')
     OR has_role(auth.uid(),'diretor_adm'))
    AND (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid()))
  )
  WITH CHECK (
    has_role(auth.uid(),'admin')
    OR has_role(auth.uid(),'controladoria')
    OR has_role(auth.uid(),'diretor_adm')
  );

DROP POLICY IF EXISTS pcs_delete ON public.plano_contas_solicitacao;
CREATE POLICY pcs_delete ON public.plano_contas_solicitacao
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));

-- Função aplicadora (executa a mudança na conta_contabil quando aprovada)
CREATE OR REPLACE FUNCTION public.pcs_apply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id uuid;
  v_new_id uuid;
  v_max_red integer;
BEGIN
  -- Só age quando muda para 'aprovada'
  IF NEW.status <> 'aprovada' OR OLD.status = 'aprovada' THEN
    RETURN NEW;
  END IF;

  -- Confere se quem aprovou tem role
  IF NOT (has_role(auth.uid(),'admin')
          OR has_role(auth.uid(),'controladoria')
          OR has_role(auth.uid(),'diretor_adm')) THEN
    RAISE EXCEPTION 'Apenas admin, controladoria ou diretor administrativo podem aprovar';
  END IF;

  NEW.decidido_por := auth.uid();
  NEW.decidido_em := now();

  IF NEW.tipo = 'criar' THEN
    IF NEW.classificacao IS NULL OR NEW.descricao IS NULL OR NEW.tipo_conta IS NULL OR NEW.natureza IS NULL THEN
      RAISE EXCEPTION 'Solicitação de criação incompleta';
    END IF;
    IF EXISTS (SELECT 1 FROM conta_contabil
               WHERE empresa_id = NEW.empresa_id AND classificacao = NEW.classificacao) THEN
      RAISE EXCEPTION 'Classificação % já existe nesta empresa', NEW.classificacao;
    END IF;
    IF NEW.parent_classificacao IS NOT NULL THEN
      SELECT id INTO v_parent_id FROM conta_contabil
       WHERE empresa_id = NEW.empresa_id AND classificacao = NEW.parent_classificacao;
      IF v_parent_id IS NULL THEN
        RAISE EXCEPTION 'Conta pai % não encontrada na empresa', NEW.parent_classificacao;
      END IF;
    END IF;

    SELECT COALESCE(MAX(conta_reduzida),0)+1 INTO v_max_red
      FROM conta_contabil WHERE empresa_id = NEW.empresa_id;

    INSERT INTO conta_contabil
      (empresa_id, conta_reduzida, classificacao, descricao, tipo, natureza,
       exige_contrato, centro_custo_padrao, entra_fluxo, entra_orcamento,
       parent_id, dre_linha_id, grupo_dre, ativo)
    VALUES
      (NEW.empresa_id, v_max_red, NEW.classificacao, NEW.descricao, NEW.tipo_conta, NEW.natureza,
       COALESCE(NEW.exige_contrato,'nao'), NEW.centro_custo_padrao,
       COALESCE(NEW.entra_fluxo,false), COALESCE(NEW.entra_orcamento,false),
       v_parent_id, NEW.dre_linha_id, COALESCE(NEW.grupo_dre,'balanco'),
       COALESCE(NEW.ativo,true))
    RETURNING id INTO v_new_id;

    NEW.conta_contabil_id := v_new_id;

  ELSIF NEW.tipo = 'alterar' THEN
    IF NEW.conta_contabil_id IS NULL THEN
      RAISE EXCEPTION 'Solicitação de alteração sem conta alvo';
    END IF;
    IF NEW.parent_classificacao IS NOT NULL THEN
      SELECT id INTO v_parent_id FROM conta_contabil
       WHERE empresa_id = NEW.empresa_id AND classificacao = NEW.parent_classificacao;
    END IF;
    UPDATE conta_contabil SET
      descricao            = COALESCE(NEW.descricao, descricao),
      tipo                 = COALESCE(NEW.tipo_conta, tipo),
      natureza             = COALESCE(NEW.natureza, natureza),
      exige_contrato       = COALESCE(NEW.exige_contrato, exige_contrato),
      centro_custo_padrao  = COALESCE(NEW.centro_custo_padrao, centro_custo_padrao),
      entra_fluxo          = COALESCE(NEW.entra_fluxo, entra_fluxo),
      entra_orcamento      = COALESCE(NEW.entra_orcamento, entra_orcamento),
      parent_id            = COALESCE(v_parent_id, parent_id),
      dre_linha_id         = COALESCE(NEW.dre_linha_id, dre_linha_id),
      grupo_dre            = COALESCE(NEW.grupo_dre, grupo_dre),
      ativo                = COALESCE(NEW.ativo, ativo)
    WHERE id = NEW.conta_contabil_id AND empresa_id = NEW.empresa_id;

  ELSIF NEW.tipo = 'inativar' THEN
    IF NEW.conta_contabil_id IS NULL THEN
      RAISE EXCEPTION 'Solicitação de inativação sem conta alvo';
    END IF;
    UPDATE conta_contabil SET ativo = false
     WHERE id = NEW.conta_contabil_id AND empresa_id = NEW.empresa_id;
  END IF;

  NEW.status := 'aplicada';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pcs_apply ON public.plano_contas_solicitacao;
CREATE TRIGGER trg_pcs_apply
  BEFORE UPDATE ON public.plano_contas_solicitacao
  FOR EACH ROW
  WHEN (NEW.status = 'aprovada' AND OLD.status IS DISTINCT FROM 'aprovada')
  EXECUTE FUNCTION public.pcs_apply();

-- Auditoria
DROP TRIGGER IF EXISTS trg_pcs_audit ON public.plano_contas_solicitacao;
CREATE TRIGGER trg_pcs_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.plano_contas_solicitacao
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
