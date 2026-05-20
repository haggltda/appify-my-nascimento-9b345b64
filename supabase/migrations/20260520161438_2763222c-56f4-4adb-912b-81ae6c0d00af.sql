
CREATE OR REPLACE FUNCTION public.admin_alterar_empresa_cc(
  _cc_id uuid,
  _nova_empresa_id uuid,
  _motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cenario text;
  cc_antiga uuid;
  cc_codigo text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar a empresa de um CC.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT empresa_id, codigo INTO cc_antiga, cc_codigo FROM public.centros_custo WHERE id = _cc_id;
  IF cc_antiga IS NULL THEN
    RAISE EXCEPTION 'CC não encontrado: %', _cc_id;
  END IF;

  IF cc_antiga = _nova_empresa_id THEN
    RETURN jsonb_build_object('ok', true, 'cenario', 'inalterado');
  END IF;

  cenario := public.pode_alterar_empresa_cc(_cc_id);
  IF cenario = 'bloqueado' THEN
    RAISE EXCEPTION 'CC % possui movimento — alteração bloqueada.', cc_codigo USING ERRCODE = 'check_violation';
  END IF;

  IF _motivo IS NULL OR length(trim(_motivo)) < 5 THEN
    RAISE EXCEPTION 'Motivo é obrigatório (mínimo 5 caracteres).';
  END IF;

  PERFORM set_config('app.motivo_troca_empresa_cc', _motivo, true);
  UPDATE public.centros_custo SET empresa_id = _nova_empresa_id, updated_at = now() WHERE id = _cc_id;

  RETURN jsonb_build_object('ok', true, 'cenario', cenario);
END;
$$;
