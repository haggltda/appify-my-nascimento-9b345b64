
-- DROP completo do scaffolding antigo
DROP TABLE IF EXISTS public.sup_aprov_voto CASCADE;
DROP TABLE IF EXISTS public.sup_aprov_instancia CASCADE;
DROP TABLE IF EXISTS public.sup_aprov_aprovador CASCADE;
DROP TABLE IF EXISTS public.sup_aprov_etapa CASCADE;
DROP TABLE IF EXISTS public.sup_aprov_fluxo CASCADE;
DROP TYPE IF EXISTS public.sup_aprov_alvo CASCADE;
DROP TYPE IF EXISTS public.sup_aprov_modo CASCADE;
DROP TYPE IF EXISTS public.sup_aprov_status CASCADE;
DROP TYPE IF EXISTS public.sup_aprov_voto_tipo CASCADE;
DROP TYPE IF EXISTS public.sup_aprov_tipo_parecer CASCADE;
DROP TYPE IF EXISTS public.sup_aprov_criticidade CASCADE;
DROP TYPE IF EXISTS public.sup_aprov_parecer CASCADE;

CREATE TYPE public.sup_aprov_alvo AS ENUM ('requisicao_compra','licitacao_etapa','programacao_pagamento');
CREATE TYPE public.sup_aprov_tipo_parecer AS ENUM ('bloqueante','consultivo','ciencia');
CREATE TYPE public.sup_aprov_status AS ENUM ('pendente','aprovado','reprovado','auto_aprovado','cancelado');
CREATE TYPE public.sup_aprov_criticidade AS ENUM ('normal','urgente','critico');
CREATE TYPE public.sup_aprov_parecer AS ENUM ('aprovado','reprovado','ciencia');

ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS diretor_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.centros_custo ADD COLUMN IF NOT EXISTS gestor_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
COMMENT ON TABLE public.alcada_aprovacao IS 'LEGADO — substituído por sup_aprov_*. Mantido somente para auditoria histórica.';

CREATE TABLE public.sup_aprov_regua_escalonamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE, descricao text, ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.sup_aprov_regua_degrau (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regua_id uuid NOT NULL REFERENCES public.sup_aprov_regua_escalonamento(id) ON DELETE CASCADE,
  ordem int NOT NULL, pct_prazo numeric, horas_extra numeric,
  destinatarios jsonb NOT NULL DEFAULT '["self"]'::jsonb,
  canais jsonb NOT NULL DEFAULT '["sininho"]'::jsonb,
  reatribui boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (regua_id, ordem)
);

CREATE TABLE public.sup_aprov_fluxo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  alvo public.sup_aprov_alvo NOT NULL, nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  regua_escalonamento_id uuid REFERENCES public.sup_aprov_regua_escalonamento(id) ON DELETE SET NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, alvo, nome)
);
CREATE INDEX idx_sup_aprov_fluxo_empresa_alvo ON public.sup_aprov_fluxo(empresa_id, alvo);

CREATE TABLE public.sup_aprov_etapa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fluxo_id uuid NOT NULL REFERENCES public.sup_aprov_fluxo(id) ON DELETE CASCADE,
  ordem int NOT NULL, nome text NOT NULL,
  tipo_parecer public.sup_aprov_tipo_parecer NOT NULL DEFAULT 'bloqueante',
  responsavel_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  delegado_para_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  delegado_ate timestamptz,
  valor_min numeric NOT NULL DEFAULT 0, valor_max numeric,
  criticidade public.sup_aprov_criticidade NOT NULL DEFAULT 'normal',
  prazo_horas int NOT NULL DEFAULT 48, regra_auto jsonb, ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fluxo_id, ordem)
);
CREATE INDEX idx_sup_aprov_etapa_resp ON public.sup_aprov_etapa(responsavel_user_id);
CREATE INDEX idx_sup_aprov_etapa_deleg ON public.sup_aprov_etapa(delegado_para_user_id);

CREATE TABLE public.sup_aprov_instancia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fluxo_id uuid NOT NULL REFERENCES public.sup_aprov_fluxo(id) ON DELETE RESTRICT,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  alvo public.sup_aprov_alvo NOT NULL,
  referencia_id uuid NOT NULL, referencia_codigo text,
  valor numeric NOT NULL DEFAULT 0,
  centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  solicitante_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status public.sup_aprov_status NOT NULL DEFAULT 'pendente',
  etapa_atual_id uuid REFERENCES public.sup_aprov_etapa(id) ON DELETE SET NULL,
  aberta_em timestamptz NOT NULL DEFAULT now(), fechada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sup_aprov_inst_alvo_ref ON public.sup_aprov_instancia(alvo, referencia_id);
