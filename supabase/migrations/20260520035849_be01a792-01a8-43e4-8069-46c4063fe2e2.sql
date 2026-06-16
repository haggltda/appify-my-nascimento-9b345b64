
CREATE OR REPLACE FUNCTION public.sup_aprov_fluxo_padrao(
  _empresa_id uuid,
  _alvo public.sup_aprov_alvo
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM public.sup_aprov_fluxo
  WHERE empresa_id = _empresa_id AND alvo = _alvo AND ativo
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.sup_aprov_fluxo (empresa_id, alvo, nome, ativo)
    VALUES (_empresa_id, _alvo, 'Fluxo padrão — ' || _alvo::text, true)
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$function$;
