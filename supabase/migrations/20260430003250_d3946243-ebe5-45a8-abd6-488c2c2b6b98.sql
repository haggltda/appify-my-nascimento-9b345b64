DO $$ BEGIN CREATE TYPE public.sup_aprov_alvo AS ENUM ('rc','pc'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.sup_aprov_modo AS ENUM ('todos','qualquer','quorum'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.sup_aprov_status AS ENUM ('aberta','aprovada','rejeitada','cancelada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.sup_aprov_voto_tipo AS ENUM ('aprovado','rejeitado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.nf_origem AS ENUM ('xml','manual'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.sup_aprov_fluxo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  alvo public.sup_aprov_alvo NOT NULL,
  nome text NOT NULL,
  valor_min numeric(15,2) NOT NULL DEFAULT 0,
  valor_max numeric(15,2),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX IF NOT EXISTS idx_sup_aprov_fluxo_empresa ON public.sup_aprov_fluxo(empresa_id, alvo, ativo);

CREATE TABLE IF NOT EXISTS public.sup_aprov_etapa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fluxo_id uuid NOT NULL REFERENCES public.sup_aprov_fluxo(id) ON DELETE CASCADE,
  ordem int NOT NULL,
  nome text NOT NULL,
  modo public.sup_aprov_modo NOT NULL DEFAULT 'qualquer',
  quorum_minimo int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(fluxo_id, ordem),
  CHECK (modo <> 'quorum' OR (quorum_minimo IS NOT NULL AND quorum_minimo > 0))
);

CREATE TABLE IF NOT EXISTS public.sup_aprov_aprovador (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etapa_id uuid NOT NULL REFERENCES public.sup_aprov_etapa(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR role IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_sup_aprov_aprovador_etapa ON public.sup_aprov_aprovador(etapa_id);

CREATE TABLE IF NOT EXISTS public.sup_aprov_instancia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  fluxo_id uuid NOT NULL REFERENCES public.sup_aprov_fluxo(id),
  alvo public.sup_aprov_alvo NOT NULL,
  rc_id uuid REFERENCES public.requisicao_compra(id) ON DELETE CASCADE,
  pc_id uuid REFERENCES public.pedido_compra(id) ON DELETE CASCADE,
  etapa_atual_id uuid REFERENCES public.sup_aprov_etapa(id),
  status public.sup_aprov_status NOT NULL DEFAULT 'aberta',
  iniciado_por uuid,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz,
  observacoes text,
  CHECK ( (alvo='rc' AND rc_id IS NOT NULL AND pc_id IS NULL) OR
          (alvo='pc' AND pc_id IS NOT NULL AND rc_id IS NULL) )
);
CREATE INDEX IF NOT EXISTS idx_sup_aprov_inst_empresa ON public.sup_aprov_instancia(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_sup_aprov_inst_rc ON public.sup_aprov_instancia(rc_id);
CREATE INDEX IF NOT EXISTS idx_sup_aprov_inst_pc ON public.sup_aprov_instancia(pc_id);

CREATE TABLE IF NOT EXISTS public.sup_aprov_voto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_id uuid NOT NULL REFERENCES public.sup_aprov_instancia(id) ON DELETE CASCADE,
  etapa_id uuid NOT NULL REFERENCES public.sup_aprov_etapa(id),
  user_id uuid NOT NULL,
  voto public.sup_aprov_voto_tipo NOT NULL,
  comentario text,
  votado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(instancia_id, etapa_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_sup_aprov_voto_inst ON public.sup_aprov_voto(instancia_id, etapa_id);

DROP TRIGGER IF EXISTS trg_sup_aprov_fluxo_upd ON public.sup_aprov_fluxo;
CREATE TRIGGER trg_sup_aprov_fluxo_upd BEFORE UPDATE ON public.sup_aprov_fluxo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.sup_aprov_avaliar_etapa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $func$
DECLARE
  v_inst RECORD; v_etapa RECORD;
  v_total int; v_aprovados int; v_rejeitados int;
  v_proxima RECORD;
BEGIN
  SELECT * INTO v_inst FROM sup_aprov_instancia WHERE id = NEW.instancia_id;
  IF v_inst.status <> 'aberta' THEN RAISE EXCEPTION 'Instancia nao esta aberta'; END IF;
  SELECT * INTO v_etapa FROM sup_aprov_etapa WHERE id = NEW.etapa_id;

  SELECT COUNT(DISTINCT u) INTO v_total FROM (
    SELECT a.user_id AS u FROM sup_aprov_aprovador a WHERE a.etapa_id=v_etapa.id AND a.user_id IS NOT NULL
    UNION
    SELECT ur.user_id FROM sup_aprov_aprovador a JOIN user_roles ur ON ur.role=a.role
      WHERE a.etapa_id=v_etapa.id AND a.role IS NOT NULL
  ) sub;

  SELECT COUNT(*) FILTER (WHERE voto='aprovado'), COUNT(*) FILTER (WHERE voto='rejeitado')
    INTO v_aprovados, v_rejeitados
    FROM sup_aprov_voto WHERE instancia_id=NEW.instancia_id AND etapa_id=NEW.etapa_id;

  IF v_rejeitados > 0 AND v_etapa.modo IN ('todos','quorum') THEN
    UPDATE sup_aprov_instancia SET status='rejeitada', finalizado_em=now() WHERE id=v_inst.id;
    RETURN NEW;
  END IF;

  IF (v_etapa.modo='qualquer' AND v_aprovados>=1)
     OR (v_etapa.modo='todos' AND v_aprovados>=v_total AND v_total>0)
     OR (v_etapa.modo='quorum' AND v_aprovados>=COALESCE(v_etapa.quorum_minimo,1)) THEN
    SELECT * INTO v_proxima FROM sup_aprov_etapa
      WHERE fluxo_id=v_inst.fluxo_id AND ordem>v_etapa.ordem ORDER BY ordem ASC LIMIT 1;
    IF v_proxima.id IS NOT NULL THEN
      UPDATE sup_aprov_instancia SET etapa_atual_id=v_proxima.id WHERE id=v_inst.id;
    ELSE
      UPDATE sup_aprov_instancia SET status='aprovada', finalizado_em=now() WHERE id=v_inst.id;
    END IF;
  END IF;
  RETURN NEW;
END $func$;

DROP TRIGGER IF EXISTS trg_sup_aprov_avaliar ON public.sup_aprov_voto;
CREATE TRIGGER trg_sup_aprov_avaliar AFTER INSERT ON public.sup_aprov_voto
  FOR EACH ROW EXECUTE FUNCTION public.sup_aprov_avaliar_etapa();

ALTER TABLE public.sup_aprov_fluxo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sup_aprov_etapa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sup_aprov_aprovador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sup_aprov_instancia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sup_aprov_voto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fluxo_select" ON public.sup_aprov_fluxo FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR empresa_id=get_user_empresa(auth.uid()));
CREATE POLICY "fluxo_admin_all" ON public.sup_aprov_fluxo FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR (has_role(auth.uid(),'controladoria') AND empresa_id=get_user_empresa(auth.uid())))
  WITH CHECK (has_role(auth.uid(),'admin') OR (has_role(auth.uid(),'controladoria') AND empresa_id=get_user_empresa(auth.uid())));

CREATE POLICY "etapa_select" ON public.sup_aprov_etapa FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM sup_aprov_fluxo f WHERE f.id=fluxo_id
    AND (has_role(auth.uid(),'admin') OR f.empresa_id=get_user_empresa(auth.uid()))));
CREATE POLICY "etapa_admin_all" ON public.sup_aprov_etapa FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM sup_aprov_fluxo f WHERE f.id=fluxo_id
    AND (has_role(auth.uid(),'admin') OR (has_role(auth.uid(),'controladoria') AND f.empresa_id=get_user_empresa(auth.uid())))))
  WITH CHECK (EXISTS (SELECT 1 FROM sup_aprov_fluxo f WHERE f.id=fluxo_id
    AND (has_role(auth.uid(),'admin') OR (has_role(auth.uid(),'controladoria') AND f.empresa_id=get_user_empresa(auth.uid())))));

CREATE POLICY "aprovador_select" ON public.sup_aprov_aprovador FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM sup_aprov_etapa e JOIN sup_aprov_fluxo f ON f.id=e.fluxo_id
    WHERE e.id=etapa_id AND (has_role(auth.uid(),'admin') OR f.empresa_id=get_user_empresa(auth.uid()))));
