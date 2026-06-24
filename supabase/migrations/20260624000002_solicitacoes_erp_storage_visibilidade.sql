-- Solicitações ERP: o bucket de storage "sistema-solicitacoes" ainda estava
-- liberado pra qualquer autenticado (regra antiga da migration 20260623000001,
-- de antes do modelo de papéis). Os arquivos têm que respeitar a mesma
-- visibilidade do card (criador / convidado / "ver todas" / papéis de ação),
-- não só a metadata em sistema_solicitacao_anexo.
--
-- O path de cada arquivo é "<solicitacao_id>/<timestamp>-<nome>" (ver
-- uploadAnexo em SolicitacoesErp.tsx) — extrai o id do 1º segmento do path.

CREATE OR REPLACE FUNCTION public.sistema_storage_pode_ver(_name text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_criado_por uuid;
BEGIN
  v_id := split_part(_name, '/', 1)::uuid;
  SELECT criado_por INTO v_criado_por FROM public.sistema_solicitacao WHERE id = v_id;
  IF v_criado_por IS NULL THEN
    RETURN false;
  END IF;
  RETURN public.sistema_pode_ver(v_criado_por, v_id);
EXCEPTION WHEN OTHERS THEN
  -- Path malformado (não deveria acontecer pelo upload normal) — nega por padrão.
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.sistema_storage_pode_ver(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sistema_storage_pode_ver(text) TO authenticated;

DROP POLICY IF EXISTS "sistema solicitacoes anexo select" ON storage.objects;
CREATE POLICY "sistema solicitacoes anexo select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'sistema-solicitacoes' AND public.sistema_storage_pode_ver(name));

DROP POLICY IF EXISTS "sistema solicitacoes anexo insert" ON storage.objects;
CREATE POLICY "sistema solicitacoes anexo insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sistema-solicitacoes' AND public.sistema_storage_pode_ver(name));
