-- =========================================================================
-- NASCIMENTO FORMULÁRIOS — Lixeira (soft-delete 30 dias) + papel ver_lixeira
--
-- Excluir um formulário passa a ser SOFT-DELETE (deleted_at = now()): some da
-- lista, para de receber resposta e some da URL pública; fica 30 dias na lixeira
-- e pode ser restaurado. Só quem tem o papel 'ver_lixeira' vê/restaura.
--
-- IMPORTANTE: este bloco é propositalmente MÍNIMO e sem dependências de funções
-- (cs_form_pode_criar/cs_form_cap podem não existir neste banco). Ele NÃO
-- redefine cs_forms_select/cs_forms_update — a lista é filtrada no cliente e a
-- restauração usa a policy de UPDATE já existente. Referencia só tabelas que
-- existem (CS_FORMULARIOS, CS_FORM_ACESSOS, CS_FORM_RESPOSTAS). Idempotente.
-- =========================================================================

-- 1) Coluna de soft-delete (o front depende dela — roda isto primeiro)
ALTER TABLE public."CS_FORMULARIOS" ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS cs_forms_deleted_idx ON public."CS_FORMULARIOS"(deleted_at);

-- 2) Novo papel 'ver_lixeira': só remove a checagem de papel (evita qualquer
--    conflito com valores legados no banco). A tela do admin controla os papéis.
ALTER TABLE public."CS_FORM_ACESSOS" DROP CONSTRAINT IF EXISTS cs_form_acessos_papel_check;

-- 3) anon não vê formulário apagado (só colunas — seguro)
DROP POLICY IF EXISTS cs_forms_public_read ON public."CS_FORMULARIOS";
CREATE POLICY cs_forms_public_read ON public."CS_FORMULARIOS"
  FOR SELECT TO anon USING (status = 'publicado' AND seguranca = 'liberado' AND deleted_at IS NULL);

-- 4) Formulário na lixeira não está "aberto" (não recebe resposta)
CREATE OR REPLACE FUNCTION public.cs_form_aberto(_form_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."CS_FORMULARIOS" f
     WHERE f.id = _form_id
       AND f.deleted_at IS NULL
       AND f.status = 'publicado'
       AND (f.inicia_em  IS NULL OR now() >= f.inicia_em)
       AND (f.encerra_em IS NULL OR now() <= f.encerra_em)
       AND (f.max_respostas IS NULL OR
            (SELECT count(*) FROM public."CS_FORM_RESPOSTAS" r WHERE r.formulario_id = f.id) < f.max_respostas));
$$;

-- 5) Porta pública: formulário apagado responde "não existe"
CREATE OR REPLACE FUNCTION public.cs_form_porta(_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT jsonb_build_object(
              'existe', true,
              'seguranca', f.seguranca,
              'exige_senha', f.exige_senha,
              'publicado', f.status = 'publicado')
       FROM public."CS_FORMULARIOS" f WHERE f.slug = _slug AND f.deleted_at IS NULL),
    jsonb_build_object('existe', false));
$$;

-- 6) Purga: apaga de vez o que passou de 30 dias (checa ver_lixeira direto na
--    tabela, sem depender de cs_form_cap).
CREATE OR REPLACE FUNCTION public.cs_form_purgar_lixeira()
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public."CS_FORM_ACESSOS"
                  WHERE papel = 'ver_lixeira' AND user_id = auth.uid()) THEN
    RETURN 0;
  END IF;
  DELETE FROM public."CS_FORM_RESPOSTAS" r
   USING public."CS_FORMULARIOS" f
   WHERE r.formulario_id = f.id
     AND f.deleted_at IS NOT NULL
     AND f.deleted_at < now() - interval '30 days';
  WITH del AS (
    DELETE FROM public."CS_FORMULARIOS"
     WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days'
    RETURNING 1
  )
  SELECT count(*) INTO v_n FROM del;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.cs_form_purgar_lixeira() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cs_form_purgar_lixeira() TO authenticated;

-- 7) Quantas respostas já usam uma pergunta (aviso ao excluir pergunta).
CREATE OR REPLACE FUNCTION public.cs_form_pergunta_respostas(_form_id uuid, _perg text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::integer
    FROM public."CS_FORM_RESPOSTAS" r
   WHERE r.formulario_id = _form_id
     AND r.itens ? _perg
     AND COALESCE(btrim(r.itens ->> _perg), '') <> '';
$$;
REVOKE ALL ON FUNCTION public.cs_form_pergunta_respostas(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cs_form_pergunta_respostas(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
