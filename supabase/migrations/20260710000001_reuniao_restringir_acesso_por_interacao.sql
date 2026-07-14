-- SEGURANÇA: restringe acesso aos dados de uma reunião a quem realmente
-- tem relação com ela (criador, organizador ou convidado). Até aqui, toda
-- policy dessas tabelas usava só tem_acesso_menu('central_servicos_reunioes'),
-- que é permissão de MÓDULO (quem pode abrir a tela), não de LINHA (quem
-- pode ver aquela reunião específica) — qualquer usuário com acesso ao menu
-- via pauta/respostas/anexos/comentários/assinaturas de QUALQUER reunião da
-- empresa. Também corrige, na mesma causa raiz: UPDATE de reuniao sem
-- checagem de dono nenhuma, e INSERT/DELETE de convidado liberado pra
-- qualquer um (inclusive se auto-adicionar numa reunião alheia).

-- 1) Função auxiliar ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tem_interacao_reuniao(p_reuniao_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.reuniao r
     WHERE r.id = p_reuniao_id
       AND (
         auth.uid() = r.criado_por
         OR auth.uid() = r.responsavel_preenchimento_user_id
         OR EXISTS (SELECT 1 FROM public.reuniao_convidado c WHERE c.reuniao_id = r.id AND c.user_id = auth.uid())
       )
  );
$$;

-- 2) reuniao: SELECT por interação, UPDATE só por quem organiza ---------------
DROP POLICY IF EXISTS reuniao_select ON public.reuniao;
CREATE POLICY reuniao_select ON public.reuniao
  FOR SELECT TO authenticated
  USING (public.tem_acesso_menu('central_servicos_reunioes') AND public.tem_interacao_reuniao(id));

DROP POLICY IF EXISTS reuniao_update ON public.reuniao;
CREATE POLICY reuniao_update ON public.reuniao
  FOR UPDATE TO authenticated
  USING (public.tem_acesso_menu('central_servicos_reunioes') AND auth.uid() IN (criado_por, responsavel_preenchimento_user_id))
  WITH CHECK (public.tem_acesso_menu('central_servicos_reunioes') AND auth.uid() IN (criado_por, responsavel_preenchimento_user_id));

-- 3) reuniao_pauta: SELECT por interação ---------------------------------------
DROP POLICY IF EXISTS reuniao_pauta_select ON public.reuniao_pauta;
CREATE POLICY reuniao_pauta_select ON public.reuniao_pauta
  FOR SELECT TO authenticated
  USING (public.tem_acesso_menu('central_servicos_reunioes') AND public.tem_interacao_reuniao(reuniao_id));

-- 4) reuniao_resposta: SELECT por interação (via pauta_id) --------------------
DROP POLICY IF EXISTS reuniao_resposta_select ON public.reuniao_resposta;
CREATE POLICY reuniao_resposta_select ON public.reuniao_resposta
  FOR SELECT TO authenticated
  USING (
    public.tem_acesso_menu('central_servicos_reunioes')
    AND EXISTS (
      SELECT 1 FROM public.reuniao_pauta p
       WHERE p.id = pauta_id AND public.tem_interacao_reuniao(p.reuniao_id)
    )
  );

-- 5) reuniao_convidado: SELECT por interação; INSERT/DELETE só por quem organiza
DROP POLICY IF EXISTS reuniao_convidado_select ON public.reuniao_convidado;
CREATE POLICY reuniao_convidado_select ON public.reuniao_convidado
  FOR SELECT TO authenticated
  USING (public.tem_acesso_menu('central_servicos_reunioes') AND public.tem_interacao_reuniao(reuniao_id));

DROP POLICY IF EXISTS reuniao_convidado_insert ON public.reuniao_convidado;
CREATE POLICY reuniao_convidado_insert ON public.reuniao_convidado
  FOR INSERT TO authenticated
  WITH CHECK (
    public.tem_acesso_menu('central_servicos_reunioes')
    AND EXISTS (
      SELECT 1 FROM public.reuniao r
       WHERE r.id = reuniao_id AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id)
    )
  );

