
-- 1) Tabela de auditoria
CREATE TABLE IF NOT EXISTS public.centros_custo_empresa_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_custo_id uuid NOT NULL,
  empresa_id_anterior uuid NOT NULL,
  empresa_id_novo uuid NOT NULL,
  motivo text,
  cenario text NOT NULL,
  alterado_por uuid,
  alterado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_empresa_log_cc ON public.centros_custo_empresa_log(centro_custo_id);

ALTER TABLE public.centros_custo_empresa_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem log de troca de empresa do CC"
  ON public.centros_custo_empresa_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins inserem log de troca de empresa do CC"
  ON public.centros_custo_empresa_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Função de diagnóstico (conta refs em todas as rotinas operacionais)
CREATE OR REPLACE FUNCTION public.diagnostico_alterar_empresa_cc(_cc_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb := '{}'::jsonb;
  n_titulo_pagar int;
  n_titulo_receber int;
  n_pre_titulo int;
  n_nf int;
  n_pedido int;
  n_req int;
  n_lanc int;
  n_realizado int;
  n_estoque int;
  n_folha int;
  n_obz int;
  n_orc int;
  n_plano int;
  n_aprov int;
  n_contrato int;
  contrato_status text;
BEGIN
  SELECT count(*) INTO n_titulo_pagar    FROM public.titulo_pagar     WHERE centro_custo_id = _cc_id;
  SELECT count(*) INTO n_titulo_receber  FROM public.titulo_receber   WHERE centro_custo_id = _cc_id;
  SELECT count(*) INTO n_pre_titulo      FROM public.pre_titulo_pagar WHERE centro_custo_id = _cc_id;
  SELECT count(*) INTO n_nf              FROM public.nf_entrada       WHERE centro_custo_id = _cc_id;
  SELECT count(*) INTO n_pedido          FROM public.pedido_compra    WHERE centro_custo_id = _cc_id;
  SELECT count(*) INTO n_req             FROM public.requisicao_compra WHERE centro_custo_id = _cc_id;
  SELECT count(*) INTO n_lanc            FROM public.lancamento_partida WHERE centro_custo_id = _cc_id;
  SELECT count(*) INTO n_realizado       FROM public.realizado_lancamentos WHERE centro_custo_id = _cc_id;
  SELECT count(*) INTO n_estoque         FROM public.estoque_movimento WHERE centro_custo_id = _cc_id;
  SELECT count(*) INTO n_folha           FROM public.folha_evento     WHERE centro_custo_id = _cc_id;
  SELECT count(*) INTO n_obz             FROM public.obz_valores      WHERE centro_custo_id = _cc_id;
  SELECT count(*) INTO n_orc             FROM public.orcamento_contrato_linha WHERE centro_custo_id = _cc_id;
  SELECT count(*) INTO n_plano           FROM public.plano_acao       WHERE centro_custo_id = _cc_id;
  SELECT count(*) INTO n_aprov           FROM public.sup_aprov_instancia WHERE centro_custo_id = _cc_id;
  SELECT count(*), max(status) INTO n_contrato, contrato_status FROM public.contrato WHERE centro_custo_id = _cc_id;

  v := jsonb_build_object(
    'titulo_pagar', n_titulo_pagar,
    'titulo_receber', n_titulo_receber,
    'pre_titulo_pagar', n_pre_titulo,
    'nf_entrada', n_nf,
    'pedido_compra', n_pedido,
    'requisicao_compra', n_req,
    'lancamento_partida', n_lanc,
    'realizado_lancamentos', n_realizado,
    'estoque_movimento', n_estoque,
    'folha_evento', n_folha,
    'obz_valores', n_obz,
    'orcamento_contrato_linha', n_orc,
    'plano_acao', n_plano,
    'sup_aprov_instancia', n_aprov,
    'contrato_count', n_contrato,
    'contrato_status', contrato_status,
    'total_movimento', n_titulo_pagar + n_titulo_receber + n_pre_titulo + n_nf + n_pedido + n_req
                       + n_lanc + n_realizado + n_estoque + n_folha + n_obz + n_orc
  );
  RETURN v;
END;
$$;

-- 3) Função que classifica o cenário
CREATE OR REPLACE FUNCTION public.pode_alterar_empresa_cc(_cc_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d jsonb;
  total int;
  cstatus text;
BEGIN
  d := public.diagnostico_alterar_empresa_cc(_cc_id);
  total := (d->>'total_movimento')::int;
  cstatus := d->>'contrato_status';

  IF total > 0 THEN
    RETURN 'bloqueado';
  END IF;

  -- sem movimento
  IF cstatus IS NULL OR cstatus = 'implantacao' THEN
    RETURN 'livre';
  END IF;

  RETURN 'confirmacao';
END;
$$;

-- 4) Trigger que bloqueia/loga troca de empresa e sincroniza contrato
CREATE OR REPLACE FUNCTION public.tg_centros_custo_troca_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cenario text;
  motivo_txt text;
BEGIN
  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
    cenario := public.pode_alterar_empresa_cc(OLD.id);

    IF cenario = 'bloqueado' THEN
      RAISE EXCEPTION 'Não é possível alterar a empresa do CC % (%): existem movimentos vinculados (títulos, NFs, lançamentos, etc.). Faça o estorno/reemissão pelo processo administrativo.', OLD.codigo, OLD.id
        USING ERRCODE = 'check_violation';
    END IF;

    -- Apenas admin pode trocar
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar a empresa de um CC.' USING ERRCODE = 'insufficient_privilege';
    END IF;

    motivo_txt := current_setting('app.motivo_troca_empresa_cc', true);

    INSERT INTO public.centros_custo_empresa_log
      (centro_custo_id, empresa_id_anterior, empresa_id_novo, motivo, cenario, alterado_por)
    VALUES
      (OLD.id, OLD.empresa_id, NEW.empresa_id, NULLIF(motivo_txt, ''), cenario, auth.uid());

    -- Sincroniza contrato vinculado
    UPDATE public.contrato
      SET empresa_id = NEW.empresa_id, updated_at = now()
      WHERE centro_custo_id = OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_centros_custo_troca_empresa ON public.centros_custo;
CREATE TRIGGER trg_centros_custo_troca_empresa
  BEFORE UPDATE OF empresa_id ON public.centros_custo
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_centros_custo_troca_empresa();
