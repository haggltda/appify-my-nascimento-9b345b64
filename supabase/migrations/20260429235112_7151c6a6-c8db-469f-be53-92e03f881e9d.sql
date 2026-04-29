
-- Enums RC v2
DO $$ BEGIN
  CREATE TYPE public.rc_tipo AS ENUM ('material','servico','custo_direto','administrativo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.rc_prioridade AS ENUM ('baixa','normal','alta','urgente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.rc_status_v2 AS ENUM (
    'rascunho','enviada','em_validacao_estoque','parcialmente_atendida_por_estoque',
    'aguardando_budget','bloqueada_sem_budget','aguardando_aprovacao','aprovada',
    'em_compras','pedido_gerado','parcialmente_atendida','atendida_total',
    'cancelada','rejeitada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Expandir requisicao_compra
ALTER TABLE public.requisicao_compra
  ADD COLUMN IF NOT EXISTS empresa_id uuid,
  ADD COLUMN IF NOT EXISTS solicitante_id uuid,
  ADD COLUMN IF NOT EXISTS centro_custo_id uuid,
  ADD COLUMN IF NOT EXISTS contrato_id uuid,
  ADD COLUMN IF NOT EXISTS tipo public.rc_tipo NOT NULL DEFAULT 'material',
  ADD COLUMN IF NOT EXISTS categoria_gasto text,
  ADD COLUMN IF NOT EXISTS dre_linha_id uuid,
  ADD COLUMN IF NOT EXISTS prioridade public.rc_prioridade NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS status_v2 public.rc_status_v2 NOT NULL DEFAULT 'rascunho';

UPDATE public.requisicao_compra
   SET empresa_id = (SELECT id FROM public.empresas WHERE ativa = true ORDER BY created_at LIMIT 1)
 WHERE empresa_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_rc_empresa ON public.requisicao_compra(empresa_id);
CREATE INDEX IF NOT EXISTS idx_rc_solicitante ON public.requisicao_compra(solicitante_id);
CREATE INDEX IF NOT EXISTS idx_rc_status_v2 ON public.requisicao_compra(status_v2);
CREATE INDEX IF NOT EXISTS idx_rc_contrato ON public.requisicao_compra(contrato_id);

-- Itens
CREATE TABLE IF NOT EXISTS public.requisicao_compra_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisicao_id uuid NOT NULL REFERENCES public.requisicao_compra(id) ON DELETE CASCADE,
  produto_servico_id uuid REFERENCES public.produto_servico(id),
  descricao text NOT NULL,
  unidade text NOT NULL DEFAULT 'UN',
  quantidade numeric NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  preco_estimado numeric NOT NULL DEFAULT 0 CHECK (preco_estimado >= 0),
  valor_total numeric GENERATED ALWAYS AS (quantidade * preco_estimado) STORED,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rc_item_req ON public.requisicao_compra_item(requisicao_id);

-- Histórico
CREATE TABLE IF NOT EXISTS public.requisicao_compra_status_hist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisicao_id uuid NOT NULL REFERENCES public.requisicao_compra(id) ON DELETE CASCADE,
  status_anterior public.rc_status_v2,
  status_novo public.rc_status_v2 NOT NULL,
  user_id uuid,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rc_hist_req ON public.requisicao_compra_status_hist(requisicao_id);

-- Log
CREATE TABLE IF NOT EXISTS public.requisicao_compra_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisicao_id uuid NOT NULL REFERENCES public.requisicao_compra(id) ON DELETE CASCADE,
  user_id uuid,
  evento text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rc_log_req ON public.requisicao_compra_log(requisicao_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_rc_item_updated ON public.requisicao_compra_item;
CREATE TRIGGER trg_rc_item_updated BEFORE UPDATE ON public.requisicao_compra_item
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger histórico de status
CREATE OR REPLACE FUNCTION public.rc_status_hist_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status_v2 IS DISTINCT FROM OLD.status_v2 THEN
    INSERT INTO public.requisicao_compra_status_hist (requisicao_id, status_anterior, status_novo, user_id)
    VALUES (NEW.id, OLD.status_v2, NEW.status_v2, auth.uid());
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.requisicao_compra_status_hist (requisicao_id, status_anterior, status_novo, user_id)
    VALUES (NEW.id, NULL, NEW.status_v2, auth.uid());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_rc_status_hist ON public.requisicao_compra;
CREATE TRIGGER trg_rc_status_hist
  AFTER INSERT OR UPDATE OF status_v2 ON public.requisicao_compra
  FOR EACH ROW EXECUTE FUNCTION public.rc_status_hist_trigger();

-- Trigger validações
CREATE OR REPLACE FUNCTION public.rc_validate_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status_v2 <> 'rascunho' THEN
    IF NEW.centro_custo_id IS NULL THEN
      RAISE EXCEPTION 'RC %: centro de custo é obrigatório para envio', NEW.numero;
    END IF;
    IF NEW.tipo = 'custo_direto' AND NEW.contrato_id IS NULL THEN
      RAISE EXCEPTION 'RC %: contrato é obrigatório para custo direto', NEW.numero;
    END IF;
    IF NEW.empresa_id IS NULL THEN
      RAISE EXCEPTION 'RC %: empresa é obrigatória', NEW.numero;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_rc_validate ON public.requisicao_compra;
CREATE TRIGGER trg_rc_validate
  BEFORE INSERT OR UPDATE ON public.requisicao_compra
  FOR EACH ROW EXECUTE FUNCTION public.rc_validate_trigger();

-- RLS
ALTER TABLE public.requisicao_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requisicao_compra_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requisicao_compra_status_hist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requisicao_compra_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rc_select ON public.requisicao_compra;
CREATE POLICY rc_select ON public.requisicao_compra FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid()));

DROP POLICY IF EXISTS rc_insert ON public.requisicao_compra;
CREATE POLICY rc_insert ON public.requisicao_compra FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(),'admin') OR empresa_id = get_user_empresa(auth.uid()));