CREATE POLICY "aprovador_admin_all" ON public.sup_aprov_aprovador FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM sup_aprov_etapa e JOIN sup_aprov_fluxo f ON f.id=e.fluxo_id
    WHERE e.id=etapa_id AND (has_role(auth.uid(),'admin') OR (has_role(auth.uid(),'controladoria') AND f.empresa_id=get_user_empresa(auth.uid())))))
  WITH CHECK (EXISTS (SELECT 1 FROM sup_aprov_etapa e JOIN sup_aprov_fluxo f ON f.id=e.fluxo_id
    WHERE e.id=etapa_id AND (has_role(auth.uid(),'admin') OR (has_role(auth.uid(),'controladoria') AND f.empresa_id=get_user_empresa(auth.uid())))));

CREATE POLICY "inst_select" ON public.sup_aprov_instancia FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR empresa_id=get_user_empresa(auth.uid()));
CREATE POLICY "inst_insert" ON public.sup_aprov_instancia FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR
    ((has_role(auth.uid(),'comprador') OR has_role(auth.uid(),'controladoria') OR has_role(auth.uid(),'gestor_cc'))
      AND empresa_id=get_user_empresa(auth.uid())));
CREATE POLICY "inst_admin_update" ON public.sup_aprov_instancia FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR (has_role(auth.uid(),'controladoria') AND empresa_id=get_user_empresa(auth.uid())));