DROP POLICY IF EXISTS reuniao_convidado_delete ON public.reuniao_convidado;
CREATE POLICY reuniao_convidado_delete ON public.reuniao_convidado
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reuniao r
       WHERE r.id = reuniao_id AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id)
    )
  );

-- 6) reuniao_anexo: SELECT/INSERT/DELETE por interação -------------------------
DROP POLICY IF EXISTS reuniao_anexo_select ON public.reuniao_anexo;
CREATE POLICY reuniao_anexo_select ON public.reuniao_anexo
  FOR SELECT TO authenticated
  USING (public.tem_acesso_menu('central_servicos_reunioes') AND public.tem_interacao_reuniao(reuniao_id));

DROP POLICY IF EXISTS reuniao_anexo_insert ON public.reuniao_anexo;
CREATE POLICY reuniao_anexo_insert ON public.reuniao_anexo
  FOR INSERT TO authenticated
  WITH CHECK (public.tem_acesso_menu('central_servicos_reunioes') AND public.tem_interacao_reuniao(reuniao_id));

DROP POLICY IF EXISTS reuniao_anexo_delete ON public.reuniao_anexo;
CREATE POLICY reuniao_anexo_delete ON public.reuniao_anexo
  FOR DELETE TO authenticated
  USING (public.tem_acesso_menu('central_servicos_reunioes') AND public.tem_interacao_reuniao(reuniao_id));

-- 7) reuniao_comentario: SELECT/INSERT por interação (DELETE já é restrito) ----
DROP POLICY IF EXISTS reuniao_comentario_select ON public.reuniao_comentario;
CREATE POLICY reuniao_comentario_select ON public.reuniao_comentario
  FOR SELECT TO authenticated
  USING (public.tem_acesso_menu('central_servicos_reunioes') AND public.tem_interacao_reuniao(reuniao_id));

DROP POLICY IF EXISTS reuniao_comentario_insert ON public.reuniao_comentario;
CREATE POLICY reuniao_comentario_insert ON public.reuniao_comentario
  FOR INSERT TO authenticated
  WITH CHECK (public.tem_acesso_menu('central_servicos_reunioes') AND public.tem_interacao_reuniao(reuniao_id));

-- 8) reuniao_assinatura: SELECT/INSERT por interação ---------------------------
DROP POLICY IF EXISTS reuniao_assinatura_select ON public.reuniao_assinatura;
CREATE POLICY reuniao_assinatura_select ON public.reuniao_assinatura
  FOR SELECT TO authenticated
  USING (public.tem_acesso_menu('central_servicos_reunioes') AND public.tem_interacao_reuniao(reuniao_id));

DROP POLICY IF EXISTS reuniao_assinatura_insert ON public.reuniao_assinatura;
CREATE POLICY reuniao_assinatura_insert ON public.reuniao_assinatura
  FOR INSERT TO authenticated
  WITH CHECK (public.tem_acesso_menu('central_servicos_reunioes') AND user_id = auth.uid() AND public.tem_interacao_reuniao(reuniao_id));

-- 9) reuniao_pauta_anexo: SELECT/INSERT/DELETE por interação (via pauta_id) ----
DROP POLICY IF EXISTS reuniao_pauta_anexo_select ON public.reuniao_pauta_anexo;
CREATE POLICY reuniao_pauta_anexo_select ON public.reuniao_pauta_anexo
  FOR SELECT TO authenticated
  USING (
    public.tem_acesso_menu('central_servicos_reunioes')
    AND EXISTS (SELECT 1 FROM public.reuniao_pauta p WHERE p.id = pauta_id AND public.tem_interacao_reuniao(p.reuniao_id))
  );

