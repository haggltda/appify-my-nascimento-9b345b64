
-- M1
DO $$ BEGIN CREATE TYPE public.programacao_prioridade AS ENUM ('baixa','normal','alta','emergencial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.programacao_aprovacao_status AS ENUM ('nao_submetida','pendente','aprovada','reprovada','devolvida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.malote_pagamento
  ADD COLUMN IF NOT EXISTS prioridade public.programacao_prioridade NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS urgencia boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS excecao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS justificativa text,
  ADD COLUMN IF NOT EXISTS periodo_inicio date,
  ADD COLUMN IF NOT EXISTS periodo_fim date,
  ADD COLUMN IF NOT EXISTS observacao text,
  ADD COLUMN IF NOT EXISTS enviado_aprovacao_por uuid,
  ADD COLUMN IF NOT EXISTS enviado_aprovacao_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovacao_status public.programacao_aprovacao_status NOT NULL DEFAULT 'nao_submetida',
  ADD COLUMN IF NOT EXISTS reaberto boolean NOT NULL DEFAULT false;

ALTER TABLE public.malote_titulo
  ADD COLUMN IF NOT EXISTS valor_programado numeric,
  ADD COLUMN IF NOT EXISTS prioridade public.programacao_prioridade NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS motivo_bloqueio text,
  ADD COLUMN IF NOT EXISTS observacao text;

-- M2
CREATE TABLE IF NOT EXISTS public.financeiro_pagamento_aprovacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  programacao_id uuid NOT NULL REFERENCES public.malote_pagamento(id) ON DELETE CASCADE,
  etapa integer NOT NULL DEFAULT 1,
  aprovador_id uuid,
  decisao public.aprov_decisao NOT NULL DEFAULT 'pendente',
  justificativa text,
  valor_aprovado numeric,
  data_pagamento_aprovada date,
  decidido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fpa_programacao ON public.financeiro_pagamento_aprovacao(programacao_id);
CREATE INDEX IF NOT EXISTS idx_fpa_empresa_status ON public.financeiro_pagamento_aprovacao(empresa_id, decisao);
ALTER TABLE public.financeiro_pagamento_aprovacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fpa_select" ON public.financeiro_pagamento_aprovacao FOR SELECT
USING (public.has_role(auth.uid(),'admin') OR ((public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm')) AND empresa_id = public.get_user_empresa(auth.uid())));
CREATE POLICY "fpa_insert" ON public.financeiro_pagamento_aprovacao FOR INSERT
WITH CHECK (public.has_role(auth.uid(),'admin') OR ((public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'diretor_adm')) AND empresa_id = public.get_user_empresa(auth.uid())));
CREATE POLICY "fpa_update" ON public.financeiro_pagamento_aprovacao FOR UPDATE
USING (public.has_role(auth.uid(),'admin') OR ((public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'diretor_adm')) AND empresa_id = public.get_user_empresa(auth.uid())));

-- M3
DO $$ BEGIN CREATE TYPE public.validacao_status AS ENUM ('pendente','conferido','divergente','pendente_comprovante','pendente_baixa','pendente_conciliacao','conciliado','arquivado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.financeiro_pagamento_validacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  titulo_pagar_id uuid NOT NULL REFERENCES public.titulo_pagar(id) ON DELETE CASCADE,
  programacao_id uuid REFERENCES public.malote_pagamento(id) ON DELETE SET NULL,
  movimento_bancario_id uuid REFERENCES public.movimento_bancario(id) ON DELETE SET NULL,
  valor_aprovado numeric, valor_pago numeric,
  data_programada date, data_paga date,
  fornecedor_confere boolean DEFAULT false,
  valor_confere boolean DEFAULT false,
  data_confere boolean DEFAULT false,
  conta_bancaria_confere boolean DEFAULT false,
  comprovante_anexado boolean DEFAULT false,
  baixa_confirmada boolean DEFAULT false,
  status_validacao public.validacao_status NOT NULL DEFAULT 'pendente',
  status_conciliacao text,
  divergencia text, tratativa text,
  validado_por uuid, validado_em timestamptz,
  revisado_por uuid, revisado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (titulo_pagar_id)
);
CREATE INDEX IF NOT EXISTS idx_fpv_empresa_status ON public.financeiro_pagamento_validacao(empresa_id, status_validacao);
CREATE INDEX IF NOT EXISTS idx_fpv_programacao ON public.financeiro_pagamento_validacao(programacao_id);
ALTER TABLE public.financeiro_pagamento_validacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fpv_select" ON public.financeiro_pagamento_validacao FOR SELECT
USING (public.has_role(auth.uid(),'admin') OR ((public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm')) AND empresa_id = public.get_user_empresa(auth.uid())));
CREATE POLICY "fpv_insert" ON public.financeiro_pagamento_validacao FOR INSERT
WITH CHECK (public.has_role(auth.uid(),'admin') OR ((public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm')) AND empresa_id = public.get_user_empresa(auth.uid())));
CREATE POLICY "fpv_update" ON public.financeiro_pagamento_validacao FOR UPDATE
USING (public.has_role(auth.uid(),'admin') OR ((public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm')) AND empresa_id = public.get_user_empresa(auth.uid())));

-- M4
CREATE TABLE IF NOT EXISTS public.financeiro_pagamento_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  programacao_id uuid, titulo_pagar_id uuid,
  acao text NOT NULL, detalhes jsonb, usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fpl_programacao ON public.financeiro_pagamento_log(programacao_id);
CREATE INDEX IF NOT EXISTS idx_fpl_empresa_data ON public.financeiro_pagamento_log(empresa_id, created_at DESC);
ALTER TABLE public.financeiro_pagamento_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fpl_select" ON public.financeiro_pagamento_log FOR SELECT
USING (public.has_role(auth.uid(),'admin') OR ((public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm')) AND empresa_id = public.get_user_empresa(auth.uid())));
CREATE POLICY "fpl_insert" ON public.financeiro_pagamento_log FOR INSERT
WITH CHECK (public.has_role(auth.uid(),'admin') OR ((public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'controladoria') OR public.has_role(auth.uid(),'diretor_adm')) AND empresa_id = public.get_user_empresa(auth.uid())));

DROP TRIGGER IF EXISTS trg_fpa_updated ON public.financeiro_pagamento_aprovacao;
CREATE TRIGGER trg_fpa_updated BEFORE UPDATE ON public.financeiro_pagamento_aprovacao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_fpv_updated ON public.financeiro_pagamento_validacao;
CREATE TRIGGER trg_fpv_updated BEFORE UPDATE ON public.financeiro_pagamento_validacao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- M5: RPCs
CREATE OR REPLACE FUNCTION public.programacao_submeter_aprovacao(p_programacao_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_emp uuid; v_valor numeric; v_qtd int; v_data date; v_apr_id uuid;
BEGIN
  SELECT empresa_id, valor_total, qtd_titulos, data_pagamento INTO v_emp, v_valor, v_qtd, v_data
  FROM malote_pagamento WHERE id = p_programacao_id FOR UPDATE;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Programação não encontrada'; END IF;
  IF v_qtd = 0 THEN RAISE EXCEPTION 'Programação sem títulos'; END IF;
  IF v_data IS NULL THEN RAISE EXCEPTION 'Data programada de pagamento obrigatória'; END IF;
  UPDATE malote_pagamento SET aprovacao_status='pendente', enviado_aprovacao_por=auth.uid(),
    enviado_aprovacao_em=now(), status='enviado' WHERE id=p_programacao_id;
  INSERT INTO financeiro_pagamento_aprovacao (empresa_id, programacao_id, etapa, decisao, valor_aprovado, data_pagamento_aprovada)
  VALUES (v_emp, p_programacao_id, 1, 'pendente', v_valor, v_data) RETURNING id INTO v_apr_id;
  INSERT INTO financeiro_pagamento_log (empresa_id, programacao_id, acao, detalhes, usuario_id)
  VALUES (v_emp, p_programacao_id, 'submeter_aprovacao', jsonb_build_object('valor',v_valor,'qtd',v_qtd), auth.uid());
  RETURN v_apr_id;
END $$;

CREATE OR REPLACE FUNCTION public.programacao_decidir(
  p_programacao_id uuid, p_decisao public.aprov_decisao, p_justificativa text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_emp uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor_adm') OR public.has_role(auth.uid(),'financeiro')) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar';
  END IF;
  IF p_decisao='rejeitado' AND (p_justificativa IS NULL OR length(trim(p_justificativa))=0) THEN
    RAISE EXCEPTION 'Justificativa obrigatória para reprovação';
  END IF;
  SELECT empresa_id INTO v_emp FROM malote_pagamento WHERE id=p_programacao_id;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Programação não encontrada'; END IF;
  UPDATE financeiro_pagamento_aprovacao
  SET decisao=p_decisao, aprovador_id=auth.uid(), justificativa=p_justificativa, decidido_em=now()
  WHERE programacao_id=p_programacao_id AND decisao='pendente';
  UPDATE malote_pagamento SET aprovacao_status = CASE
    WHEN p_decisao='aprovado' THEN 'aprovada'::programacao_aprovacao_status
    WHEN p_decisao='rejeitado' THEN 'reprovada'::programacao_aprovacao_status
    WHEN p_decisao='devolvido' THEN 'devolvida'::programacao_aprovacao_status
    ELSE aprovacao_status END,
  status = CASE WHEN p_decisao='devolvido' THEN 'rascunho'::malote_status ELSE status END
  WHERE id=p_programacao_id;
  INSERT INTO financeiro_pagamento_log (empresa_id, programacao_id, acao, detalhes, usuario_id)
  VALUES (v_emp, p_programacao_id, 'decisao_aprovacao', jsonb_build_object('decisao',p_decisao,'justificativa',p_justificativa), auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.programacao_reabrir(p_programacao_id uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_emp uuid;
BEGIN
  SELECT empresa_id INTO v_emp FROM malote_pagamento WHERE id=p_programacao_id;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Programação não encontrada'; END IF;
  UPDATE malote_pagamento SET aprovacao_status='nao_submetida', reaberto=true, status='rascunho' WHERE id=p_programacao_id;
  INSERT INTO financeiro_pagamento_log (empresa_id, programacao_id, acao, detalhes, usuario_id)
  VALUES (v_emp, p_programacao_id, 'reabrir', jsonb_build_object('motivo',p_motivo), auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.validacao_registrar(
  p_titulo_pagar_id uuid, p_status public.validacao_status,
  p_divergencia text DEFAULT NULL, p_tratativa text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_emp uuid; v_val_aprov numeric; v_val_pago numeric; v_data_pgto date;
  v_mov uuid; v_id uuid; v_comprov boolean; v_baixa boolean; v_prog uuid;
BEGIN
  SELECT t.empresa_id, t.valor, t.valor_pago, t.data_pagamento,
    EXISTS(SELECT 1 FROM anexos a WHERE a.modulo='titulo_pagar' AND a.registro_id=t.id),
    (t.status::text='pago')
  INTO v_emp, v_val_aprov, v_val_pago, v_data_pgto, v_comprov, v_baixa
  FROM titulo_pagar t WHERE t.id=p_titulo_pagar_id;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Título não encontrado'; END IF;
  SELECT mt.malote_id INTO v_prog FROM malote_titulo mt WHERE mt.titulo_pagar_id=p_titulo_pagar_id LIMIT 1;
  SELECT id INTO v_mov FROM movimento_bancario WHERE titulo_pagar_id=p_titulo_pagar_id LIMIT 1;
  IF p_status='conferido' AND NOT v_baixa THEN
    RAISE EXCEPTION 'Não é possível conferir: baixa não confirmada';
  END IF;
  IF p_status='arquivado' AND p_divergencia IS NOT NULL THEN
    RAISE EXCEPTION 'Não é possível arquivar com divergência aberta';
  END IF;
  INSERT INTO financeiro_pagamento_validacao (
    empresa_id, titulo_pagar_id, programacao_id, movimento_bancario_id,
    valor_aprovado, valor_pago, data_paga, comprovante_anexado, baixa_confirmada,
    status_validacao, divergencia, tratativa, validado_por, validado_em
  ) VALUES (
    v_emp, p_titulo_pagar_id, v_prog, v_mov, v_val_aprov, v_val_pago, v_data_pgto,
    v_comprov, v_baixa, p_status, p_divergencia, p_tratativa, auth.uid(), now()
  ) ON CONFLICT (titulo_pagar_id) DO UPDATE SET
    movimento_bancario_id=EXCLUDED.movimento_bancario_id,
    valor_pago=EXCLUDED.valor_pago, data_paga=EXCLUDED.data_paga,
    comprovante_anexado=EXCLUDED.comprovante_anexado,
    baixa_confirmada=EXCLUDED.baixa_confirmada,
    status_validacao=EXCLUDED.status_validacao,
    divergencia=EXCLUDED.divergencia, tratativa=EXCLUDED.tratativa,
    revisado_por=auth.uid(), revisado_em=now()
  RETURNING id INTO v_id;
  INSERT INTO financeiro_pagamento_log (empresa_id, programacao_id, titulo_pagar_id, acao, detalhes, usuario_id)
  VALUES (v_emp, v_prog, p_titulo_pagar_id, 'validacao_registrar', jsonb_build_object('status',p_status,'divergencia',p_divergencia), auth.uid());
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.validacao_enviar_conciliacao(p_titulo_pagar_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_emp uuid;
BEGIN
  SELECT empresa_id INTO v_emp FROM titulo_pagar WHERE id=p_titulo_pagar_id;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Título não encontrado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM movimento_bancario WHERE titulo_pagar_id=p_titulo_pagar_id) THEN
    RAISE EXCEPTION 'Sem movimento bancário vinculado — baixa pendente';
  END IF;
  UPDATE financeiro_pagamento_validacao
  SET status_validacao='pendente_conciliacao', revisado_por=auth.uid(), revisado_em=now()
  WHERE titulo_pagar_id=p_titulo_pagar_id;
  INSERT INTO financeiro_pagamento_log (empresa_id, titulo_pagar_id, acao, usuario_id)
  VALUES (v_emp, p_titulo_pagar_id, 'enviar_conciliacao', auth.uid());
END $$;
