-- =========================================================================
-- NASCIMENTO FORMULÁRIOS — Lixeira (soft-delete 30 dias) + papel ver_lixeira
--
-- Excluir um formulário passa a ser SOFT-DELETE (deleted_at = now()): ele some
-- da lista, some da URL pública e para de receber respostas, mas fica 30 dias
-- na lixeira, podendo ser restaurado. Só quem tem o papel 'ver_lixeira' enxerga
-- e restaura os apagados. Depois de 30 dias é apagado de vez (RPC de purga,
-- chamada ao abrir a lixeira). Idempotente.
-- =========================================================================

-- 1) Coluna de soft-delete
ALTER TABLE public."CS_FORMULARIOS" ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS cs_forms_deleted_idx ON public."CS_FORMULARIOS"(deleted_at);

-- 2) Novo papel 'ver_lixeira' (global, sem setor — coberto pelo unq_global)
ALTER TABLE public."CS_FORM_ACESSOS" DROP CONSTRAINT IF EXISTS cs_form_acessos_papel_check;
ALTER TABLE public."CS_FORM_ACESSOS" ADD  CONSTRAINT cs_form_acessos_papel_check CHECK (papel IN (
  'editar_criar', 'responder', 'encerrar_excluir', 'ver_tudo', 'ver_proprias',
  'ver_setor', 'criar_setor', 'ver_lixeira', 'dashboard'));

-- 3) Leitura do formulário: ativos como antes; apagados só p/ quem tem ver_lixeira.
--    Modelo consolidado (20260713000001): visibilidade via CS_FORM_ACESSOS
--    (papel 'visualiza' por formulário / 'gestor' global) — as tabelas antigas
--    CS_FORM_VISIBILIDADE e CS_FORM_GESTORES foram dropadas na consolidação.
DROP POLICY IF EXISTS cs_forms_select ON public."CS_FORMULARIOS";
CREATE POLICY cs_forms_select ON public."CS_FORMULARIOS"
  FOR SELECT TO authenticated USING (
    (deleted_at IS NULL AND (
      visibilidade = 'todos'
      OR criado_por = auth.uid()
      OR EXISTS (SELECT 1 FROM public."CS_FORM_ACESSOS" a
                  WHERE a.papel = 'visualiza'
                    AND a.formulario_id = "CS_FORMULARIOS".id
                    AND a.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public."CS_FORM_ACESSOS" a
                  WHERE a.papel = 'gestor' AND a.user_id = auth.uid())
    ))
    OR (deleted_at IS NOT NULL AND public.cs_form_cap('ver_lixeira'))
  );

-- anon nunca vê apagado
DROP POLICY IF EXISTS cs_forms_public_read ON public."CS_FORMULARIOS";
CREATE POLICY cs_forms_public_read ON public."CS_FORMULARIOS"
  FOR SELECT TO anon USING (status = 'publicado' AND seguranca = 'liberado' AND deleted_at IS NULL);

-- 4) Update: criador/gestor OU quem tem ver_lixeira (p/ restaurar apagado)
DROP POLICY IF EXISTS cs_forms_update ON public."CS_FORMULARIOS";
CREATE POLICY cs_forms_update ON public."CS_FORMULARIOS"
  FOR UPDATE TO authenticated
  USING (criado_por = auth.uid() OR public.cs_form_pode_criar() OR public.cs_form_cap('ver_lixeira'))
  WITH CHECK (criado_por = auth.uid() OR public.cs_form_pode_criar() OR public.cs_form_cap('ver_lixeira'));

-- 5) Formulário na lixeira não está "aberto" (não recebe resposta)
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

-- 6) Porta pública: formulário apagado responde "não existe"
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

-- 7) Purga: apaga de vez o que passou de 30 dias na lixeira (só ver_lixeira).
CREATE OR REPLACE FUNCTION public.cs_form_purgar_lixeira()
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n integer;
BEGIN
  IF NOT public.cs_form_cap('ver_lixeira') THEN
    RETURN 0;
  END IF;
  -- respostas primeiro (caso não haja cascade), depois o formulário.
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

-- 8) Quantas respostas já usam uma pergunta (aviso ao excluir pergunta no editor).
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