CREATE INDEX idx_sup_aprov_inst_status ON public.sup_aprov_instancia(status);
CREATE INDEX idx_sup_aprov_inst_empresa ON public.sup_aprov_instancia(empresa_id);

CREATE TABLE public.sup_aprov_voto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_id uuid NOT NULL REFERENCES public.sup_aprov_instancia(id) ON DELETE CASCADE,
  etapa_id uuid NOT NULL REFERENCES public.sup_aprov_etapa(id) ON DELETE RESTRICT,
  usuario_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  parecer public.sup_aprov_parecer NOT NULL,
  justificativa text, votado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sup_aprov_voto_inst ON public.sup_aprov_voto(instancia_id);

CREATE TABLE public.sup_aprov_alerta_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_id uuid NOT NULL REFERENCES public.sup_aprov_instancia(id) ON DELETE CASCADE,
  etapa_id uuid NOT NULL REFERENCES public.sup_aprov_etapa(id) ON DELETE CASCADE,
  degrau_id uuid NOT NULL REFERENCES public.sup_aprov_regua_degrau(id) ON DELETE CASCADE,
  enviado_em timestamptz NOT NULL DEFAULT now(), destinatarios_efetivos jsonb,
  UNIQUE (instancia_id, etapa_id, degrau_id)
);