DROP POLICY IF EXISTS rc_update ON public.requisicao_compra;
CREATE POLICY rc_update ON public.requisicao_compra FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(),'admin')
  OR (empresa_id = get_user_empresa(auth.uid())
      AND (solicitante_id = auth.uid()
           OR has_role(auth.uid(),'controladoria')
           OR has_role(auth.uid(),'comprador')
           OR has_role(auth.uid(),'gestor_cc')
           OR has_role(auth.uid(),'diretor_adm')
           OR has_role(auth.uid(),'diretor_op')))
);

DROP POLICY IF EXISTS rc_delete ON public.requisicao_compra;
CREATE POLICY rc_delete ON public.requisicao_compra FOR DELETE TO authenticated
USING (has_role(auth.uid(),'admin')
       OR (solicitante_id = auth.uid() AND status_v2 = 'rascunho'));

DROP POLICY IF EXISTS rci_select ON public.requisicao_compra_item;
CREATE POLICY rci_select ON public.requisicao_compra_item FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.requisicao_compra r
  WHERE r.id = requisicao_id
    AND (has_role(auth.uid(),'admin') OR r.empresa_id = get_user_empresa(auth.uid()))));

DROP POLICY IF EXISTS rci_write ON public.requisicao_compra_item;
CREATE POLICY rci_write ON public.requisicao_compra_item FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.requisicao_compra r
  WHERE r.id = requisicao_id
    AND (has_role(auth.uid(),'admin')
         OR (r.empresa_id = get_user_empresa(auth.uid())
             AND (r.solicitante_id = auth.uid()
                  OR has_role(auth.uid(),'controladoria')
                  OR has_role(auth.uid(),'comprador')
                  OR has_role(auth.uid(),'gestor_cc')
                  OR has_role(auth.uid(),'diretor_adm')
                  OR has_role(auth.uid(),'diretor_op'))))))
WITH CHECK (EXISTS (SELECT 1 FROM public.requisicao_compra r
  WHERE r.id = requisicao_id
    AND (has_role(auth.uid(),'admin')
         OR (r.empresa_id = get_user_empresa(auth.uid())
             AND (r.solicitante_id = auth.uid()
                  OR has_role(auth.uid(),'controladoria')
                  OR has_role(auth.uid(),'comprador')
                  OR has_role(auth.uid(),'gestor_cc')
                  OR has_role(auth.uid(),'diretor_adm')
                  OR has_role(auth.uid(),'diretor_op'))))));

DROP POLICY IF EXISTS rch_select ON public.requisicao_compra_status_hist;
CREATE POLICY rch_select ON public.requisicao_compra_status_hist FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.requisicao_compra r
  WHERE r.id = requisicao_id
    AND (has_role(auth.uid(),'admin') OR r.empresa_id = get_user_empresa(auth.uid()))));

DROP POLICY IF EXISTS rcl_select ON public.requisicao_compra_log;
CREATE POLICY rcl_select ON public.requisicao_compra_log FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.requisicao_compra r
  WHERE r.id = requisicao_id
    AND (has_role(auth.uid(),'admin') OR r.empresa_id = get_user_empresa(auth.uid()))));

DROP POLICY IF EXISTS rcl_insert ON public.requisicao_compra_log;
CREATE POLICY rcl_insert ON public.requisicao_compra_log FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.requisicao_compra r
  WHERE r.id = requisicao_id
    AND (has_role(auth.uid(),'admin') OR r.empresa_id = get_user_empresa(auth.uid()))));

-- Auditoria
DROP TRIGGER IF EXISTS aud_rc_item ON public.requisicao_compra_item;
CREATE TRIGGER aud_rc_item AFTER INSERT OR UPDATE OR DELETE ON public.requisicao_compra_item
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS aud_rc_log ON public.requisicao_compra_log;
CREATE TRIGGER aud_rc_log AFTER INSERT ON public.requisicao_compra_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
