-- =========================================================================
-- FIX: portal_candidatar grava na coluna que EXISTIR (schema-agnóstico)
--
-- A WA_CURRICULOS tem nomes de coluna diferentes entre ambientes (ex.: nome vs
-- nome_cand, email vs email_cand). A versão anterior inseria colunas fixas
-- (nome_cand, ...) e quebrava com "column nome_cand does not exist".
--
-- Esta versão insere a linha base (vaga_id, origem) e preenche cada campo na
-- primeira coluna que realmente existir. Migration aditivo e idempotente —
-- aplica o fix em ambientes que já rodaram 20260618000003.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.portal_candidatar(
  p_vaga_id      integer,
  p_nome         text,
  p_telefone     text,
  p_email        text,
  p_cpf          text,
  p_mensagem     text,
  p_arquivo_nome text,
  p_storage_path text
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_status text;
  v_id     bigint;
  v_field  record;
  v_col    text;
BEGIN
  IF coalesce(btrim(p_nome), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Informe seu nome.');
  END IF;
  IF coalesce(btrim(p_telefone), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Informe seu telefone.');
  END IF;

  SELECT "status" INTO v_status FROM public."SISTEMA_RECRUTAMENTO" WHERE "id" = p_vaga_id;
  IF v_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Vaga não encontrada.');
  END IF;
  IF v_status <> 'Seleção de Currículos' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Esta vaga não está mais recebendo currículos.');
  END IF;

  INSERT INTO public."WA_CURRICULOS" (vaga_id, origem)
  VALUES (p_vaga_id, 'Portal')
  RETURNING id INTO v_id;

  FOR v_field IN
    SELECT t.cands, t.val FROM (VALUES
      (ARRAY['nome','nome_cand','nome_candidato'],    btrim(p_nome)),
      (ARRAY['telefone','fone','celular','whatsapp'], btrim(p_telefone)),
      (ARRAY['email','email_cand'],                   NULLIF(btrim(p_email), '')),
      (ARRAY['cpf','cpf_cand'],                       NULLIF(btrim(p_cpf), '')),
      (ARRAY['mensagem','observacao','obs'],          NULLIF(btrim(p_mensagem), '')),
      (ARRAY['arquivo_nome','nome_arquivo'],          NULLIF(btrim(p_arquivo_nome), '')),
      (ARRAY['storage_path','arquivo_path','path'],   NULLIF(btrim(p_storage_path), ''))
    ) AS t(cands, val)
    WHERE t.val IS NOT NULL
  LOOP
    SELECT c.column_name INTO v_col
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'WA_CURRICULOS'
      AND c.column_name::text = ANY (v_field.cands)
    ORDER BY array_position(v_field.cands, c.column_name::text)
    LIMIT 1;
    IF v_col IS NOT NULL THEN
      EXECUTE format('UPDATE public."WA_CURRICULOS" SET %I = $1 WHERE id = $2', v_col)
        USING v_field.val, v_id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.portal_candidatar(integer,text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_candidatar(integer,text,text,text,text,text,text,text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