CREATE TABLE public.sup_aprov_notif_pref (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  sininho_ativo boolean NOT NULL DEFAULT true,
  email_ativo boolean NOT NULL DEFAULT true,
  push_ativo boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER tg_regua_upd BEFORE UPDATE ON public.sup_aprov_regua_escalonamento FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_fluxo_upd BEFORE UPDATE ON public.sup_aprov_fluxo FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_etapa_upd BEFORE UPDATE ON public.sup_aprov_etapa FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_inst_upd BEFORE UPDATE ON public.sup_aprov_instancia FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.sup_aprov_tem_orcamento_cc(_cc_id uuid, _valor numeric, _periodo date DEFAULT CURRENT_DATE)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _saldo numeric;
BEGIN
  IF _cc_id IS NULL THEN RETURN false; END IF;
  BEGIN
    EXECUTE 'SELECT COALESCE(saldo_disponivel,0) FROM public.orcamento_cc_saldo WHERE centro_custo_id=$1 AND periodo=date_trunc(''month'',$2)::date LIMIT 1'
      INTO _saldo USING _cc_id, _periodo;
  EXCEPTION WHEN undefined_table THEN RETURN false; END;
  RETURN COALESCE(_saldo,0) >= COALESCE(_valor,0);
END $$;

CREATE OR REPLACE FUNCTION public.sup_aprov_responsavel_efetivo(_etapa_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN e.delegado_para_user_id IS NOT NULL AND (e.delegado_ate IS NULL OR e.delegado_ate >= now())
      THEN e.delegado_para_user_id
    ELSE e.responsavel_user_id END
  FROM public.sup_aprov_etapa e WHERE e.id = _etapa_id;
$$;

CREATE OR REPLACE FUNCTION public.sup_aprov_avancar(_instancia_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inst public.sup_aprov_instancia%ROWTYPE; _proxima public.sup_aprov_etapa%ROWTYPE;
BEGIN
  SELECT * INTO _inst FROM public.sup_aprov_instancia WHERE id = _instancia_id FOR UPDATE;
  IF _inst.status <> 'pendente' THEN RETURN; END IF;
  SELECT e.* INTO _proxima FROM public.sup_aprov_etapa e
  WHERE e.fluxo_id = _inst.fluxo_id AND e.ativo AND e.tipo_parecer = 'bloqueante'
    AND COALESCE(_inst.valor,0) >= COALESCE(e.valor_min,0)
    AND (e.valor_max IS NULL OR COALESCE(_inst.valor,0) <= e.valor_max)
    AND NOT EXISTS (SELECT 1 FROM public.sup_aprov_voto v WHERE v.instancia_id=_inst.id AND v.etapa_id=e.id)
  ORDER BY e.ordem LIMIT 1;
  IF _proxima.id IS NULL THEN
    UPDATE public.sup_aprov_instancia SET status='aprovado', etapa_atual_id=NULL, fechada_em=now() WHERE id=_inst.id;
    RETURN;
  END IF;
  UPDATE public.sup_aprov_instancia SET etapa_atual_id=_proxima.id WHERE id=_inst.id;
  IF _proxima.regra_auto ? 'tipo' AND _proxima.regra_auto->>'tipo' = 'orcamento_cc' THEN
    IF public.sup_aprov_tem_orcamento_cc(_inst.centro_custo_id, _inst.valor) THEN
      INSERT INTO public.sup_aprov_voto(instancia_id, etapa_id, usuario_id, parecer, justificativa)
      VALUES (_inst.id, _proxima.id, COALESCE(_inst.solicitante_user_id, _proxima.responsavel_user_id),
              'aprovado', 'Auto-aprovado: orçamento do CC disponível.');
      PERFORM public.sup_aprov_avancar(_inst.id);
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sup_aprov_abrir_instancia(
  _fluxo_id uuid, _ref_id uuid, _ref_codigo text, _valor numeric, _cc_id uuid, _solicitante uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _empresa uuid; _alvo public.sup_aprov_alvo;
BEGIN
  SELECT empresa_id, alvo INTO _empresa, _alvo FROM public.sup_aprov_fluxo WHERE id = _fluxo_id AND ativo;
  IF _empresa IS NULL THEN RAISE EXCEPTION 'Fluxo inativo ou inexistente'; END IF;
  INSERT INTO public.sup_aprov_instancia(fluxo_id, empresa_id, alvo, referencia_id, referencia_codigo, valor, centro_custo_id, solicitante_user_id)
  VALUES (_fluxo_id, _empresa, _alvo, _ref_id, _ref_codigo, COALESCE(_valor,0), _cc_id, _solicitante)
  RETURNING id INTO _id;
  INSERT INTO public.sup_aprov_voto(instancia_id, etapa_id, usuario_id, parecer)
  SELECT _id, e.id, COALESCE(_solicitante, e.responsavel_user_id), 'ciencia'
  FROM public.sup_aprov_etapa e
  WHERE e.fluxo_id = _fluxo_id AND e.ativo AND e.tipo_parecer = 'ciencia'
    AND COALESCE(_valor,0) >= COALESCE(e.valor_min,0)
    AND (e.valor_max IS NULL OR COALESCE(_valor,0) <= e.valor_max);
  PERFORM public.sup_aprov_avancar(_id);
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.sup_aprov_registrar_voto(
  _instancia_id uuid, _etapa_id uuid, _parecer public.sup_aprov_parecer, _justificativa text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _resp uuid; _tipo public.sup_aprov_tipo_parecer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT tipo_parecer, public.sup_aprov_responsavel_efetivo(id) INTO _tipo, _resp
    FROM public.sup_aprov_etapa WHERE id = _etapa_id AND ativo;
  IF _resp IS NULL THEN RAISE EXCEPTION 'Etapa não encontrada'; END IF;
  IF _resp <> _uid AND NOT public.has_role(_uid,'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar esta etapa';
  END IF;
  IF _parecer = 'reprovado' AND (_justificativa IS NULL OR length(trim(_justificativa)) = 0) THEN
    RAISE EXCEPTION 'Justificativa obrigatória para reprovar';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sup_aprov_voto WHERE instancia_id=_instancia_id AND etapa_id=_etapa_id AND usuario_id=_uid) THEN
    RAISE EXCEPTION 'Voto já registrado';
  END IF;
  INSERT INTO public.sup_aprov_voto(instancia_id, etapa_id, usuario_id, parecer, justificativa)
  VALUES (_instancia_id, _etapa_id, _uid, _parecer, _justificativa);
  IF _tipo = 'bloqueante' THEN
    IF _parecer = 'reprovado' THEN
      UPDATE public.sup_aprov_instancia SET status='reprovado', etapa_atual_id=NULL, fechada_em=now() WHERE id=_instancia_id;
    ELSE
      PERFORM public.sup_aprov_avancar(_instancia_id);
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sup_aprov_pendentes_do_usuario(_uid uuid DEFAULT auth.uid())
RETURNS TABLE (
  instancia_id uuid, empresa_id uuid, alvo public.sup_aprov_alvo,
  referencia_codigo text, valor numeric, etapa_id uuid, etapa_nome text,
  tipo_parecer public.sup_aprov_tipo_parecer, criticidade public.sup_aprov_criticidade,
  prazo_horas int, aberta_em timestamptz, horas_paradas numeric
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.empresa_id, i.alvo, i.referencia_codigo, i.valor,
         e.id, e.nome, e.tipo_parecer, e.criticidade, e.prazo_horas,
         i.aberta_em, EXTRACT(EPOCH FROM (now() - i.aberta_em))/3600.0
  FROM public.sup_aprov_instancia i
  JOIN public.sup_aprov_etapa e ON e.id = i.etapa_atual_id
  WHERE i.status = 'pendente'
    AND public.sup_aprov_responsavel_efetivo(e.id) = _uid
    AND NOT EXISTS (SELECT 1 FROM public.sup_aprov_voto v WHERE v.instancia_id=i.id AND v.etapa_id=e.id AND v.usuario_id=_uid);
$$;

ALTER TABLE public.sup_aprov_regua_escalonamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sup_aprov_regua_degrau        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sup_aprov_fluxo               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sup_aprov_etapa               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sup_aprov_instancia           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sup_aprov_voto                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sup_aprov_alerta_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sup_aprov_notif_pref          ENABLE ROW LEVEL SECURITY;

CREATE POLICY "regua_read_auth" ON public.sup_aprov_regua_escalonamento FOR SELECT TO authenticated USING (true);
CREATE POLICY "regua_admin_write" ON public.sup_aprov_regua_escalonamento FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "regua_deg_read_auth" ON public.sup_aprov_regua_degrau FOR SELECT TO authenticated USING (true);
CREATE POLICY "regua_deg_admin_write" ON public.sup_aprov_regua_degrau FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "fluxo_read_empresa" ON public.sup_aprov_fluxo FOR SELECT TO authenticated USING (public.user_can_see_empresa(empresa_id));
CREATE POLICY "fluxo_admin_write" ON public.sup_aprov_fluxo FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "etapa_read_empresa" ON public.sup_aprov_etapa FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.sup_aprov_fluxo f WHERE f.id = fluxo_id AND public.user_can_see_empresa(f.empresa_id))
);
CREATE POLICY "etapa_admin_write" ON public.sup_aprov_etapa FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "inst_read" ON public.sup_aprov_instancia FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin'::public.app_role)
  OR solicitante_user_id = auth.uid()
  OR public.user_can_see_empresa(empresa_id)
);
CREATE POLICY "inst_insert" ON public.sup_aprov_instancia FOR INSERT TO authenticated
  WITH CHECK (public.user_can_see_empresa(empresa_id));
CREATE POLICY "inst_update_admin" ON public.sup_aprov_instancia FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "voto_read" ON public.sup_aprov_voto FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.sup_aprov_instancia i WHERE i.id=instancia_id AND public.user_can_see_empresa(i.empresa_id))
);
CREATE POLICY "alerta_read_admin" ON public.sup_aprov_alerta_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "notifpref_self" ON public.sup_aprov_notif_pref FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Seed
DO $$
DECLARE _regua_id uuid; _row record; _fluxo_id uuid; _existing uuid;
BEGIN
  INSERT INTO public.sup_aprov_regua_escalonamento (nome, descricao)
  VALUES ('Normal', 'Régua padrão: 50% → self, 100% → +gestor, +24h → +diretor, +48h → +presidência')
  ON CONFLICT (nome) DO NOTHING;
  SELECT id INTO _regua_id FROM public.sup_aprov_regua_escalonamento WHERE nome='Normal';
  INSERT INTO public.sup_aprov_regua_degrau (regua_id, ordem, pct_prazo, horas_extra, destinatarios, canais) VALUES
    (_regua_id, 1, 50,   NULL, '["self"]'::jsonb, '["sininho"]'::jsonb),
    (_regua_id, 2, 100,  NULL, '["self","gestor"]'::jsonb, '["sininho","email"]'::jsonb),
    (_regua_id, 3, NULL, 24,   '["self","gestor","diretor"]'::jsonb, '["sininho","email"]'::jsonb),
    (_regua_id, 4, NULL, 48,   '["self","gestor","diretor","presidencia"]'::jsonb, '["sininho","email","push"]'::jsonb)
  ON CONFLICT (regua_id, ordem) DO NOTHING;
  FOR _row IN SELECT * FROM public.alcada_aprovacao WHERE ativo LOOP
    SELECT id INTO _existing FROM public.sup_aprov_fluxo
      WHERE empresa_id=_row.empresa_id AND alvo='programacao_pagamento'
        AND nome='Aprovação ' || _row.etapa || ' (migrado)';
    IF _existing IS NULL THEN
      INSERT INTO public.sup_aprov_fluxo (empresa_id, alvo, nome, regua_escalonamento_id, observacao)
      VALUES (_row.empresa_id, 'programacao_pagamento', 'Aprovação ' || _row.etapa || ' (migrado)',
              _regua_id, 'Migrado de alcada_aprovacao.id=' || _row.id::text)
      RETURNING id INTO _fluxo_id;
      INSERT INTO public.sup_aprov_etapa (fluxo_id, ordem, nome, tipo_parecer, responsavel_user_id, valor_min, valor_max, criticidade, prazo_horas)
      VALUES (_fluxo_id, 1, _row.etapa, 'bloqueante', _row.responsavel_user_id, 0, _row.valor_max, 'normal', 48);
    END IF;
  END LOOP;
END $$;