CREATE POLICY "voto_select" ON public.sup_aprov_voto FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM sup_aprov_instancia i WHERE i.id=instancia_id
    AND (has_role(auth.uid(),'admin') OR i.empresa_id=get_user_empresa(auth.uid()))));
CREATE POLICY "voto_insert" ON public.sup_aprov_voto FOR INSERT TO authenticated
  WITH CHECK (
    user_id=auth.uid()
    AND EXISTS (SELECT 1 FROM sup_aprov_instancia i WHERE i.id=instancia_id
      AND i.status='aberta' AND i.etapa_atual_id=sup_aprov_voto.etapa_id)
    AND EXISTS (SELECT 1 FROM sup_aprov_aprovador a WHERE a.etapa_id=sup_aprov_voto.etapa_id
      AND (a.user_id=auth.uid() OR (a.role IS NOT NULL AND has_role(auth.uid(),a.role))))
  );

ALTER TABLE public.nf_entrada
  ADD COLUMN IF NOT EXISTS origem public.nf_origem NOT NULL DEFAULT 'xml',
  ADD COLUMN IF NOT EXISTS pedido_compra_id uuid REFERENCES public.pedido_compra(id),
  ADD COLUMN IF NOT EXISTS lancada_manualmente_por uuid;

CREATE INDEX IF NOT EXISTS idx_nf_entrada_pc ON public.nf_entrada(pedido_compra_id);

CREATE OR REPLACE FUNCTION public.nf_entrada_validar_manual()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $func$
DECLARE v_pc_status text;
BEGIN
  IF NEW.origem = 'manual' THEN
    IF NEW.pedido_compra_id IS NULL THEN
      RAISE EXCEPTION 'NF manual exige vinculo com Pedido de Compra (PC)';
    END IF;
    SELECT status INTO v_pc_status FROM pedido_compra WHERE id = NEW.pedido_compra_id;
    IF v_pc_status IS NULL THEN RAISE EXCEPTION 'PC vinculado nao encontrado'; END IF;
    IF v_pc_status NOT IN ('aprovado','enviado','recebido_parcial','recebido_total') THEN
      RAISE EXCEPTION 'PC % nao esta aprovado (status: %)', NEW.pedido_compra_id, v_pc_status;
    END IF;
    IF TG_OP='INSERT' AND NEW.lancada_manualmente_por IS NULL THEN
      NEW.lancada_manualmente_por := auth.uid();
    END IF;
    IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'comprador')
         OR has_role(auth.uid(),'almoxarife') OR has_role(auth.uid(),'controladoria')) THEN
      RAISE EXCEPTION 'Sem permissao para lancar NF manualmente';
    END IF;
  END IF;
  RETURN NEW;
END $func$;

DROP TRIGGER IF EXISTS trg_nf_entrada_validar_manual ON public.nf_entrada;
CREATE TRIGGER trg_nf_entrada_validar_manual
  BEFORE INSERT OR UPDATE ON public.nf_entrada
  FOR EACH ROW EXECUTE FUNCTION public.nf_entrada_validar_manual();