DROP POLICY IF EXISTS reuniao_pauta_anexo_insert ON public.reuniao_pauta_anexo;
CREATE POLICY reuniao_pauta_anexo_insert ON public.reuniao_pauta_anexo
  FOR INSERT TO authenticated
  WITH CHECK (
    public.tem_acesso_menu('central_servicos_reunioes')
    AND EXISTS (SELECT 1 FROM public.reuniao_pauta p WHERE p.id = pauta_id AND public.tem_interacao_reuniao(p.reuniao_id))
  );

DROP POLICY IF EXISTS reuniao_pauta_anexo_delete ON public.reuniao_pauta_anexo;
CREATE POLICY reuniao_pauta_anexo_delete ON public.reuniao_pauta_anexo
  FOR DELETE TO authenticated
  USING (
    public.tem_acesso_menu('central_servicos_reunioes')
    AND EXISTS (SELECT 1 FROM public.reuniao_pauta p WHERE p.id = pauta_id AND public.tem_interacao_reuniao(p.reuniao_id))
  );

-- 10) reuniao_log: SELECT/INSERT por interação ---------------------------------
DROP POLICY IF EXISTS reuniao_log_select ON public.reuniao_log;
CREATE POLICY reuniao_log_select ON public.reuniao_log
  FOR SELECT TO authenticated
  USING (public.tem_acesso_menu('central_servicos_reunioes') AND public.tem_interacao_reuniao(reuniao_id));

DROP POLICY IF EXISTS reuniao_log_insert ON public.reuniao_log;
CREATE POLICY reuniao_log_insert ON public.reuniao_log
  FOR INSERT TO authenticated
  WITH CHECK (public.tem_acesso_menu('central_servicos_reunioes') AND public.tem_interacao_reuniao(reuniao_id));

-- 11) Storage (bucket "reunioes"): mesmo critério pro download do arquivo -----
-- Path sempre começa com "<reuniao_id>/..." (anexo de reunião, PDF final) ou
-- "<pauta_id>/..." (anexo por tópico) — extrai o primeiro segmento e valida
-- contra os dois casos.
CREATE OR REPLACE FUNCTION public.tem_interacao_storage_reunioes(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_primeiro_segmento text := (storage.foldername(p_object_name))[1];
  v_id uuid;
BEGIN
  BEGIN
    v_id := v_primeiro_segmento::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;

  RETURN public.tem_interacao_reuniao(v_id)
      OR EXISTS (SELECT 1 FROM public.reuniao_pauta p WHERE p.id = v_id AND public.tem_interacao_reuniao(p.reuniao_id));
END;
$$;

DROP POLICY IF EXISTS "reunioes anexo select" ON storage.objects;
CREATE POLICY "reunioes anexo select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'reunioes'
    AND public.tem_acesso_menu('central_servicos_reunioes')
    AND public.tem_interacao_storage_reunioes(name)
  );

-- 12) Trigger de conflito de participante não deve mais citar o título da
--     reunião conflitante — a pessoa que está tentando convidar pode não
--     ter acesso nenhum a ela.
CREATE OR REPLACE FUNCTION public.checar_conflito_convidado()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_data_hora    timestamptz;
  v_duracao      int;
  v_etapa        text;
  v_tem_conflito boolean;
BEGIN
  SELECT data_hora, duracao_minutos, etapa INTO v_data_hora, v_duracao, v_etapa
    FROM public.reuniao WHERE id = NEW.reuniao_id;

  IF v_etapa = 'cancelada' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.reuniao_convidado rc
      JOIN public.reuniao r ON r.id = rc.reuniao_id
     WHERE rc.user_id = NEW.user_id
       AND rc.reuniao_id <> NEW.reuniao_id
       AND r.etapa <> 'cancelada'
       AND tstzrange(r.data_hora, r.data_hora + (r.duracao_minutos || ' minutes')::interval)
           && tstzrange(v_data_hora, v_data_hora + (v_duracao || ' minutes')::interval)
  ) INTO v_tem_conflito;

  IF v_tem_conflito THEN
    RAISE EXCEPTION 'Este participante já está convidado para outra reunião no mesmo horário.';
  END IF;

  RETURN NEW;
END;
$$;
