-- =============================================================
-- APLICAR NO BANCO DO APP  (projeto Supabase fwmzeaztjxrxxzxzxmgc)
-- Cole tudo no SQL Editor desse projeto e rode. É idempotente.
-- =============================================================

-- ===== 20260618000001_recrutamento_status_tracking =====
-- =========================================================================
-- INDICADORES DE TEMPO POR ETAPA (Recrutamento)
--
-- Objetivo: saber "quantos dias a vaga está parada no status atual" e ter
-- base para indicadores de qual etapa demora mais.
--
-- 1. Coluna status_changed_at em SISTEMA_RECRUTAMENTO (carimbo da última troca).
-- 2. Tabela de log de transições (status anterior → novo + dias no anterior).
-- 3. Trigger BEFORE UPDATE que carimba a data e grava o log a cada troca.
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- =========================================================================

ALTER TABLE public."SISTEMA_RECRUTAMENTO"
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz NOT NULL DEFAULT now();

-- Inicializa o carimbo das linhas antigas com a data de criação.
UPDATE public."SISTEMA_RECRUTAMENTO"
   SET status_changed_at = created_at
 WHERE status_changed_at IS NULL OR status_changed_at < created_at;

-- Log de transições de status (para indicadores de tempo por etapa).
CREATE TABLE IF NOT EXISTS public."SISTEMA_RECRUTAMENTO_STATUS_LOG" (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  solicitacao_id   integer REFERENCES public."SISTEMA_RECRUTAMENTO"(id) ON DELETE CASCADE,
  status_anterior  text,
  status_novo      text,
  dias_no_anterior numeric,
  changed_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS srsl_solicitacao_idx
  ON public."SISTEMA_RECRUTAMENTO_STATUS_LOG"(solicitacao_id);

ALTER TABLE public."SISTEMA_RECRUTAMENTO_STATUS_LOG" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public."SISTEMA_RECRUTAMENTO_STATUS_LOG" TO authenticated;

DROP POLICY IF EXISTS srsl_all_auth ON public."SISTEMA_RECRUTAMENTO_STATUS_LOG";
CREATE POLICY srsl_all_auth ON public."SISTEMA_RECRUTAMENTO_STATUS_LOG"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger: a cada troca de status, carimba status_changed_at e registra o log.
CREATE OR REPLACE FUNCTION public.sr_track_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_dias numeric;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_dias := EXTRACT(EPOCH FROM (now() - COALESCE(OLD.status_changed_at, OLD.created_at))) / 86400.0;
    NEW.status_changed_at := now();
    -- O log nunca pode bloquear a atualização principal da solicitação.
    BEGIN
      INSERT INTO public."SISTEMA_RECRUTAMENTO_STATUS_LOG"
        (solicitacao_id, status_anterior, status_novo, dias_no_anterior)
      VALUES (NEW.id, OLD.status, NEW.status, round(v_dias, 2));
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sr_track_status ON public."SISTEMA_RECRUTAMENTO";
CREATE TRIGGER trg_sr_track_status
  BEFORE UPDATE ON public."SISTEMA_RECRUTAMENTO"
  FOR EACH ROW EXECUTE FUNCTION public.sr_track_status_change();

-- ===== 20260618000002_vincular_empregado_rpc =====
-- =========================================================================
-- VÍNCULO via RPC (substitui a Edge Function auth-vincular-empregado)
--
-- Motivo: a chamada à Edge Function vinha falhando no client com
-- "Failed to send a request to the Edge Function" (falha de rede/boot/CORS).
-- Mover a lógica para uma RPC SECURITY DEFINER (PostgREST) elimina essa
-- dependência: vai pelo mesmo endpoint /rest/v1/rpc já usado pelo app.
--
-- Confirma identidade por CPF + data de nascimento, exclui desligados,
-- escolhe a admissão mais recente e grava auth_user_id = auth.uid().
--
-- Idempotente e autossuficiente: garante a coluna/índice e recria meu_empregado,
-- caso a migration 20260617000003 não tenha sido aplicada no ambiente.
-- =========================================================================

ALTER TABLE public."EMPREGADOS"
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS empregados_auth_user_id_uidx
  ON public."EMPREGADOS"(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- Leitura segura do "meu cadastro" (campos não-sensíveis).
CREATE OR REPLACE FUNCTION public.meu_empregado()
RETURNS TABLE (
  id bigint, nome text, cpf text, cargo text, setor text, perfil text,
  lider text, situacao text, admissao text, empresa text, filial text, email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    "ID", "Nome", "CPF", "Título do Cargo", "Setor_ERP", "Perfil_ERP",
    "LIDER", "Situação", "Admissão", "Nome da Empresa", "Nome Filial", "email"
  FROM public."EMPREGADOS"
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;
-- Apenas usuários autenticados: o Supabase concede EXECUTE a anon por padrão
-- (default privileges), então é preciso revogar de PUBLIC e de anon.
REVOKE ALL ON FUNCTION public.meu_empregado() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meu_empregado() TO authenticated;

-- ── RPC de vínculo ───────────────────────────────────────────────────────
-- p_confirmar = false  → apenas valida e devolve o preview do cadastro
-- p_confirmar = true   → valida de novo e grava o vínculo
CREATE OR REPLACE FUNCTION public.vincular_meu_empregado(
  p_cpf        text,
  p_nascimento text,
  p_confirmar  boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_cpf     text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_nasc    text := regexp_replace(coalesce(p_nascimento, ''), '\D', '', 'g');
  v_cpf_fmt text;
  v_emp     public."EMPREGADOS"%ROWTYPE;
  v_bloq    text[] := ARRAY['DEMITIDO','DEMITIDA','RESCISÃO','DESLIGADO','DESLIGADA'];
  v_preview jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Não autenticado');
  END IF;
  IF length(v_cpf) <> 11 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Informe um CPF válido (11 dígitos).');
  END IF;
  IF length(v_nasc) <> 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Informe a data de nascimento (DD/MM/AAAA).');
  END IF;

  v_cpf_fmt := substr(v_cpf,1,3) || '.' || substr(v_cpf,4,3) || '.' || substr(v_cpf,7,3) || '-' || substr(v_cpf,10,2);

  -- Não-desligados primeiro; depois admissão mais recente.
  SELECT * INTO v_emp
  FROM public."EMPREGADOS" e
  WHERE e."CPF" IN (v_cpf, v_cpf_fmt)
  ORDER BY
    (CASE WHEN upper(coalesce(e."Situação",'')) = ANY (v_bloq) THEN 1 ELSE 0 END) ASC,
    (CASE WHEN e."Admissão" ~ '^\d{2}/\d{2}/\d{4}$'
          THEN (substr(e."Admissão",7,4) || substr(e."Admissão",4,2) || substr(e."Admissão",1,2))::bigint
          ELSE 0 END) DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CPF não encontrado.');
  END IF;

  IF upper(coalesce(v_emp."Situação",'')) = ANY (v_bloq) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cadastro consta como desligado. Procure o RH.');
  END IF;

  IF regexp_replace(coalesce(v_emp."Nascimento",''), '\D', '', 'g') <> v_nasc THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CPF e data de nascimento não conferem.');
  END IF;

  IF v_emp.auth_user_id IS NOT NULL AND v_emp.auth_user_id <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Este cadastro já está vinculado a outro usuário. Procure o RH.');
  END IF;

  v_preview := jsonb_build_object(
    'id',       v_emp."ID",
    'nome',     coalesce(v_emp."Nome", ''),
    'cargo',    coalesce(v_emp."Título do Cargo", ''),
    'setor',    coalesce(v_emp."Setor_ERP", ''),
    'perfil',   coalesce(v_emp."Perfil_ERP", ''),
    'lider',    coalesce(v_emp."LIDER", ''),
    'situacao', coalesce(v_emp."Situação", ''),
    'admissao', coalesce(v_emp."Admissão", ''),
    'empresa',  coalesce(v_emp."Nome da Empresa", ''),
    'filial',   coalesce(v_emp."Nome Filial", '')
  );

  IF NOT p_confirmar THEN
    RETURN jsonb_build_object('ok', true, 'ja_vinculado', (v_emp.auth_user_id = v_uid), 'empregado', v_preview);
  END IF;

  -- Confirmar: grava o elo e preenche o e-mail se estiver vazio.
  UPDATE public."EMPREGADOS"
     SET auth_user_id = v_uid,
         "email" = CASE
                     WHEN coalesce(btrim("email"), '') = ''
                     THEN (SELECT u.email FROM auth.users u WHERE u.id = v_uid)
                     ELSE "email"
                   END
   WHERE "ID" = v_emp."ID";

  RETURN jsonb_build_object('ok', true, 'vinculado', true, 'empregado', v_preview);

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sua conta já está vinculada a outro cadastro.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.vincular_meu_empregado(text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vincular_meu_empregado(text, text, boolean) TO authenticated;

-- ===== 20260618000003_portal_candidatura =====
-- =========================================================================
-- PORTAL PÚBLICO DE CANDIDATURA
--
-- Fluxo (rota pública, sem login): o colaborador escolhe a CIDADE que tem vaga,
-- vê as VAGAS daquela cidade, escolhe uma, envia o CURRÍCULO. O arquivo vai
-- para o Storage e a candidatura é gravada em WA_CURRICULOS (vaga_id), aparecendo
-- no card "Currículos" da solicitação no Recrutamento.
--
-- "Vaga disponível" = status 'Seleção de Currículos'.
--
-- Segurança: anon NÃO acessa as tabelas direto — só via RPCs SECURITY DEFINER
-- que expõem apenas campos seguros e validam a vaga. O upload do arquivo é a
-- única ação direta do anon, restrita ao bucket 'curriculos'.
--
-- Idempotente.
-- =========================================================================

-- CPF do candidato (novo campo).
ALTER TABLE public."WA_CURRICULOS" ADD COLUMN IF NOT EXISTS cpf_cand text;

-- Bucket privado para os currículos enviados pelo portal.
INSERT INTO storage.buckets (id, name, public)
VALUES ('curriculos', 'curriculos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage: anon pode ENVIAR (upload) só no bucket 'curriculos';
-- leitura/download fica para usuários autenticados (RH) via signed URL.
DROP POLICY IF EXISTS "curriculos_insert_publico" ON storage.objects;
CREATE POLICY "curriculos_insert_publico" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'curriculos');

DROP POLICY IF EXISTS "curriculos_select_auth" ON storage.objects;
CREATE POLICY "curriculos_select_auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'curriculos');

-- ── Cidades que têm vaga em 'Seleção de Currículos' ──────────────────────
CREATE OR REPLACE FUNCTION public.portal_cidades_com_vagas()
RETURNS TABLE (cidade text, vagas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT NULLIF(btrim("cidade"), '') AS cidade, count(*)::bigint AS vagas
  FROM public."SISTEMA_RECRUTAMENTO"
  WHERE "status" = 'Seleção de Currículos'
    AND NULLIF(btrim("cidade"), '') IS NOT NULL
  GROUP BY NULLIF(btrim("cidade"), '')
  ORDER BY 1;
$$;
REVOKE ALL ON FUNCTION public.portal_cidades_com_vagas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_cidades_com_vagas() TO anon, authenticated;

-- ── Vagas abertas de uma cidade ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.portal_vagas_por_cidade(p_cidade text)
RETURNS TABLE (
  id integer, cargo text, contrato text, cidade text,
  escala text, salario text, beneficios text, quantidade_vagas integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT "id", "cargo", "contrato", "cidade",
         "escala", "salario", "beneficios", "quantidade_vagas"
  FROM public."SISTEMA_RECRUTAMENTO"
  WHERE "status" = 'Seleção de Currículos'
    AND btrim(lower("cidade")) = btrim(lower(coalesce(p_cidade, '')))
  ORDER BY "cargo";
$$;
REVOKE ALL ON FUNCTION public.portal_vagas_por_cidade(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_vagas_por_cidade(text) TO anon, authenticated;

-- ── Registrar candidatura ────────────────────────────────────────────────
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

  -- Linha base com o vínculo da vaga + origem.
  INSERT INTO public."WA_CURRICULOS" (vaga_id, origem)
  VALUES (p_vaga_id, 'Portal')
  RETURNING id INTO v_id;

  -- Preenche cada campo na coluna que EXISTIR. O schema de WA_CURRICULOS varia
  -- entre ambientes (nome vs nome_cand, email vs email_cand, etc.), então
  -- gravamos no primeiro nome de coluna que existir de fato.
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

-- ===== 20260619000001_fix_portal_candidatar_colunas =====
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

-- ===== 20260619000002_recrutamento_blacklist_empregados =====
-- =========================================================================
-- RECRUTAMENTO: validação de CPF, e-mail obrigatório, cruzamento com
-- EMPREGADOS e lista negra (blacklist) de CPF.
--
-- 1. is_cpf_valido(text)        — valida dígitos verificadores do CPF.
-- 2. portal_candidatar          — passa a exigir e-mail e CPF válido.
-- 3. empregados_por_cpfs(text[])— lista os cadastros do candidato em EMPREGADOS.
-- 4. RECRUTAMENTO_CPF_BLACKLIST — lista negra de CPF + motivo.
--
-- Idempotente.
-- =========================================================================

-- 1) Validação de CPF (dígitos verificadores) ----------------------------
CREATE OR REPLACE FUNCTION public.is_cpf_valido(p_cpf text)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  c  text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  s  int;
  d1 int;
  d2 int;
  i  int;
BEGIN
  IF length(c) <> 11 THEN RETURN false; END IF;
  IF c ~ '^(\d)\1{10}$' THEN RETURN false; END IF;   -- todos os dígitos iguais
  s := 0;
  FOR i IN 1..9 LOOP s := s + substr(c, i, 1)::int * (11 - i); END LOOP;
  d1 := 11 - (s % 11); IF d1 >= 10 THEN d1 := 0; END IF;
  IF d1 <> substr(c, 10, 1)::int THEN RETURN false; END IF;
  s := 0;
  FOR i IN 1..10 LOOP s := s + substr(c, i, 1)::int * (12 - i); END LOOP;
  d2 := 11 - (s % 11); IF d2 >= 10 THEN d2 := 0; END IF;
  RETURN d2 = substr(c, 11, 1)::int;
END;
$$;

-- 2) portal_candidatar: exige e-mail e CPF válido -----------------------
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
  IF NOT public.is_cpf_valido(p_cpf) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CPF inválido.');
  END IF;
  IF coalesce(btrim(p_email), '') = '' OR position('@' in p_email) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Informe um e-mail válido.');
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

-- 3) Cadastros do candidato em EMPREGADOS (por CPF, casando por dígitos) --
CREATE OR REPLACE FUNCTION public.empregados_por_cpfs(p_cpfs text[])
RETURNS TABLE (
  cpf_match text, id bigint, nome text, cargo text, setor text, perfil text,
  lider text, situacao text, admissao text, empresa text, filial text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT regexp_replace(coalesce(e."CPF",''), '\D','','g') AS cpf_match,
         e."ID", e."Nome", e."Título do Cargo", e."Setor_ERP", e."Perfil_ERP",
         e."LIDER", e."Situação", e."Admissão", e."Nome da Empresa", e."Nome Filial"
  FROM public."EMPREGADOS" e
  WHERE regexp_replace(coalesce(e."CPF",''), '\D','','g') = ANY (
    SELECT regexp_replace(coalesce(x,''), '\D','','g')
    FROM unnest(p_cpfs) AS x
    WHERE coalesce(btrim(x),'') <> ''
  );
$$;
REVOKE ALL ON FUNCTION public.empregados_por_cpfs(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.empregados_por_cpfs(text[]) TO authenticated;

-- 4) Lista negra de CPF --------------------------------------------------
CREATE TABLE IF NOT EXISTS public."RECRUTAMENTO_CPF_BLACKLIST" (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cpf_digits text NOT NULL UNIQUE,
  cpf_fmt    text,
  motivo     text NOT NULL,
  criado_por text,
  criado_em  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public."RECRUTAMENTO_CPF_BLACKLIST" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."RECRUTAMENTO_CPF_BLACKLIST" TO authenticated;
DROP POLICY IF EXISTS rcb_all_auth ON public."RECRUTAMENTO_CPF_BLACKLIST";
CREATE POLICY rcb_all_auth ON public."RECRUTAMENTO_CPF_BLACKLIST"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

-- ===== 20260622000010_juridico_patrimonios =====
-- =========================================================================
-- JURÍDICO — Gestão Patrimonial e Obrigações
--
-- Tabelas:
--   JUR_PATRIMONIOS   — imóveis, veículos, terrenos, equipamentos...
--   JUR_OBRIGACOES    — despesas/obrigações por patrimônio (IPTU, energia,
--                       seguro, IPVA...) com vencimento, status e campos de seguro
--   JUR_DOCUMENTOS    — documentos anexados (escritura, apólice, CRLV...)
--   JUR_CONTATOS      — corretor, imobiliária, administradora, seguradora...
--   JUR_ACESSOS       — portais/sistemas: link, usuário e ONDE a senha está
--                       (por segurança NÃO guarda a senha)
--   JUR_HISTORICO     — movimentações (anexos, renovações, pagamentos...)
--
-- Bucket de Storage 'juridico-docs' (privado) para os documentos.
-- RLS: authenticated (padrão do app). Idempotente.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public."JUR_PATRIMONIOS" (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  codigo      text,
  tipo        text NOT NULL DEFAULT 'Imóvel',   -- Imóvel, Veículo, Terreno, Equipamento, Outros
  descricao   text NOT NULL,
  localizacao text,
  placa       text,
  cidade      text,
  empresa     text,
  responsavel text,
  centro_custo text,
  status      text NOT NULL DEFAULT 'Ativo',    -- Ativo / Inativo
  observacoes text,
  onde_pagar  text                              -- tipo 'Conta': URL do site de pagamento
);
-- garante a coluna mesmo se a tabela já existir
ALTER TABLE public."JUR_PATRIMONIOS" ADD COLUMN IF NOT EXISTS onde_pagar text;

CREATE TABLE IF NOT EXISTS public."JUR_OBRIGACOES" (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  patrimonio_id   bigint REFERENCES public."JUR_PATRIMONIOS"(id) ON DELETE CASCADE,
  categoria       text NOT NULL,                -- IPTU, Condomínio, Energia, Água, Internet, Seguro, Aluguel, IPVA, Licenciamento, Manutenção...
  descricao       text,
  valor           numeric,
  vencimento      date,
  periodicidade   text DEFAULT 'Mensal',        -- Mensal, Anual, Único, Trimestral...
  forma_pagamento text,                         -- Boleto, Débito em conta, Pix...
  responsavel     text,
  status          text NOT NULL DEFAULT 'Pendente',  -- Pendente, Pago, Vencido
  pago_em         date,
  -- seguro (categoria = 'Seguro')
  seguradora      text,
  apolice         text,
  vigencia_inicio date,
  vigencia_fim    date,
  premio          numeric,
  parcelas        text
);

CREATE TABLE IF NOT EXISTS public."JUR_DOCUMENTOS" (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now(),
  patrimonio_id bigint REFERENCES public."JUR_PATRIMONIOS"(id) ON DELETE CASCADE,
  tipo          text,        -- Escritura, Matrícula, Contrato, IPTU, Apólice, CRLV, NF, Laudo...
  nome          text,
  storage_path  text,
  versao        int DEFAULT 1,
  criado_por    text
);

CREATE TABLE IF NOT EXISTS public."JUR_CONTATOS" (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now(),
  patrimonio_id bigint REFERENCES public."JUR_PATRIMONIOS"(id) ON DELETE CASCADE,
  tipo          text,        -- Corretor, Imobiliária, Administradora, Seguradora...
  nome          text,
  telefone      text,
  email         text,
  observacao    text
);

CREATE TABLE IF NOT EXISTS public."JUR_ACESSOS" (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now(),
  patrimonio_id bigint REFERENCES public."JUR_PATRIMONIOS"(id) ON DELETE CASCADE,
  servico       text,        -- Energia, Condomínio, Seguro, Água...
  link          text,
  usuario       text,
  local_senha   text,        -- ONDE a senha está guardada (Cofre, TI...) — nunca a senha
  observacao    text
);

CREATE TABLE IF NOT EXISTS public."JUR_HISTORICO" (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now(),
  patrimonio_id bigint REFERENCES public."JUR_PATRIMONIOS"(id) ON DELETE CASCADE,
  acao          text NOT NULL,
  detalhe       text,
  autor         text
);

CREATE INDEX IF NOT EXISTS jur_obr_pat_idx  ON public."JUR_OBRIGACOES"(patrimonio_id);
CREATE INDEX IF NOT EXISTS jur_obr_venc_idx ON public."JUR_OBRIGACOES"(vencimento);
CREATE INDEX IF NOT EXISTS jur_doc_pat_idx  ON public."JUR_DOCUMENTOS"(patrimonio_id);
CREATE INDEX IF NOT EXISTS jur_cont_pat_idx ON public."JUR_CONTATOS"(patrimonio_id);
CREATE INDEX IF NOT EXISTS jur_acc_pat_idx  ON public."JUR_ACESSOS"(patrimonio_id);
CREATE INDEX IF NOT EXISTS jur_hist_pat_idx ON public."JUR_HISTORICO"(patrimonio_id);

-- RLS: liberado para authenticated (padrão do app; controle fino fica no painel de acessos).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['JUR_PATRIMONIOS','JUR_OBRIGACOES','JUR_DOCUMENTOS','JUR_CONTATOS','JUR_ACESSOS','JUR_HISTORICO'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all_auth', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t || '_all_auth', t);
  END LOOP;
END $$;

-- Bucket privado para documentos do patrimônio.
INSERT INTO storage.buckets (id, name, public)
VALUES ('juridico-docs', 'juridico-docs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "jur_docs_rw_auth" ON storage.objects;
CREATE POLICY "jur_docs_rw_auth" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'juridico-docs') WITH CHECK (bucket_id = 'juridico-docs');

NOTIFY pgrst, 'reload schema';

-- ===== 20260622000011_jur_contas =====
-- =========================================================================
-- JURÍDICO — Submódulo CONTAS (recorrentes) + lançamentos por mês
--
-- JUR_CONTAS            — conta-mestra (água, luz, internet...): onde pagar,
--                         recorrência (a cada 7/15/20/30 dias), valor de ref.
-- JUR_CONTA_LANCAMENTOS — ocorrência por competência (mês), com status próprio
--                         (Pendente / Pago / Vencido). UNIQUE(conta_id,vencimento)
--                         permite gerar o mês sem duplicar.
-- Idempotente.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public."JUR_CONTAS" (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  patrimonio_id      bigint REFERENCES public."JUR_PATRIMONIOS"(id) ON DELETE CASCADE,
  descricao          text NOT NULL,
  categoria          text,                 -- Água, Luz, Internet, Aluguel...
  empresa            text,
  responsavel        text,
  onde_pagar         text,                 -- URL do site de pagamento
  possui_recorrencia boolean NOT NULL DEFAULT false,
  intervalo_dias     int,                  -- 7, 15, 20, 30 (quando recorrente)
  data_inicio        date,                 -- referência p/ gerar ocorrências / 1º vencimento
  valor              numeric,
  status             text NOT NULL DEFAULT 'Ativo',  -- Ativo / Inativo
  observacoes        text
);

CREATE TABLE IF NOT EXISTS public."JUR_CONTA_LANCAMENTOS" (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  conta_id    bigint REFERENCES public."JUR_CONTAS"(id) ON DELETE CASCADE,
  competencia text,                        -- 'YYYY-MM'
  vencimento  date,
  valor       numeric,
  status      text NOT NULL DEFAULT 'Pendente',  -- Pendente, Pago, Vencido
  pago_em     date,
  UNIQUE (conta_id, vencimento)
);

CREATE INDEX IF NOT EXISTS jur_clanc_conta_idx ON public."JUR_CONTA_LANCAMENTOS"(conta_id);
CREATE INDEX IF NOT EXISTS jur_clanc_comp_idx  ON public."JUR_CONTA_LANCAMENTOS"(competencia);

-- Contas vinculadas ao patrimônio (garante a coluna mesmo se a tabela já existir).
ALTER TABLE public."JUR_CONTAS" ADD COLUMN IF NOT EXISTS patrimonio_id bigint REFERENCES public."JUR_PATRIMONIOS"(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS jur_contas_pat_idx ON public."JUR_CONTAS"(patrimonio_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['JUR_CONTAS','JUR_CONTA_LANCAMENTOS'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all_auth', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t || '_all_auth', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- JURÍDICO — Comentários por patrimônio: usam o feed único SISTEMA_COMENTARIOS
-- (modulo='patrimonio'), criado no bloco de consolidação (016) mais abaixo.
-- A antiga JUR_COMENTARIOS não é mais criada (ver 20260710000001).
-- =========================================================================

-- =========================================================================
-- JURÍDICO — Patrimônio: novos campos + fusão Contas → Obrigações
-- =========================================================================
ALTER TABLE public."JUR_PATRIMONIOS" ADD COLUMN IF NOT EXISTS transferida      boolean NOT NULL DEFAULT false;
ALTER TABLE public."JUR_PATRIMONIOS" ADD COLUMN IF NOT EXISTS proprietario     text;
ALTER TABLE public."JUR_PATRIMONIOS" ADD COLUMN IF NOT EXISTS empresa_pagadora text;

INSERT INTO public."JUR_OBRIGACOES"
  (patrimonio_id, categoria, descricao, valor, vencimento, periodicidade, responsavel, status, created_at)
SELECT
  c.patrimonio_id,
  COALESCE(NULLIF(btrim(c.categoria), ''), 'Outros'),
  c.descricao, c.valor, c.data_inicio,
  CASE WHEN c.possui_recorrencia THEN 'Mensal' ELSE 'Único' END,
  c.responsavel, 'Pendente', c.created_at
FROM public."JUR_CONTAS" c
WHERE c.patrimonio_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public."JUR_OBRIGACOES" o
    WHERE o.patrimonio_id = c.patrimonio_id
      AND COALESCE(o.descricao, '') = COALESCE(c.descricao, '')
      AND o.categoria = COALESCE(NULLIF(btrim(c.categoria), ''), 'Outros')
      AND o.valor IS NOT DISTINCT FROM c.valor
  );

NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- JURÍDICO — Central de Dúvidas Jurídicas (base de conhecimento Q&A)
-- Todos perguntam/leem; só Jurídico (Trabalhando) responde (via is_juridico_ativo).
-- =========================================================================
CREATE OR REPLACE FUNCTION public.is_juridico_ativo()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."EMPREGADOS" e
    WHERE e.auth_user_id = auth.uid()
      AND e."Setor_ERP" = 'JURIDICO'
      AND e."Situação"  = 'Trabalhando'
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_juridico_ativo() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_juridico_ativo() FROM anon;
GRANT  EXECUTE ON FUNCTION public.is_juridico_ativo() TO authenticated;

CREATE TABLE IF NOT EXISTS public."JUR_DUVIDAS" (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  autor_id       uuid DEFAULT auth.uid(),
  autor_nome     text,
  titulo         text NOT NULL,
  pergunta       text NOT NULL,
  categoria      text,
  status         text NOT NULL DEFAULT 'Aberta',
  resposta       text,
  respondido_por text,
  respondido_em  timestamptz,
  publicada      boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS jur_duvidas_status_idx ON public."JUR_DUVIDAS"(status);
CREATE INDEX IF NOT EXISTS jur_duvidas_autor_idx  ON public."JUR_DUVIDAS"(autor_id);
CREATE INDEX IF NOT EXISTS jur_duvidas_criado_idx ON public."JUR_DUVIDAS"(created_at DESC);
ALTER TABLE public."JUR_DUVIDAS" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."JUR_DUVIDAS" TO authenticated;
DROP POLICY IF EXISTS jur_duvidas_select ON public."JUR_DUVIDAS";
CREATE POLICY jur_duvidas_select ON public."JUR_DUVIDAS" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS jur_duvidas_insert ON public."JUR_DUVIDAS";
CREATE POLICY jur_duvidas_insert ON public."JUR_DUVIDAS" FOR INSERT TO authenticated WITH CHECK (autor_id = auth.uid());
DROP POLICY IF EXISTS jur_duvidas_update ON public."JUR_DUVIDAS";
CREATE POLICY jur_duvidas_update ON public."JUR_DUVIDAS" FOR UPDATE TO authenticated USING (public.is_juridico_ativo()) WITH CHECK (public.is_juridico_ativo());
DROP POLICY IF EXISTS jur_duvidas_delete ON public."JUR_DUVIDAS";
CREATE POLICY jur_duvidas_delete ON public."JUR_DUVIDAS" FOR DELETE TO authenticated USING (public.is_juridico_ativo());

NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- JURÍDICO — Sistema de Processos (RLS/grants das tabelas migradas do Flask)
-- Leitura: autenticados; escrita: só Jurídico (is_juridico_ativo).
-- Comentários de processo usam o feed único SISTEMA_COMENTARIOS
-- (modulo='processo'); a antiga SISTEMA_JURIDICO_COMENTARIOS não é mais
-- criada (ver 20260710000001).
-- =========================================================================
DO $$
DECLARE t text; seqname text;
BEGIN
  FOREACH t IN ARRAY ARRAY['SISTEMA_JURIDICORT','SISTEMA_JURIDICORT_dort'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
      seqname := pg_get_serial_sequence('public."'||t||'"', 'id');
      IF seqname IS NOT NULL THEN
        EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO authenticated', seqname);
      END IF;
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_select', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_write', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_all_auth', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t||'_all_auth', t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- CONSOLIDAÇÃO E RENOMEAÇÃO DE TABELAS (016)
--   1. Dropa mortas JUR_CONTAS / JUR_CONTA_LANCAMENTOS (já fundidas em Obrigações).
--   2. SISTEMA_COMENTARIOS = feed único (patrimônio/processo/férias/bonif) + drop dos 4.
--   3. Renomeia filhas de patrimônio -> JUR_PATRIMONIO_* e Flask -> JUR_PROCESSOS*.
-- Idempotente. Renames via to_regclass; backfill some ao re-rodar (origens dropadas).
-- =========================================================================

-- 1. Contas (mortas) → Obrigações, depois drop ----------------------------
DO $$
BEGIN
  IF to_regclass('public."JUR_CONTAS"') IS NOT NULL
     AND to_regclass('public."JUR_OBRIGACOES"') IS NOT NULL THEN
    INSERT INTO public."JUR_OBRIGACOES"
      (patrimonio_id, categoria, descricao, valor, vencimento, periodicidade, responsavel, status, created_at)
    SELECT c.patrimonio_id, COALESCE(NULLIF(btrim(c.categoria), ''), 'Outros'),
           c.descricao, c.valor, c.data_inicio,
           CASE WHEN c.possui_recorrencia THEN 'Mensal' ELSE 'Único' END,
           c.responsavel, 'Pendente', c.created_at
    FROM public."JUR_CONTAS" c
    WHERE c.patrimonio_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public."JUR_OBRIGACOES" o
        WHERE o.patrimonio_id = c.patrimonio_id
          AND COALESCE(o.descricao, '') = COALESCE(c.descricao, '')
          AND o.categoria = COALESCE(NULLIF(btrim(c.categoria), ''), 'Outros')
          AND o.valor IS NOT DISTINCT FROM c.valor);
  END IF;
END $$;
DROP TABLE IF EXISTS public."JUR_CONTA_LANCAMENTOS";
DROP TABLE IF EXISTS public."JUR_CONTAS";

-- 2. Feed único de comentários --------------------------------------------
CREATE TABLE IF NOT EXISTS public."SISTEMA_COMENTARIOS" (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  modulo      text NOT NULL,
  entidade_id text NOT NULL,
  autor_nome  text,
  autor_cpf   text,
  texto       text NOT NULL
);
CREATE INDEX IF NOT EXISTS sistema_coment_ent_idx ON public."SISTEMA_COMENTARIOS"(modulo, entidade_id);

DO $$
BEGIN
  IF to_regclass('public."JUR_COMENTARIOS"') IS NOT NULL THEN
    INSERT INTO public."SISTEMA_COMENTARIOS" (modulo, entidade_id, autor_nome, texto, created_at)
    SELECT 'patrimonio', c.patrimonio_id::text, c.autor, c.texto, c.created_at
      FROM public."JUR_COMENTARIOS" c WHERE c.patrimonio_id IS NOT NULL;
    DROP TABLE public."JUR_COMENTARIOS";
  END IF;
  IF to_regclass('public."SISTEMA_JURIDICO_COMENTARIOS"') IS NOT NULL THEN
    INSERT INTO public."SISTEMA_COMENTARIOS" (modulo, entidade_id, autor_nome, texto, created_at)
    SELECT 'processo', c.numero_processo, c.autor, c.comentario, c.criado_em
      FROM public."SISTEMA_JURIDICO_COMENTARIOS" c WHERE c.numero_processo IS NOT NULL;
    DROP TABLE public."SISTEMA_JURIDICO_COMENTARIOS";
  END IF;
  IF to_regclass('public."SISTEMA_SOL_FERIAS_CHAT"') IS NOT NULL THEN
    INSERT INTO public."SISTEMA_COMENTARIOS" (modulo, entidade_id, autor_nome, autor_cpf, texto, created_at)
    SELECT 'ferias', c.solicitacao_id::text, c.autor_nome, c.autor_cpf, c.mensagem, c.criado_em
      FROM public."SISTEMA_SOL_FERIAS_CHAT" c WHERE c.solicitacao_id IS NOT NULL;
    DROP TABLE public."SISTEMA_SOL_FERIAS_CHAT";
  END IF;
  IF to_regclass('public."SISTEMA_SOL_BONIF_CHAT"') IS NOT NULL THEN
    INSERT INTO public."SISTEMA_COMENTARIOS" (modulo, entidade_id, autor_nome, autor_cpf, texto, created_at)
    SELECT 'bonificacao', c.solicitacao_id::text, c.autor_nome, c.autor_cpf, c.mensagem, c.criado_em
      FROM public."SISTEMA_SOL_BONIF_CHAT" c WHERE c.solicitacao_id IS NOT NULL;
    DROP TABLE public."SISTEMA_SOL_BONIF_CHAT";
  END IF;
END $$;

ALTER TABLE public."SISTEMA_COMENTARIOS" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."SISTEMA_COMENTARIOS" TO authenticated;
DROP POLICY IF EXISTS "SISTEMA_COMENTARIOS_all_auth" ON public."SISTEMA_COMENTARIOS";
CREATE POLICY "SISTEMA_COMENTARIOS_all_auth" ON public."SISTEMA_COMENTARIOS"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Renomeia tabelas p/ nomes autoexplicativos ---------------------------
DO $$
BEGIN
  IF to_regclass('public."JUR_OBRIGACOES"') IS NOT NULL AND to_regclass('public."JUR_PATRIMONIO_OBRIGACOES"') IS NULL THEN
    ALTER TABLE public."JUR_OBRIGACOES" RENAME TO "JUR_PATRIMONIO_OBRIGACOES";
    DROP POLICY IF EXISTS "JUR_OBRIGACOES_all_auth" ON public."JUR_PATRIMONIO_OBRIGACOES";
  END IF;
  IF to_regclass('public."JUR_DOCUMENTOS"') IS NOT NULL AND to_regclass('public."JUR_PATRIMONIO_DOCUMENTOS"') IS NULL THEN
    ALTER TABLE public."JUR_DOCUMENTOS" RENAME TO "JUR_PATRIMONIO_DOCUMENTOS";
    DROP POLICY IF EXISTS "JUR_DOCUMENTOS_all_auth" ON public."JUR_PATRIMONIO_DOCUMENTOS";
  END IF;
  IF to_regclass('public."JUR_CONTATOS"') IS NOT NULL AND to_regclass('public."JUR_PATRIMONIO_CONTATOS"') IS NULL THEN
    ALTER TABLE public."JUR_CONTATOS" RENAME TO "JUR_PATRIMONIO_CONTATOS";
    DROP POLICY IF EXISTS "JUR_CONTATOS_all_auth" ON public."JUR_PATRIMONIO_CONTATOS";
  END IF;
  IF to_regclass('public."JUR_ACESSOS"') IS NOT NULL AND to_regclass('public."JUR_PATRIMONIO_ACESSOS"') IS NULL THEN
    ALTER TABLE public."JUR_ACESSOS" RENAME TO "JUR_PATRIMONIO_ACESSOS";
    DROP POLICY IF EXISTS "JUR_ACESSOS_all_auth" ON public."JUR_PATRIMONIO_ACESSOS";
  END IF;
  IF to_regclass('public."JUR_HISTORICO"') IS NOT NULL AND to_regclass('public."JUR_PATRIMONIO_HISTORICO"') IS NULL THEN
    ALTER TABLE public."JUR_HISTORICO" RENAME TO "JUR_PATRIMONIO_HISTORICO";
    DROP POLICY IF EXISTS "JUR_HISTORICO_all_auth" ON public."JUR_PATRIMONIO_HISTORICO";
  END IF;
  IF to_regclass('public."SISTEMA_JURIDICORT"') IS NOT NULL AND to_regclass('public."JUR_PROCESSOS"') IS NULL THEN
    ALTER TABLE public."SISTEMA_JURIDICORT" RENAME TO "JUR_PROCESSOS";
    DROP POLICY IF EXISTS "SISTEMA_JURIDICORT_all_auth" ON public."JUR_PROCESSOS";
  END IF;
  IF to_regclass('public."SISTEMA_JURIDICORT_dort"') IS NOT NULL AND to_regclass('public."JUR_PROCESSOS_DORT"') IS NULL THEN
    ALTER TABLE public."SISTEMA_JURIDICORT_dort" RENAME TO "JUR_PROCESSOS_DORT";
    DROP POLICY IF EXISTS "SISTEMA_JURIDICORT_dort_all_auth" ON public."JUR_PROCESSOS_DORT";
  END IF;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'JUR_PATRIMONIO_OBRIGACOES','JUR_PATRIMONIO_DOCUMENTOS','JUR_PATRIMONIO_CONTATOS',
    'JUR_PATRIMONIO_ACESSOS','JUR_PATRIMONIO_HISTORICO','JUR_PROCESSOS','JUR_PROCESSOS_DORT'
  ] LOOP
    IF to_regclass('public."'||t||'"') IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all_auth', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t || '_all_auth', t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- JURÍDICO — Patrimônio: funde 4 filhas-sidecar em JUR_PATRIMONIO_ITENS (017)
--   CONTATOS + ACESSOS + DOCUMENTOS + HISTORICO -> 1 tabela (coluna `kind`).
--   OBRIGACOES fica separada (núcleo financeiro). Filhas de patrimônio: 5 -> 2.
-- Idempotente: backfill some ao re-rodar (origens dropadas).
-- =========================================================================
CREATE TABLE IF NOT EXISTS public."JUR_PATRIMONIO_ITENS" (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now(),
  patrimonio_id bigint REFERENCES public."JUR_PATRIMONIOS"(id) ON DELETE CASCADE,
  kind          text NOT NULL,        -- 'contato' | 'acesso' | 'documento' | 'historico'
  tipo          text, nome text, telefone text, email text, observacao text,
  servico       text, link text, usuario text, local_senha text,
  storage_path  text, versao int, criado_por text,
  acao          text, detalhe text, autor text
);
CREATE INDEX IF NOT EXISTS jur_pat_itens_idx ON public."JUR_PATRIMONIO_ITENS"(patrimonio_id, kind);

DO $$
BEGIN
  IF to_regclass('public."JUR_PATRIMONIO_CONTATOS"') IS NOT NULL THEN
    INSERT INTO public."JUR_PATRIMONIO_ITENS" (patrimonio_id, kind, tipo, nome, telefone, email, observacao, created_at)
    SELECT patrimonio_id, 'contato', tipo, nome, telefone, email, observacao, created_at FROM public."JUR_PATRIMONIO_CONTATOS";
    DROP TABLE public."JUR_PATRIMONIO_CONTATOS";
  END IF;
  IF to_regclass('public."JUR_PATRIMONIO_ACESSOS"') IS NOT NULL THEN
    INSERT INTO public."JUR_PATRIMONIO_ITENS" (patrimonio_id, kind, servico, link, usuario, local_senha, observacao, created_at)
    SELECT patrimonio_id, 'acesso', servico, link, usuario, local_senha, observacao, created_at FROM public."JUR_PATRIMONIO_ACESSOS";
    DROP TABLE public."JUR_PATRIMONIO_ACESSOS";
  END IF;
  IF to_regclass('public."JUR_PATRIMONIO_DOCUMENTOS"') IS NOT NULL THEN
    INSERT INTO public."JUR_PATRIMONIO_ITENS" (patrimonio_id, kind, tipo, nome, storage_path, versao, criado_por, created_at)
    SELECT patrimonio_id, 'documento', tipo, nome, storage_path, versao, criado_por, created_at FROM public."JUR_PATRIMONIO_DOCUMENTOS";
    DROP TABLE public."JUR_PATRIMONIO_DOCUMENTOS";
  END IF;
  IF to_regclass('public."JUR_PATRIMONIO_HISTORICO"') IS NOT NULL THEN
    INSERT INTO public."JUR_PATRIMONIO_ITENS" (patrimonio_id, kind, acao, detalhe, autor, created_at)
    SELECT patrimonio_id, 'historico', acao, detalhe, autor, created_at FROM public."JUR_PATRIMONIO_HISTORICO";
    DROP TABLE public."JUR_PATRIMONIO_HISTORICO";
  END IF;
END $$;

ALTER TABLE public."JUR_PATRIMONIO_ITENS" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."JUR_PATRIMONIO_ITENS" TO authenticated;
DROP POLICY IF EXISTS "JUR_PATRIMONIO_ITENS_all_auth" ON public."JUR_PATRIMONIO_ITENS";
CREATE POLICY "JUR_PATRIMONIO_ITENS_all_auth" ON public."JUR_PATRIMONIO_ITENS"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- JURÍDICO — Processos: colunas de valor bigint/integer -> numeric (018)
--   (guardam centavos; bigint quebrava carga e gravação pela tela). Idempotente.
-- =========================================================================
DO $$
DECLARE c text;
BEGIN
  IF to_regclass('public."JUR_PROCESSOS"') IS NOT NULL THEN
    FOREACH c IN ARRAY ARRAY[
      'valor_pericia_empresa','valor_pedidos','valor_acordo','valor_sentenca','valor_final',
      'valor_deposito_recursal','valor_seguro_garantia','valor_custas_processuais',
      'valor_pericia_contabil','valor_outros_custos','demais_encargos','valor_causa'
    ] LOOP
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='JUR_PROCESSOS'
          AND column_name=c AND data_type IN ('bigint','integer')
      ) THEN
        EXECUTE format('ALTER TABLE public."JUR_PROCESSOS" ALTER COLUMN %I TYPE numeric USING %I::numeric', c, c);
      END IF;
    END LOOP;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- JURÍDICO — Processos: PK no surrogate id (identity); "ID" vira coluna comum (019)
--
-- Veio do Flask com a PK na coluna legada "ID", mas o modelo é "1 linha por
-- motivo" (mesmo processo em várias linhas, "ID" repetido/NULL). A PK real é
-- id (minúsculo, identity) — por onde o app ordena/deduplica. Sem isso o seed
-- estourava (duplicate key / null em id). O reload no fim é obrigatório: sem
-- ele a tela fica vazia (load() engole o erro do schema cache velho). Idempotente.
-- =========================================================================
DO $$
DECLARE
  v_pk   text;
  v_base bigint;
  v_max  bigint;
BEGIN
  IF to_regclass('public."JUR_PROCESSOS"') IS NULL THEN
    RETURN;
  END IF;

  -- 1) Coluna surrogate id.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='JUR_PROCESSOS' AND column_name='id'
  ) THEN
    EXECUTE 'ALTER TABLE public."JUR_PROCESSOS" ADD COLUMN id bigint';
  END IF;

  -- 2) Backfill de ids nulos (acima do maior id já existente).
  SELECT COALESCE(max(id), 0) INTO v_base FROM public."JUR_PROCESSOS" WHERE id IS NOT NULL;
  EXECUTE format($f$
    UPDATE public."JUR_PROCESSOS" p
       SET id = s.rn
      FROM (
        SELECT ctid, %s + row_number() OVER (ORDER BY ctid) AS rn
          FROM public."JUR_PROCESSOS" WHERE id IS NULL
      ) s
     WHERE p.ctid = s.ctid
  $f$, v_base);

  -- 3) Remove a PRIMARY KEY atual se ela NÃO for exatamente (id).
  SELECT conname INTO v_pk FROM pg_constraint
   WHERE conrelid='public."JUR_PROCESSOS"'::regclass AND contype='p';
  IF v_pk IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_attribute a ON a.attrelid=con.conrelid AND a.attnum = ANY (con.conkey)
    WHERE con.conname=v_pk AND con.conrelid='public."JUR_PROCESSOS"'::regclass
      AND a.attname='id' AND array_length(con.conkey,1)=1
  ) THEN
    EXECUTE format('ALTER TABLE public."JUR_PROCESSOS" DROP CONSTRAINT %I', v_pk);
  END IF;

  -- 4) "ID" legado vira coluna comum, anulável.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='JUR_PROCESSOS' AND column_name='ID'
  ) THEN
    EXECUTE 'ALTER TABLE public."JUR_PROCESSOS" ALTER COLUMN "ID" DROP NOT NULL';
  END IF;

  -- 5) id NOT NULL + IDENTITY.
  EXECUTE 'ALTER TABLE public."JUR_PROCESSOS" ALTER COLUMN id SET NOT NULL';
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='JUR_PROCESSOS'
      AND column_name='id' AND is_identity='YES'
  ) THEN
    EXECUTE 'ALTER TABLE public."JUR_PROCESSOS" ALTER COLUMN id DROP DEFAULT';
    EXECUTE 'ALTER TABLE public."JUR_PROCESSOS" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY';
  END IF;

  -- 6) id como PRIMARY KEY (se ainda não houver PK).
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public."JUR_PROCESSOS"'::regclass AND contype='p'
  ) THEN
    EXECUTE 'ALTER TABLE public."JUR_PROCESSOS" ADD PRIMARY KEY (id)';
  END IF;

  -- 7) Sequência da identity acima do maior id (evita colisão em INSERT futuro).
  SELECT COALESCE(max(id), 0) INTO v_max FROM public."JUR_PROCESSOS";
  PERFORM setval(pg_get_serial_sequence('public."JUR_PROCESSOS"','id'), v_max + 1, false);
END $$;

ALTER TABLE public."JUR_PROCESSOS" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."JUR_PROCESSOS" TO authenticated;
DROP POLICY IF EXISTS "JUR_PROCESSOS_all_auth" ON public."JUR_PROCESSOS";
CREATE POLICY "JUR_PROCESSOS_all_auth" ON public."JUR_PROCESSOS"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- JURÍDICO — Gestão de Advertências (020): solicitação → aprovação → jurídico
--   Encarregado cria → 'Aguardando Aprovação' → analista do contrato aprova/
--   reprova → 'Aguardando Jurídico' | 'Reprovada' → Jurídico conclui →
--   'Concluída'. Colaborador obrigatório (EMPREGADOS). Idempotente.
-- =========================================================================
CREATE TABLE IF NOT EXISTS public."SISTEMA_SOLICITACOES_ADVERTENCIA" (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  status_changed_at   timestamptz NOT NULL DEFAULT now(),
  solicitante_nome    text,
  solicitante_email   text,
  colaborador_id      bigint,
  colaborador_nome    text NOT NULL,
  colaborador_cpf     text,
  colaborador_cargo   text,
  colaborador_filial  text,
  contrato            text,
  contrato_id         bigint,
  tipo_advertencia        text,
  grau                    text,
  descricao_ocorrido      text,
  data_ocorrido           date,
  ja_advertencia_anterior boolean NOT NULL DEFAULT false,
  detalhe_anterior        text,
  advertencia_verbal_dada boolean NOT NULL DEFAULT false,
  data_advertencia_verbal date,
  status              text NOT NULL DEFAULT 'Aguardando Aprovação',
  aprovado_por_nome   text,
  motivo_reprovacao   text,
  parecer_juridico    text,
  resultado           text,
  concluido_por_nome  text
);
CREATE INDEX IF NOT EXISTS adv_status_idx      ON public."SISTEMA_SOLICITACOES_ADVERTENCIA"(status);
CREATE INDEX IF NOT EXISTS adv_contrato_idx    ON public."SISTEMA_SOLICITACOES_ADVERTENCIA"(contrato_id);
CREATE INDEX IF NOT EXISTS adv_solicitante_idx ON public."SISTEMA_SOLICITACOES_ADVERTENCIA"(solicitante_email);
CREATE INDEX IF NOT EXISTS adv_criado_idx      ON public."SISTEMA_SOLICITACOES_ADVERTENCIA"(created_at DESC);

CREATE OR REPLACE FUNCTION public.adv_track_status_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_adv_track_status ON public."SISTEMA_SOLICITACOES_ADVERTENCIA";
CREATE TRIGGER trg_adv_track_status
  BEFORE UPDATE ON public."SISTEMA_SOLICITACOES_ADVERTENCIA"
  FOR EACH ROW EXECUTE FUNCTION public.adv_track_status_change();

ALTER TABLE public."SISTEMA_SOLICITACOES_ADVERTENCIA" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."SISTEMA_SOLICITACOES_ADVERTENCIA" TO authenticated;
DROP POLICY IF EXISTS "SISTEMA_SOLICITACOES_ADVERTENCIA_all_auth" ON public."SISTEMA_SOLICITACOES_ADVERTENCIA";
CREATE POLICY "SISTEMA_SOLICITACOES_ADVERTENCIA_all_auth" ON public."SISTEMA_SOLICITACOES_ADVERTENCIA"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- ORIENTAÇÕES JURÍDICAS (021): aprovação (Diretor Administrativo/aprovadores)
--   antes do Jurídico responder. Biblioteca pública sem nome de quem perguntou.
-- =========================================================================
ALTER TABLE public."JUR_DUVIDAS" ADD COLUMN IF NOT EXISTS aprovado_por      text;
ALTER TABLE public."JUR_DUVIDAS" ADD COLUMN IF NOT EXISTS aprovado_em       timestamptz;
ALTER TABLE public."JUR_DUVIDAS" ADD COLUMN IF NOT EXISTS motivo_reprovacao text;

CREATE TABLE IF NOT EXISTS public."JUR_DUVIDAS_APROVADORES" (
  empregado_id bigint PRIMARY KEY,
  nome         text,
  criado_por   text,
  criado_em    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public."JUR_DUVIDAS_APROVADORES" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."JUR_DUVIDAS_APROVADORES" TO authenticated;
DROP POLICY IF EXISTS jur_duvidas_aprov_all ON public."JUR_DUVIDAS_APROVADORES";
CREATE POLICY jur_duvidas_aprov_all ON public."JUR_DUVIDAS_APROVADORES"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.pode_aprovar_duvida()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."EMPREGADOS" e
    WHERE e.auth_user_id = auth.uid()
      AND e."Situação" = 'Trabalhando'
      AND ( e."Setor_ERP" = 'DIRETOR ADMINISTRATIVO'
            OR EXISTS (SELECT 1 FROM public."JUR_DUVIDAS_APROVADORES" a WHERE a.empregado_id = e."ID") )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.pode_aprovar_duvida() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pode_aprovar_duvida() TO authenticated;

DROP POLICY IF EXISTS jur_duvidas_update ON public."JUR_DUVIDAS";
CREATE POLICY jur_duvidas_update ON public."JUR_DUVIDAS" FOR UPDATE TO authenticated
  USING (public.is_juridico_ativo() OR public.pode_aprovar_duvida())
  WITH CHECK (public.is_juridico_ativo() OR public.pode_aprovar_duvida());

NOTIFY pgrst, 'reload schema';


-- =========================================================================
-- JURÍDICO — Obrigações: caminho para pagar + comprovante (022). Idempotente.
-- =========================================================================
ALTER TABLE public."JUR_PATRIMONIO_OBRIGACOES" ADD COLUMN IF NOT EXISTS onde_pagar       text;
ALTER TABLE public."JUR_PATRIMONIO_OBRIGACOES" ADD COLUMN IF NOT EXISTS comprovante_path text;
ALTER TABLE public."JUR_PATRIMONIO_OBRIGACOES" ADD COLUMN IF NOT EXISTS comprovante_nome text;
NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- JURÍDICO — Advertências: exceção de prazo (024). Idempotente.
-- =========================================================================
ALTER TABLE public."SISTEMA_SOLICITACOES_ADVERTENCIA" ADD COLUMN IF NOT EXISTS excecao               boolean NOT NULL DEFAULT false;
ALTER TABLE public."SISTEMA_SOLICITACOES_ADVERTENCIA" ADD COLUMN IF NOT EXISTS justificativa_excecao text;
NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- RH — Colaboradores: UPDATE de campos RH na EMPREGADOS (025). Idempotente.
-- =========================================================================
ALTER TABLE public."EMPREGADOS" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empregados_update_rh ON public."EMPREGADOS";
CREATE POLICY empregados_update_rh ON public."EMPREGADOS"
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- ORIENTAÇÕES JURÍDICAS — respondedores configuráveis (003). Idempotente.
-- Admin (Parecer Jurídico) define pessoas que respondem ALÉM do setor JURIDICO.
-- =========================================================================
CREATE TABLE IF NOT EXISTS public."JUR_DUVIDAS_RESPONSAVEIS" (
  empregado_id bigint PRIMARY KEY,
  nome         text,
  criado_por   text,
  criado_em    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public."JUR_DUVIDAS_RESPONSAVEIS" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."JUR_DUVIDAS_RESPONSAVEIS" TO authenticated;
DROP POLICY IF EXISTS jur_duvidas_resp_all ON public."JUR_DUVIDAS_RESPONSAVEIS";
CREATE POLICY jur_duvidas_resp_all ON public."JUR_DUVIDAS_RESPONSAVEIS"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.pode_responder_duvida()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."EMPREGADOS" e
    WHERE e.auth_user_id = auth.uid()
      AND e."Situação" = 'Trabalhando'
      AND ( e."Setor_ERP" = 'JURIDICO'
            OR EXISTS (SELECT 1 FROM public."JUR_DUVIDAS_RESPONSAVEIS" r WHERE r.empregado_id = e."ID") )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.pode_responder_duvida() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pode_responder_duvida() TO authenticated;

DROP POLICY IF EXISTS jur_duvidas_update ON public."JUR_DUVIDAS";
CREATE POLICY jur_duvidas_update ON public."JUR_DUVIDAS" FOR UPDATE TO authenticated
  USING (public.pode_responder_duvida() OR public.pode_aprovar_duvida())
  WITH CHECK (public.pode_responder_duvida() OR public.pode_aprovar_duvida());

DROP POLICY IF EXISTS jur_duvidas_delete ON public."JUR_DUVIDAS";
CREATE POLICY jur_duvidas_delete ON public."JUR_DUVIDAS" FOR DELETE TO authenticated
  USING (public.pode_responder_duvida());

NOTIFY pgrst, 'reload schema';


-- =========================================================================
-- 20260630000001_recrutamento_fluxo_candidatos.sql
-- =========================================================================
-- =========================================================================
-- RECRUTAMENTO: novo fluxo em 2 níveis
--
-- 1. Solicitação (board externo) — fluxo curto:
--    Pendente Operacional → Pendente Recrutamento → Seleção de Candidato
--    → Concluída (manual) ; Reprovada continua existindo.
--
-- 2. Candidato (kanban interno por solicitação) — anda dentro de WA_CURRICULOS:
--    Selecionado → Pendente Jurídico → ASO → Admissão ; estado Reprovado.
--    Jurídico e SST têm fila própria via VW_RECRUTAMENTO_CANDIDATOS.
--
-- O portal público continua publicando as vagas que estão em 'Seleção de Candidato'.
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- =========================================================================

-- ── 1a. Renomear/consolidar status das solicitações existentes ───────────
UPDATE public."SISTEMA_RECRUTAMENTO" SET status = 'Pendente Operacional'
  WHERE status = 'Aguardando Aprovação';
UPDATE public."SISTEMA_RECRUTAMENTO" SET status = 'Pendente Recrutamento'
  WHERE status = 'Aguardando Recrutamento';
UPDATE public."SISTEMA_RECRUTAMENTO" SET status = 'Seleção de Candidato'
  WHERE status IN (
    'Aprovada','Vaga Aberta','Seleção de Currículos','Em Processo Seletivo',
    'Entrevistas','Entrevista com Gestor','Entrevista com Psicóloga',
    'Aguardando Documentação','Aguardando ASO','Funcionário Selecionado'
  );
UPDATE public."SISTEMA_RECRUTAMENTO" SET status = 'Concluída'
  WHERE status = 'Contratado';

ALTER TABLE public."SISTEMA_RECRUTAMENTO"
  ALTER COLUMN status SET DEFAULT 'Pendente Operacional';

-- ── 1b. Colunas de processo do candidato em WA_CURRICULOS ────────────────
ALTER TABLE public."WA_CURRICULOS"
  ADD COLUMN IF NOT EXISTS cpf               text,
  ADD COLUMN IF NOT EXISTS cpf_cand          text,
  ADD COLUMN IF NOT EXISTS etapa_processo    text,
  ADD COLUMN IF NOT EXISTS etapa_changed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS selecionado_por   text,
  ADD COLUMN IF NOT EXISTS selecionado_em    timestamptz,
  ADD COLUMN IF NOT EXISTS juridico_ok       boolean,
  ADD COLUMN IF NOT EXISTS juridico_obs      text,
  ADD COLUMN IF NOT EXISTS juridico_por      text,
  ADD COLUMN IF NOT EXISTS juridico_em       timestamptz,
  ADD COLUMN IF NOT EXISTS sst_ok            boolean,
  ADD COLUMN IF NOT EXISTS sst_obs           text,
  ADD COLUMN IF NOT EXISTS sst_por           text,
  ADD COLUMN IF NOT EXISTS sst_em            timestamptz,
  ADD COLUMN IF NOT EXISTS admitido_em       timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_reprovacao text;

CREATE INDEX IF NOT EXISTS wac_etapa_idx ON public."WA_CURRICULOS"(etapa_processo);

-- ── 1c. View das filas Jurídico/SST (candidato × vaga) ───────────────────
-- Junta os candidatos em processo (etapa_processo preenchida) com os dados da
-- vaga, para as telas de Jurídico (Pendente Jurídico) e SST (ASO).
CREATE OR REPLACE VIEW public."VW_RECRUTAMENTO_CANDIDATOS" AS
  SELECT
    c.id                        AS candidato_id,
    c.vaga_id,
    c.nome,
    c.telefone,
    c.email,
    COALESCE(c.cpf, c.cpf_cand) AS cpf,
    c.origem,
    c.storage_path,
    c.mensagem,
    c.etapa_processo,
    c.etapa_changed_at,
    c.selecionado_por,
    c.selecionado_em,
    c.juridico_ok,
    c.juridico_obs,
    c.juridico_por,
    c.juridico_em,
    c.sst_ok,
    c.sst_obs,
    c.sst_por,
    c.sst_em,
    c.admitido_em,
    c.motivo_reprovacao,
    c.created_at                AS candidatura_em,
    s.cargo,
    s.contrato,
    s.cidade,
    s.status                    AS vaga_status
  FROM public."WA_CURRICULOS" c
  JOIN public."SISTEMA_RECRUTAMENTO" s ON s.id = c.vaga_id
  WHERE c.etapa_processo IS NOT NULL;

GRANT SELECT ON public."VW_RECRUTAMENTO_CANDIDATOS" TO authenticated;

-- ── 1d. RPCs do portal: publicar vagas em 'Seleção de Candidato' ─────────
CREATE OR REPLACE FUNCTION public.portal_cidades_com_vagas()
RETURNS TABLE (cidade text, vagas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT NULLIF(btrim("cidade"), '') AS cidade, count(*)::bigint AS vagas
  FROM public."SISTEMA_RECRUTAMENTO"
  WHERE "status" = 'Seleção de Candidato'
    AND NULLIF(btrim("cidade"), '') IS NOT NULL
  GROUP BY NULLIF(btrim("cidade"), '')
  ORDER BY 1;
$$;
REVOKE ALL ON FUNCTION public.portal_cidades_com_vagas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_cidades_com_vagas() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.portal_vagas_por_cidade(p_cidade text)
RETURNS TABLE (
  id integer, cargo text, contrato text, cidade text,
  escala text, salario text, beneficios text, quantidade_vagas integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT "id", "cargo", "contrato", "cidade",
         "escala", "salario", "beneficios", "quantidade_vagas"
  FROM public."SISTEMA_RECRUTAMENTO"
  WHERE "status" = 'Seleção de Candidato'
    AND btrim(lower("cidade")) = btrim(lower(coalesce(p_cidade, '')))
  ORDER BY "cargo";
$$;
REVOKE ALL ON FUNCTION public.portal_vagas_por_cidade(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_vagas_por_cidade(text) TO anon, authenticated;

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
  IF v_status <> 'Seleção de Candidato' THEN
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


-- =========================================================================
-- 20260703000001_recrutamento_historico.sql
-- =========================================================================
-- =========================================================================
-- RECRUTAMENTO_HISTORICO — trilha (append-only) de movimentações
--
-- Registra QUALQUER movimento de uma solicitação e de seus candidatos:
-- criação, aprovação do Operacional, confirmação do Recrutamento, seleção de
-- candidato, liberação do Jurídico, ASO do SST, conclusão e reprovações.
-- Cada linha guarda o evento, de/para status, o papel e QUEM fez.
--
-- Idempotente.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public."RECRUTAMENTO_HISTORICO" (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at      timestamptz NOT NULL DEFAULT now(),
  solicitacao_id  bigint REFERENCES public."SISTEMA_RECRUTAMENTO"(id) ON DELETE CASCADE,
  candidato_id    bigint,
  candidato_nome  text,
  evento          text,        -- ex.: 'Aprovada pelo Operacional', 'Candidato selecionado'
  de_status       text,
  para_status     text,
  papel           text,        -- 'Solicitante','Operacional','Recrutamento','Jurídico','SST'
  usuario_nome    text,
  usuario_email   text,
  detalhe         text         -- motivo/observação
);

CREATE INDEX IF NOT EXISTS rec_hist_sol_idx
  ON public."RECRUTAMENTO_HISTORICO"(solicitacao_id, created_at);

ALTER TABLE public."RECRUTAMENTO_HISTORICO" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public."RECRUTAMENTO_HISTORICO" TO authenticated;

DROP POLICY IF EXISTS rec_hist_all ON public."RECRUTAMENTO_HISTORICO";
CREATE POLICY rec_hist_all ON public."RECRUTAMENTO_HISTORICO"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';


-- =========================================================================
-- 20260704000001_recrutamento_fluxo_completo.sql
-- =========================================================================
-- =========================================================================
-- RECRUTAMENTO: pipeline completo por setor
--
-- Etapas do candidato (WA_CURRICULOS.etapa_processo):
--   Selecionado → Pendente Jurídico → Entrevista Comportamental →
--   (Exame Médico | Entrevista Técnica → Exame Médico) → Compras → Admissão
--   ; Reprovado (terminal).
--
-- Cada setor tem fila própria via VW_RECRUTAMENTO_CANDIDATOS (agora com a vaga
-- COMPLETA + restrição do CPF). Restrição = RECRUTAMENTO_CPF_BLACKLIST (só o
-- Jurídico define), por CPF, aparece em qualquer vaga.
--
-- Idempotente.
-- =========================================================================

-- ── Colunas novas das etapas em WA_CURRICULOS ────────────────────────────
ALTER TABLE public."WA_CURRICULOS"
  ADD COLUMN IF NOT EXISTS comportamental_por   text,
  ADD COLUMN IF NOT EXISTS comportamental_em    timestamptz,
  ADD COLUMN IF NOT EXISTS comportamental_obs   text,
  ADD COLUMN IF NOT EXISTS tecnica_por          text,
  ADD COLUMN IF NOT EXISTS tecnica_em           timestamptz,
  ADD COLUMN IF NOT EXISTS tecnica_obs          text,
  ADD COLUMN IF NOT EXISTS compras_necessidades text,
  ADD COLUMN IF NOT EXISTS compras_por          text,
  ADD COLUMN IF NOT EXISTS compras_em           timestamptz,
  ADD COLUMN IF NOT EXISTS compras_obs          text,
  ADD COLUMN IF NOT EXISTS admitido_por         text,
  ADD COLUMN IF NOT EXISTS empregado_id         bigint;

-- Dados antigos: ASO vira "Exame Médico".
UPDATE public."WA_CURRICULOS" SET etapa_processo = 'Exame Médico'
  WHERE etapa_processo = 'ASO';

-- ── View das filas: vaga COMPLETA + candidato + restrição do CPF ─────────
CREATE OR REPLACE VIEW public."VW_RECRUTAMENTO_CANDIDATOS" AS
  SELECT
    c.id                        AS candidato_id,
    c.vaga_id,
    c.nome,
    c.telefone,
    c.email,
    COALESCE(c.cpf, c.cpf_cand) AS cpf,
    c.origem,
    c.storage_path,
    c.mensagem,
    c.etapa_processo,
    c.etapa_changed_at,
    c.selecionado_por,
    c.selecionado_em,
    c.juridico_ok,   c.juridico_obs,   c.juridico_por,   c.juridico_em,
    c.comportamental_por, c.comportamental_em, c.comportamental_obs,
    c.tecnica_por,   c.tecnica_em,     c.tecnica_obs,
    c.sst_ok,        c.sst_obs,        c.sst_por,        c.sst_em,
    c.compras_necessidades,
    c.compras_por,   c.compras_em,     c.compras_obs,
    c.admitido_por,  c.admitido_em,    c.empregado_id,
    c.motivo_reprovacao,
    c.created_at                AS candidatura_em,
    -- Vaga (completa)
    s.cargo, s.contrato, s.cidade, s.status AS vaga_status,
    s.motivo_vaga, s.nome_substituido, s.escala, s.horario, s.salario,
    s.beneficios, s.insalubridade_recebe, s.insalubridade_quanto, s.local_exato,
    s.data_inicio_prevista, s.quantidade_vagas, s.req_obrigatorios, s.req_desejaveis,
    s.exp_minima, s.exp_minima_qual, s.grau_urgencia, s.solicitante_nome,
    -- Restrição do CPF (definida só pelo Jurídico)
    (b.cpf_digits IS NOT NULL)  AS possui_restricao,
    b.motivo                    AS restricao_motivo
  FROM public."WA_CURRICULOS" c
  JOIN public."SISTEMA_RECRUTAMENTO" s ON s.id = c.vaga_id
  LEFT JOIN public."RECRUTAMENTO_CPF_BLACKLIST" b
    ON b.cpf_digits = regexp_replace(COALESCE(c.cpf, c.cpf_cand, ''), '\D', '', 'g')
  WHERE c.etapa_processo IS NOT NULL;

GRANT SELECT ON public."VW_RECRUTAMENTO_CANDIDATOS" TO authenticated;

-- ── EMPREGADOS: liberar INSERT (admissão cria novo colaborador) ──────────
-- Hoje só existe policy de UPDATE; a tela "Novas Admissões" precisa inserir.
ALTER TABLE public."EMPREGADOS" ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public."EMPREGADOS" TO authenticated;

DROP POLICY IF EXISTS empregados_insert_auth ON public."EMPREGADOS";
CREATE POLICY empregados_insert_auth ON public."EMPREGADOS"
  FOR INSERT TO authenticated WITH CHECK (true);

NOTIFY pgrst, 'reload schema';


-- =========================================================================
-- 20260705000001_recrutamento_dois_trilhos.sql
-- =========================================================================
-- =========================================================================
-- RECRUTAMENTO — dois trilhos de status
--
-- 1) Status da Solicitação (SISTEMA_RECRUTAMENTO.status) avança AUTOMATICAMENTE
--    espelhando o candidato selecionado mais avançado (trigger).
-- 2) Status do Candidato (WA_CURRICULOS.etapa_processo) = kanban de 9 colunas:
--    ENTRADA → TRIAGEM → JURÍDICO → ENTREVISTA → ENTREVISTA GESTOR → APROVADOS →
--    EXAME SST → COMPRAS → DOCUMENTAÇÃO  (+ Reprovado).
--
-- Idempotente.
-- =========================================================================

-- ── Colunas usadas pela view/fluxo (auto-suficiente; IF NOT EXISTS) ──────
ALTER TABLE public."WA_CURRICULOS"
  ADD COLUMN IF NOT EXISTS cpf                  text,
  ADD COLUMN IF NOT EXISTS cpf_cand             text,
  ADD COLUMN IF NOT EXISTS etapa_processo       text,
  ADD COLUMN IF NOT EXISTS etapa_changed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS selecionado_por      text,
  ADD COLUMN IF NOT EXISTS selecionado_em       timestamptz,
  ADD COLUMN IF NOT EXISTS juridico_ok          boolean,
  ADD COLUMN IF NOT EXISTS juridico_obs         text,
  ADD COLUMN IF NOT EXISTS juridico_por         text,
  ADD COLUMN IF NOT EXISTS juridico_em          timestamptz,
  ADD COLUMN IF NOT EXISTS sst_ok               boolean,
  ADD COLUMN IF NOT EXISTS sst_obs              text,
  ADD COLUMN IF NOT EXISTS sst_por              text,
  ADD COLUMN IF NOT EXISTS sst_em               timestamptz,
  ADD COLUMN IF NOT EXISTS compras_necessidades text,
  ADD COLUMN IF NOT EXISTS compras_por          text,
  ADD COLUMN IF NOT EXISTS compras_em           timestamptz,
  ADD COLUMN IF NOT EXISTS compras_obs          text,
  ADD COLUMN IF NOT EXISTS admitido_por         text,
  ADD COLUMN IF NOT EXISTS admitido_em          timestamptz,
  ADD COLUMN IF NOT EXISTS empregado_id         bigint,
  ADD COLUMN IF NOT EXISTS motivo_reprovacao    text,
  ADD COLUMN IF NOT EXISTS epis_informados      boolean,
  ADD COLUMN IF NOT EXISTS epis_informados_em   timestamptz,
  ADD COLUMN IF NOT EXISTS enviado_admissao_por text,
  ADD COLUMN IF NOT EXISTS enviado_admissao_em  timestamptz;

CREATE TABLE IF NOT EXISTS public."RECRUTAMENTO_CPF_BLACKLIST" (
  cpf_digits text PRIMARY KEY, cpf_fmt text, motivo text, criado_por text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public."RECRUTAMENTO_CPF_BLACKLIST" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."RECRUTAMENTO_CPF_BLACKLIST" TO authenticated;
DROP POLICY IF EXISTS rec_cpf_bl_all ON public."RECRUTAMENTO_CPF_BLACKLIST";
CREATE POLICY rec_cpf_bl_all ON public."RECRUTAMENTO_CPF_BLACKLIST"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Migrar etapas antigas → novas ────────────────────────────────────────
UPDATE public."WA_CURRICULOS" SET etapa_processo = CASE etapa_processo
  WHEN 'Selecionado'              THEN 'ENTRADA'
  WHEN 'Pendente Jurídico'        THEN 'JURÍDICO'
  WHEN 'Entrevista Comportamental'THEN 'ENTREVISTA'
  WHEN 'Entrevista Técnica'       THEN 'ENTREVISTA GESTOR'
  WHEN 'ASO'                      THEN 'EXAME SST'
  WHEN 'Exame Médico'             THEN 'EXAME SST'
  WHEN 'Compras'                  THEN 'COMPRAS'
  WHEN 'Admissão'                 THEN 'DOCUMENTAÇÃO'
  ELSE etapa_processo END
WHERE etapa_processo IN ('Selecionado','Pendente Jurídico','Entrevista Comportamental',
  'Entrevista Técnica','ASO','Exame Médico','Compras','Admissão');

-- ── Migrar status da solicitação ─────────────────────────────────────────
UPDATE public."SISTEMA_RECRUTAMENTO" SET status = 'Vaga aberta - Seleção de Currículos'
  WHERE status = 'Seleção de Candidato';
UPDATE public."SISTEMA_RECRUTAMENTO" SET status = 'Concluído - Enviado para Admissão'
  WHERE status = 'Concluída';

-- ── Tabela TR de EPIs/uniforme (preenchida pelo Recrutamento) ────────────
CREATE TABLE IF NOT EXISTS public."RECRUTAMENTO_EPIS" (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now(),
  candidato_id  bigint REFERENCES public."WA_CURRICULOS"(id) ON DELETE CASCADE,
  vaga_id       bigint,
  item          text,        -- Itens do TR
  tamanho       text,        -- Tamanho por item
  quantidade    text,        -- Quantidade prevista
  periodicidade text,        -- Periodicidade
  observacoes   text,        -- Observações
  responsavel   text         -- Responsável (automático)
);
CREATE INDEX IF NOT EXISTS rec_epis_cand_idx ON public."RECRUTAMENTO_EPIS"(candidato_id);
ALTER TABLE public."RECRUTAMENTO_EPIS" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."RECRUTAMENTO_EPIS" TO authenticated;
DROP POLICY IF EXISTS rec_epis_all ON public."RECRUTAMENTO_EPIS";
CREATE POLICY rec_epis_all ON public."RECRUTAMENTO_EPIS"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Trigger: status da solicitação = candidato mais avançado ─────────────
CREATE OR REPLACE FUNCTION public.sr_rank_etapa(p text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p
    WHEN 'ENTRADA' THEN 1 WHEN 'TRIAGEM' THEN 2 WHEN 'JURÍDICO' THEN 3
    WHEN 'ENTREVISTA' THEN 4 WHEN 'ENTREVISTA GESTOR' THEN 5 WHEN 'APROVADOS' THEN 6
    WHEN 'EXAME SST' THEN 7 WHEN 'COMPRAS' THEN 8 WHEN 'DOCUMENTAÇÃO' THEN 9 ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.sr_sync_status_solicitacao()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_vaga   bigint;
  v_atual  text;
  v_rank   int;
  v_epis   boolean;
  v_envadm timestamptz;
  v_new    text;
BEGIN
  v_vaga := COALESCE(NEW.vaga_id, OLD.vaga_id);
  IF v_vaga IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT status INTO v_atual FROM public."SISTEMA_RECRUTAMENTO" WHERE id = v_vaga;
  IF v_atual IS NULL OR v_atual IN ('Pendente Operacional','Pendente Recrutamento','Reprovada') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT sr_rank_etapa(c.etapa_processo), c.epis_informados, c.enviado_admissao_em
    INTO v_rank, v_epis, v_envadm
  FROM public."WA_CURRICULOS" c
  WHERE c.vaga_id = v_vaga AND c.etapa_processo IS NOT NULL AND c.etapa_processo <> 'Reprovado'
  ORDER BY sr_rank_etapa(c.etapa_processo) DESC,
           c.enviado_admissao_em DESC NULLS LAST,
           c.epis_informados DESC NULLS LAST
  LIMIT 1;

  IF v_rank IS NULL OR v_rank <= 2 THEN
    v_new := 'Vaga aberta - Seleção de Currículos';
  ELSIF v_rank = 3 THEN v_new := 'Em análise jurídica';
  ELSIF v_rank = 4 THEN v_new := 'Entrevista e Avaliação';
  ELSIF v_rank = 5 THEN v_new := 'Entrevista com Gestor';
  ELSIF v_rank = 6 THEN v_new := 'Aprovado - Aguardando SST';
  ELSIF v_rank = 7 THEN v_new := 'Encaminhado para SST (ASO)';
  ELSIF v_rank = 8 THEN
    v_new := CASE WHEN COALESCE(v_epis,false) THEN 'Aguardando Confirmação Compras'
                  ELSE 'ASO Aprovado - Aguardando Informe de EPIs' END;
  ELSIF v_rank = 9 THEN
    v_new := CASE WHEN v_envadm IS NOT NULL THEN 'Concluído - Enviado para Admissão'
                  ELSE 'Compras Confirmou - Aguardando Documentação' END;
  ELSE v_new := v_atual;
  END IF;

  IF v_new IS DISTINCT FROM v_atual THEN
    UPDATE public."SISTEMA_RECRUTAMENTO" SET status = v_new WHERE id = v_vaga;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sr_sync_status ON public."WA_CURRICULOS";
CREATE TRIGGER trg_sr_sync_status
  AFTER INSERT OR UPDATE ON public."WA_CURRICULOS"
  FOR EACH ROW EXECUTE FUNCTION public.sr_sync_status_solicitacao();

-- ── View das filas (inclui flags novas) ──────────────────────────────────
DROP VIEW IF EXISTS public."VW_RECRUTAMENTO_CANDIDATOS";
CREATE VIEW public."VW_RECRUTAMENTO_CANDIDATOS" AS
  SELECT
    c.id AS candidato_id, c.vaga_id, c.nome, c.telefone, c.email,
    COALESCE(c.cpf, c.cpf_cand) AS cpf, c.origem, c.storage_path, c.mensagem,
    c.etapa_processo, c.etapa_changed_at, c.selecionado_por, c.selecionado_em,
    c.juridico_ok, c.juridico_obs, c.juridico_por, c.juridico_em,
    c.comportamental_por, c.comportamental_em, c.comportamental_obs,
    c.tecnica_por, c.tecnica_em, c.tecnica_obs,
    c.sst_ok, c.sst_obs, c.sst_por, c.sst_em,
    c.compras_necessidades, c.compras_por, c.compras_em, c.compras_obs,
    c.epis_informados, c.epis_informados_em,
    c.enviado_admissao_por, c.enviado_admissao_em,
    c.admitido_por, c.admitido_em, c.empregado_id, c.motivo_reprovacao,
    c.created_at AS candidatura_em,
    s.cargo, s.contrato, s.cidade, s.status AS vaga_status,
    s.motivo_vaga, s.nome_substituido, s.escala, s.horario, s.salario,
    s.beneficios, s.insalubridade_recebe, s.insalubridade_quanto, s.local_exato,
    s.data_inicio_prevista, s.quantidade_vagas, s.req_obrigatorios, s.req_desejaveis,
    s.exp_minima, s.exp_minima_qual, s.grau_urgencia, s.solicitante_nome,
    (b.cpf_digits IS NOT NULL) AS possui_restricao, b.motivo AS restricao_motivo
  FROM public."WA_CURRICULOS" c
  JOIN public."SISTEMA_RECRUTAMENTO" s ON s.id = c.vaga_id
  LEFT JOIN public."RECRUTAMENTO_CPF_BLACKLIST" b
    ON b.cpf_digits = regexp_replace(COALESCE(c.cpf, c.cpf_cand, ''), '\D', '', 'g')
  WHERE c.etapa_processo IS NOT NULL;
GRANT SELECT ON public."VW_RECRUTAMENTO_CANDIDATOS" TO authenticated;

-- ── RPCs do portal: publicar onde 'Vaga aberta - Seleção de Currículos' ──
CREATE OR REPLACE FUNCTION public.portal_cidades_com_vagas()
RETURNS TABLE (cidade text, vagas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NULLIF(btrim("cidade"), '') AS cidade, count(*)::bigint AS vagas
  FROM public."SISTEMA_RECRUTAMENTO"
  WHERE "status" = 'Vaga aberta - Seleção de Currículos'
    AND NULLIF(btrim("cidade"), '') IS NOT NULL
  GROUP BY NULLIF(btrim("cidade"), '') ORDER BY 1;
$$;
REVOKE ALL ON FUNCTION public.portal_cidades_com_vagas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_cidades_com_vagas() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.portal_vagas_por_cidade(p_cidade text)
RETURNS TABLE (id integer, cargo text, contrato text, cidade text, escala text, salario text, beneficios text, quantidade_vagas integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT "id", "cargo", "contrato", "cidade", "escala", "salario", "beneficios", "quantidade_vagas"
  FROM public."SISTEMA_RECRUTAMENTO"
  WHERE "status" = 'Vaga aberta - Seleção de Currículos'
    AND btrim(lower("cidade")) = btrim(lower(coalesce(p_cidade, '')))
  ORDER BY "cargo";
$$;
REVOKE ALL ON FUNCTION public.portal_vagas_por_cidade(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_vagas_por_cidade(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.portal_candidatar(
  p_vaga_id integer, p_nome text, p_telefone text, p_email text, p_cpf text,
  p_mensagem text, p_arquivo_nome text, p_storage_path text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text; v_id bigint; v_field record; v_col text;
BEGIN
  IF coalesce(btrim(p_nome), '') = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'Informe seu nome.'); END IF;
  IF coalesce(btrim(p_telefone), '') = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'Informe seu telefone.'); END IF;
  SELECT "status" INTO v_status FROM public."SISTEMA_RECRUTAMENTO" WHERE "id" = p_vaga_id;
  IF v_status IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Vaga não encontrada.'); END IF;
  IF v_status <> 'Vaga aberta - Seleção de Currículos' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Esta vaga não está mais recebendo currículos.');
  END IF;
  INSERT INTO public."WA_CURRICULOS" (vaga_id, origem) VALUES (p_vaga_id, 'Portal') RETURNING id INTO v_id;
  FOR v_field IN
    SELECT t.cands, t.val FROM (VALUES
      (ARRAY['nome','nome_cand','nome_candidato'], btrim(p_nome)),
      (ARRAY['telefone','fone','celular','whatsapp'], btrim(p_telefone)),
      (ARRAY['email','email_cand'], NULLIF(btrim(p_email), '')),
      (ARRAY['cpf','cpf_cand'], NULLIF(btrim(p_cpf), '')),
      (ARRAY['mensagem','observacao','obs'], NULLIF(btrim(p_mensagem), '')),
      (ARRAY['arquivo_nome','nome_arquivo'], NULLIF(btrim(p_arquivo_nome), '')),
      (ARRAY['storage_path','arquivo_path','path'], NULLIF(btrim(p_storage_path), ''))
    ) AS t(cands, val) WHERE t.val IS NOT NULL
  LOOP
    SELECT c.column_name INTO v_col FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'WA_CURRICULOS' AND c.column_name::text = ANY (v_field.cands)
    ORDER BY array_position(v_field.cands, c.column_name::text) LIMIT 1;
    IF v_col IS NOT NULL THEN
      EXECUTE format('UPDATE public."WA_CURRICULOS" SET %I = $1 WHERE id = $2', v_col) USING v_field.val, v_id;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;
REVOKE ALL ON FUNCTION public.portal_candidatar(integer,text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_candidatar(integer,text,text,text,text,text,text,text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- ── EMPREGADOS: liberar INSERT (admissão cria novo colaborador) ──────────
ALTER TABLE public."EMPREGADOS" ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public."EMPREGADOS" TO authenticated;
DROP POLICY IF EXISTS empregados_insert_auth ON public."EMPREGADOS";
CREATE POLICY empregados_insert_auth ON public."EMPREGADOS"
  FOR INSERT TO authenticated WITH CHECK (true);

NOTIFY pgrst, 'reload schema';


-- =========================================================================
-- 20260706000001_portal_cadastro_completo.sql
-- =========================================================================
-- =========================================================================
-- PORTAL DE CANDIDATURA — cadastro completo + candidatura geral
--
-- 1) Campos de perfil do candidato em WA_CURRICULOS.
-- 2) Candidatura GERAL (sem vaga): vaga_id NULL, tipo_candidatura='geral'.
-- 3) Anexos múltiplos (currículo + CTPS) em RECRUTAMENTO_CANDIDATO_ARQUIVOS.
-- 4) RPC portal_candidatar_v2(jsonb) p/ o portal público (anon).
--
-- Idempotente.
-- =========================================================================

ALTER TABLE public."WA_CURRICULOS"
  ADD COLUMN IF NOT EXISTS data_nascimento          date,
  ADD COLUMN IF NOT EXISTS rg                       text,
  ADD COLUMN IF NOT EXISTS sexo                     text,
  ADD COLUMN IF NOT EXISTS nome_mae                 text,
  ADD COLUMN IF NOT EXISTS nome_pai                 text,
  ADD COLUMN IF NOT EXISTS escolaridade             text,
  ADD COLUMN IF NOT EXISTS cidade_residencia        text,
  ADD COLUMN IF NOT EXISTS estado_desejado          text,
  ADD COLUMN IF NOT EXISTS cidade_desejada          text,
  ADD COLUMN IF NOT EXISTS cargos_interesse         text,
  ADD COLUMN IF NOT EXISTS disponibilidade_horarios text,
  ADD COLUMN IF NOT EXISTS disp_fim_semana          boolean,
  ADD COLUMN IF NOT EXISTS possui_cnh               boolean,
  ADD COLUMN IF NOT EXISTS experiencia_previa       boolean,
  ADD COLUMN IF NOT EXISTS estrangeiro              boolean,
  ADD COLUMN IF NOT EXISTS tipo_candidatura         text;

-- Candidatura geral não tem vaga → vaga_id precisa aceitar NULL.
ALTER TABLE public."WA_CURRICULOS" ALTER COLUMN vaga_id DROP NOT NULL;

-- ── Anexos do candidato (currículo + CTPS, múltiplos) ────────────────────
CREATE TABLE IF NOT EXISTS public."RECRUTAMENTO_CANDIDATO_ARQUIVOS" (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at   timestamptz NOT NULL DEFAULT now(),
  candidato_id bigint REFERENCES public."WA_CURRICULOS"(id) ON DELETE CASCADE,
  tipo         text,        -- 'curriculo' | 'ctps'
  storage_path text,
  nome         text
);
CREATE INDEX IF NOT EXISTS rec_cand_arq_idx ON public."RECRUTAMENTO_CANDIDATO_ARQUIVOS"(candidato_id);
ALTER TABLE public."RECRUTAMENTO_CANDIDATO_ARQUIVOS" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."RECRUTAMENTO_CANDIDATO_ARQUIVOS" TO authenticated;
DROP POLICY IF EXISTS rec_cand_arq_all ON public."RECRUTAMENTO_CANDIDATO_ARQUIVOS";
CREATE POLICY rec_cand_arq_all ON public."RECRUTAMENTO_CANDIDATO_ARQUIVOS"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── RPC do portal (candidatura geral OU para vaga) ───────────────────────
CREATE OR REPLACE FUNCTION public.portal_candidatar_v2(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_vaga     bigint;
  v_status   text;
  v_id       bigint;
  v_tipo     text;
  v_arq      jsonb;
  v_first_cv text;
BEGIN
  v_vaga := NULLIF(p_payload->>'vaga_id', '')::bigint;
  v_tipo := CASE WHEN v_vaga IS NULL THEN 'geral' ELSE 'vaga' END;

  IF coalesce(btrim(p_payload->>'nome'), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Informe seu nome.');
  END IF;
  IF coalesce(btrim(p_payload->>'telefone'), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Informe seu telefone.');
  END IF;
  IF length(regexp_replace(coalesce(p_payload->>'cpf',''), '\D', '', 'g')) <> 11 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CPF inválido.');
  END IF;

  IF v_vaga IS NOT NULL THEN
    SELECT status INTO v_status FROM public."SISTEMA_RECRUTAMENTO" WHERE id = v_vaga;
    IF v_status IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Vaga não encontrada.'); END IF;
    IF v_status <> 'Vaga aberta - Seleção de Currículos' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Esta vaga não está mais recebendo currículos.');
    END IF;
  END IF;

  SELECT (elem->>'path') INTO v_first_cv
  FROM jsonb_array_elements(coalesce(p_payload->'curriculos', '[]'::jsonb)) elem LIMIT 1;

  INSERT INTO public."WA_CURRICULOS" (
    vaga_id, origem, tipo_candidatura, nome, telefone, email, cpf, cpf_cand, mensagem, storage_path,
    data_nascimento, rg, sexo, nome_mae, nome_pai, escolaridade, cidade_residencia,
    estado_desejado, cidade_desejada, cargos_interesse, disponibilidade_horarios,
    disp_fim_semana, possui_cnh, experiencia_previa, estrangeiro
  ) VALUES (
    v_vaga, 'Portal', v_tipo,
    btrim(p_payload->>'nome'), btrim(p_payload->>'telefone'), NULLIF(btrim(p_payload->>'email'), ''),
    NULLIF(btrim(p_payload->>'cpf'), ''), NULLIF(btrim(p_payload->>'cpf'), ''),
    NULLIF(btrim(p_payload->>'mensagem'), ''), v_first_cv,
    NULLIF(p_payload->>'data_nascimento', '')::date, NULLIF(btrim(p_payload->>'rg'), ''),
    NULLIF(btrim(p_payload->>'sexo'), ''), NULLIF(btrim(p_payload->>'nome_mae'), ''),
    NULLIF(btrim(p_payload->>'nome_pai'), ''), NULLIF(btrim(p_payload->>'escolaridade'), ''),
    NULLIF(btrim(p_payload->>'cidade_residencia'), ''), NULLIF(btrim(p_payload->>'estado_desejado'), ''),
    NULLIF(btrim(p_payload->>'cidade_desejada'), ''), NULLIF(btrim(p_payload->>'cargos_interesse'), ''),
    NULLIF(btrim(p_payload->>'disponibilidade_horarios'), ''),
    NULLIF(p_payload->>'disp_fim_semana', '')::boolean, NULLIF(p_payload->>'possui_cnh', '')::boolean,
    NULLIF(p_payload->>'experiencia_previa', '')::boolean, NULLIF(p_payload->>'estrangeiro', '')::boolean
  ) RETURNING id INTO v_id;

  FOR v_arq IN SELECT * FROM jsonb_array_elements(coalesce(p_payload->'curriculos', '[]'::jsonb)) LOOP
    INSERT INTO public."RECRUTAMENTO_CANDIDATO_ARQUIVOS"(candidato_id, tipo, storage_path, nome)
    VALUES (v_id, 'curriculo', v_arq->>'path', v_arq->>'nome');
  END LOOP;
  FOR v_arq IN SELECT * FROM jsonb_array_elements(coalesce(p_payload->'ctps', '[]'::jsonb)) LOOP
    INSERT INTO public."RECRUTAMENTO_CANDIDATO_ARQUIVOS"(candidato_id, tipo, storage_path, nome)
    VALUES (v_id, 'ctps', v_arq->>'path', v_arq->>'nome');
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;
REVOKE ALL ON FUNCTION public.portal_candidatar_v2(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_candidatar_v2(jsonb) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';


-- =========================================================================
-- 20260707000001_recrutamento_refinamentos.sql
-- =========================================================================
-- =========================================================================
-- RECRUTAMENTO — refinamentos
-- 1) Candidatura a vaga entra DIRETO em ENTRADA (portal_candidatar_v2).
-- 2) 3 experiências relevantes.
-- 3) SST em 2 partes (agendar data/hora/local → realizar).
-- 4) EPIs: flag "obrigatório"; Compras informa data de chegada.
-- 5) Roteiro de entrevista (RECRUTAMENTO_ENTREVISTA).
-- 6) "Enviar para Admissão" → status final "Contratado".
-- Idempotente.
-- =========================================================================

ALTER TABLE public."WA_CURRICULOS"
  ADD COLUMN IF NOT EXISTS experiencia_1       text,
  ADD COLUMN IF NOT EXISTS experiencia_2       text,
  ADD COLUMN IF NOT EXISTS experiencia_3       text,
  ADD COLUMN IF NOT EXISTS sst_data_exame      date,
  ADD COLUMN IF NOT EXISTS sst_hora_exame      text,
  ADD COLUMN IF NOT EXISTS sst_local_exame     text,
  ADD COLUMN IF NOT EXISTS sst_agendado_por    text,
  ADD COLUMN IF NOT EXISTS sst_agendado_em     timestamptz,
  ADD COLUMN IF NOT EXISTS compras_data_chegada date;

ALTER TABLE public."RECRUTAMENTO_EPIS"
  ADD COLUMN IF NOT EXISTS obrigatorio boolean;

-- ── Roteiro de entrevista (perguntas/respostas por candidato/etapa) ──────
CREATE TABLE IF NOT EXISTS public."RECRUTAMENTO_ENTREVISTA" (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at   timestamptz NOT NULL DEFAULT now(),
  candidato_id bigint REFERENCES public."WA_CURRICULOS"(id) ON DELETE CASCADE,
  etapa        text,        -- 'ENTREVISTA' | 'ENTREVISTA GESTOR'
  ordem        int,
  pergunta     text,
  resposta     text
);
CREATE INDEX IF NOT EXISTS rec_entrev_idx ON public."RECRUTAMENTO_ENTREVISTA"(candidato_id, etapa);
ALTER TABLE public."RECRUTAMENTO_ENTREVISTA" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."RECRUTAMENTO_ENTREVISTA" TO authenticated;
DROP POLICY IF EXISTS rec_entrev_all ON public."RECRUTAMENTO_ENTREVISTA";
CREATE POLICY rec_entrev_all ON public."RECRUTAMENTO_ENTREVISTA"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Status final: "Concluído - Enviado para Admissão" → "Contratado" ─────
UPDATE public."SISTEMA_RECRUTAMENTO" SET status = 'Contratado'
  WHERE status = 'Concluído - Enviado para Admissão';

-- ── Trigger de auto-status: DOCUMENTAÇÃO + enviado → Contratado ──────────
CREATE OR REPLACE FUNCTION public.sr_sync_status_solicitacao()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_vaga bigint; v_atual text; v_rank int; v_epis boolean; v_envadm timestamptz; v_new text;
BEGIN
  v_vaga := COALESCE(NEW.vaga_id, OLD.vaga_id);
  IF v_vaga IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT status INTO v_atual FROM public."SISTEMA_RECRUTAMENTO" WHERE id = v_vaga;
  IF v_atual IS NULL OR v_atual IN ('Pendente Operacional','Pendente Recrutamento','Reprovada') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT sr_rank_etapa(c.etapa_processo), c.epis_informados, c.enviado_admissao_em
    INTO v_rank, v_epis, v_envadm
  FROM public."WA_CURRICULOS" c
  WHERE c.vaga_id = v_vaga AND c.etapa_processo IS NOT NULL AND c.etapa_processo <> 'Reprovado'
  ORDER BY sr_rank_etapa(c.etapa_processo) DESC, c.enviado_admissao_em DESC NULLS LAST, c.epis_informados DESC NULLS LAST
  LIMIT 1;
  IF v_rank IS NULL OR v_rank <= 2 THEN v_new := 'Vaga aberta - Seleção de Currículos';
  ELSIF v_rank = 3 THEN v_new := 'Em análise jurídica';
  ELSIF v_rank = 4 THEN v_new := 'Entrevista e Avaliação';
  ELSIF v_rank = 5 THEN v_new := 'Entrevista com Gestor';
  ELSIF v_rank = 6 THEN v_new := 'Aprovado - Aguardando SST';
  ELSIF v_rank = 7 THEN v_new := 'Encaminhado para SST (ASO)';
  ELSIF v_rank = 8 THEN v_new := CASE WHEN COALESCE(v_epis,false) THEN 'Aguardando Confirmação Compras' ELSE 'ASO Aprovado - Aguardando Informe de EPIs' END;
  ELSIF v_rank = 9 THEN v_new := CASE WHEN v_envadm IS NOT NULL THEN 'Contratado' ELSE 'Compras Confirmou - Aguardando Documentação' END;
  ELSE v_new := v_atual; END IF;
  IF v_new IS DISTINCT FROM v_atual THEN
    UPDATE public."SISTEMA_RECRUTAMENTO" SET status = v_new WHERE id = v_vaga;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── portal_candidatar_v2: candidatura a vaga entra DIRETO em ENTRADA ─────
CREATE OR REPLACE FUNCTION public.portal_candidatar_v2(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_vaga bigint; v_status text; v_id bigint; v_tipo text; v_arq jsonb; v_first_cv text;
  v_etapa text; v_now timestamptz := now();
BEGIN
  v_vaga := NULLIF(p_payload->>'vaga_id', '')::bigint;
  v_tipo := CASE WHEN v_vaga IS NULL THEN 'geral' ELSE 'vaga' END;
  v_etapa := CASE WHEN v_vaga IS NULL THEN NULL ELSE 'ENTRADA' END;

  IF coalesce(btrim(p_payload->>'nome'), '') = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'Informe seu nome.'); END IF;
  IF coalesce(btrim(p_payload->>'telefone'), '') = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'Informe seu telefone.'); END IF;
  IF length(regexp_replace(coalesce(p_payload->>'cpf',''), '\D', '', 'g')) <> 11 THEN RETURN jsonb_build_object('ok', false, 'error', 'CPF inválido.'); END IF;

  IF v_vaga IS NOT NULL THEN
    SELECT status INTO v_status FROM public."SISTEMA_RECRUTAMENTO" WHERE id = v_vaga;
    IF v_status IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Vaga não encontrada.'); END IF;
    IF v_status <> 'Vaga aberta - Seleção de Currículos' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Esta vaga não está mais recebendo currículos.');
    END IF;
  END IF;

  SELECT (elem->>'path') INTO v_first_cv FROM jsonb_array_elements(coalesce(p_payload->'curriculos', '[]'::jsonb)) elem LIMIT 1;

  INSERT INTO public."WA_CURRICULOS" (
    vaga_id, origem, tipo_candidatura, etapa_processo, etapa_changed_at, selecionado_por, selecionado_em,
    nome, telefone, email, cpf, cpf_cand, mensagem, storage_path,
    data_nascimento, rg, sexo, nome_mae, nome_pai, escolaridade, cidade_residencia,
    estado_desejado, cidade_desejada, cargos_interesse, disponibilidade_horarios,
    disp_fim_semana, possui_cnh, experiencia_previa, estrangeiro,
    experiencia_1, experiencia_2, experiencia_3
  ) VALUES (
    v_vaga, 'Portal', v_tipo, v_etapa,
    CASE WHEN v_etapa IS NULL THEN NULL ELSE v_now END,
    CASE WHEN v_etapa IS NULL THEN NULL ELSE 'Portal' END,
    CASE WHEN v_etapa IS NULL THEN NULL ELSE v_now END,
    btrim(p_payload->>'nome'), btrim(p_payload->>'telefone'), NULLIF(btrim(p_payload->>'email'), ''),
    NULLIF(btrim(p_payload->>'cpf'), ''), NULLIF(btrim(p_payload->>'cpf'), ''),
    NULLIF(btrim(p_payload->>'mensagem'), ''), v_first_cv,
    NULLIF(p_payload->>'data_nascimento', '')::date, NULLIF(btrim(p_payload->>'rg'), ''),
    NULLIF(btrim(p_payload->>'sexo'), ''), NULLIF(btrim(p_payload->>'nome_mae'), ''),
    NULLIF(btrim(p_payload->>'nome_pai'), ''), NULLIF(btrim(p_payload->>'escolaridade'), ''),
    NULLIF(btrim(p_payload->>'cidade_residencia'), ''), NULLIF(btrim(p_payload->>'estado_desejado'), ''),
    NULLIF(btrim(p_payload->>'cidade_desejada'), ''), NULLIF(btrim(p_payload->>'cargos_interesse'), ''),
    NULLIF(btrim(p_payload->>'disponibilidade_horarios'), ''),
    NULLIF(p_payload->>'disp_fim_semana', '')::boolean, NULLIF(p_payload->>'possui_cnh', '')::boolean,
    NULLIF(p_payload->>'experiencia_previa', '')::boolean, NULLIF(p_payload->>'estrangeiro', '')::boolean,
    NULLIF(btrim(p_payload->>'experiencia_1'), ''), NULLIF(btrim(p_payload->>'experiencia_2'), ''),
    NULLIF(btrim(p_payload->>'experiencia_3'), '')
  ) RETURNING id INTO v_id;

  FOR v_arq IN SELECT * FROM jsonb_array_elements(coalesce(p_payload->'curriculos', '[]'::jsonb)) LOOP
    INSERT INTO public."RECRUTAMENTO_CANDIDATO_ARQUIVOS"(candidato_id, tipo, storage_path, nome)
    VALUES (v_id, 'curriculo', v_arq->>'path', v_arq->>'nome');
  END LOOP;
  FOR v_arq IN SELECT * FROM jsonb_array_elements(coalesce(p_payload->'ctps', '[]'::jsonb)) LOOP
    INSERT INTO public."RECRUTAMENTO_CANDIDATO_ARQUIVOS"(candidato_id, tipo, storage_path, nome)
    VALUES (v_id, 'ctps', v_arq->>'path', v_arq->>'nome');
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;
REVOKE ALL ON FUNCTION public.portal_candidatar_v2(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_candidatar_v2(jsonb) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';


-- =========================================================================
-- 20260708000001_recrutamento_favoritos.sql
-- =========================================================================
-- =========================================================================
-- RECRUTAMENTO — Banco de Talentos: favoritos
-- Marca candidatos como favoritos (estrela). Idempotente.
-- =========================================================================

ALTER TABLE public."WA_CURRICULOS"
  ADD COLUMN IF NOT EXISTS favorito boolean;

CREATE INDEX IF NOT EXISTS wac_favorito_idx ON public."WA_CURRICULOS"(favorito) WHERE favorito;

NOTIFY pgrst, 'reload schema';


-- =========================================================================
-- 20260709000001_view_campos_completos.sql
-- =========================================================================
-- =========================================================================
-- RECRUTAMENTO — recria VW_RECRUTAMENTO_CANDIDATOS com TODAS as colunas
-- (agendamento SST, data de chegada Compras, experiências, favorito).
-- Corrige "column ... does not exist" nas telas dos setores.
-- Auto-suficiente e idempotente.
-- =========================================================================

-- Garante as colunas usadas pela view (idempotente).
ALTER TABLE public."WA_CURRICULOS"
  ADD COLUMN IF NOT EXISTS sst_data_exame       date,
  ADD COLUMN IF NOT EXISTS sst_hora_exame       text,
  ADD COLUMN IF NOT EXISTS sst_local_exame      text,
  ADD COLUMN IF NOT EXISTS sst_agendado_por     text,
  ADD COLUMN IF NOT EXISTS sst_agendado_em      timestamptz,
  ADD COLUMN IF NOT EXISTS compras_data_chegada date,
  ADD COLUMN IF NOT EXISTS experiencia_1        text,
  ADD COLUMN IF NOT EXISTS experiencia_2        text,
  ADD COLUMN IF NOT EXISTS experiencia_3        text,
  ADD COLUMN IF NOT EXISTS favorito             boolean;

DROP VIEW IF EXISTS public."VW_RECRUTAMENTO_CANDIDATOS";
CREATE VIEW public."VW_RECRUTAMENTO_CANDIDATOS" AS
  SELECT
    c.id AS candidato_id, c.vaga_id, c.nome, c.telefone, c.email,
    COALESCE(c.cpf, c.cpf_cand) AS cpf, c.origem, c.storage_path, c.mensagem,
    c.etapa_processo, c.etapa_changed_at, c.selecionado_por, c.selecionado_em,
    c.juridico_ok, c.juridico_obs, c.juridico_por, c.juridico_em,
    c.sst_ok, c.sst_obs, c.sst_por, c.sst_em,
    c.sst_data_exame, c.sst_hora_exame, c.sst_local_exame, c.sst_agendado_por, c.sst_agendado_em,
    c.compras_necessidades, c.compras_por, c.compras_em, c.compras_obs, c.compras_data_chegada,
    c.epis_informados, c.epis_informados_em,
    c.enviado_admissao_por, c.enviado_admissao_em,
    c.admitido_por, c.admitido_em, c.empregado_id, c.motivo_reprovacao,
    c.experiencia_1, c.experiencia_2, c.experiencia_3, c.favorito, c.tipo_candidatura,
    c.created_at AS candidatura_em,
    s.cargo, s.contrato, s.cidade, s.status AS vaga_status,
    s.motivo_vaga, s.nome_substituido, s.escala, s.horario, s.salario,
    s.beneficios, s.insalubridade_recebe, s.insalubridade_quanto, s.local_exato,
    s.data_inicio_prevista, s.quantidade_vagas, s.req_obrigatorios, s.req_desejaveis,
    s.exp_minima, s.exp_minima_qual, s.grau_urgencia, s.solicitante_nome,
    (b.cpf_digits IS NOT NULL) AS possui_restricao, b.motivo AS restricao_motivo
  FROM public."WA_CURRICULOS" c
  JOIN public."SISTEMA_RECRUTAMENTO" s ON s.id = c.vaga_id
  LEFT JOIN public."RECRUTAMENTO_CPF_BLACKLIST" b
    ON b.cpf_digits = regexp_replace(COALESCE(c.cpf, c.cpf_cand, ''), '\D', '', 'g')
  WHERE c.etapa_processo IS NOT NULL;

GRANT SELECT ON public."VW_RECRUTAMENTO_CANDIDATOS" TO authenticated;

NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- EMPREGADOS — coluna "Nome do Cargo" (migration 20260701000002)
--
-- A EMPREGADOS traz o cargo em "Título do Cargo", que em vários registros
-- veio da folha só com o CÓDIGO do cargo (ex.: "0182"), não o nome legível.
-- Esta coluna guarda o nome do cargo já traduzido (ex.: "ADVOGADO"), obtido
-- ao integrar uma planilha de referência (Cargo → Nome do Cargo) na tela
-- RH → Colaboradores ("Integrar Cargos").
-- =========================================================================

ALTER TABLE public."EMPREGADOS"
  ADD COLUMN IF NOT EXISTS "Nome do Cargo" text;

NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- EMPREGADOS — recodificação de "Cargo" (migration 20260701000003)
--
-- A planilha de referência de cargos tinha o mesmo nome com códigos
-- diferentes (ex.: AGENTE DE PORTARIA = 0009 e 0011) e códigos que colidem
-- quando viram bigint (ex.: "0225" e "225" ambos = 225, mas com nomes
-- diferentes). Esta migration:
--
-- 1) Zera (NULL) o "Cargo" de quem está hoje em um dos 27 códigos ambíguos
--    abaixo (não dá pra saber qual dos 2 nomes é correto) e marca
--    "Nome do Cargo" com um aviso — pra não colidir com o esquema novo E
--    pra não ser confundido depois com "Vazio" (sem cargo nenhum) caso o
--    "Integrar Cargos" seja rodado de novo.
-- 2) Recodifica os demais para um esquema NOVO sequencial (1, 2, 3…), um
--    código único por nome de cargo, e já preenche "Nome do Cargo" junto.
--
-- Gerado a partir de CARGOS.xlsx + CARGOS_RENUMERADOS.xlsx (aba De-Para).
-- Idempotente: rodar de novo não faz nada (os códigos antigos já não
-- existem mais depois da 1ª aplicação).
-- =========================================================================

-- 1) Códigos ambíguos na planilha de origem — zera e marca pra revisão manual.
UPDATE public."EMPREGADOS"
SET "Cargo" = NULL, "Nome do Cargo" = 'AMBÍGUO - REVISAR MANUALMENTE'
WHERE "Cargo" IN (194, 195, 196, 197, 199, 200, 201, 205, 206, 207, 208, 209, 210, 214, 215, 216, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228);

-- 2) Recodificação: código antigo → código novo sequencial + nome do cargo.
UPDATE public."EMPREGADOS" e
SET "Cargo" = v.novo, "Nome do Cargo" = v.nome
FROM (VALUES
(1, 55, 'AUXILIAR ADMINISTRATIVO'),
  (2, 206, 'VIGIA DE PORTARIA'),
  (3, 55, 'AUXILIAR ADMINISTRATIVO'),
  (4, 201, 'VARREDOR DE RUA - LIMPEZA URBANA'),
  (5, 170, 'SERVIÇOS GERAIS'),
  (6, 201, 'VARREDOR DE RUA - LIMPEZA URBANA'),
  (7, 185, 'SUPERVISOR OPERACIONAL'),
  (8, 201, 'VARREDOR DE RUA - LIMPEZA URBANA'),
  (9, 2, 'AGENTE DE PORTARIA'),
  (10, 56, 'AUXILIAR ADMNISTRATIVO'),
  (11, 2, 'AGENTE DE PORTARIA'),
  (12, 205, 'VIGIA'),
  (13, 154, 'PORTEIRO'),
  (14, 205, 'VIGIA'),
  (15, 165, 'SERVENTE DE LIMPEZA'),
  (16, 101, 'ESTAGIARIO'),
  (17, 165, 'SERVENTE DE LIMPEZA'),
  (18, 89, 'COZINHEIRA HOSPITALAR'),
  (19, 91, 'COZINHEIRO GERAL'),
  (20, 172, 'SOCIO'),
  (21, 60, 'AUXILIAR DE COZINHA'),
  (22, 60, 'AUXILIAR DE COZINHA'),
  (23, 60, 'AUXILIAR DE COZINHA'),
  (24, 166, 'SERVENTE DE LIMPEZA - D'),
  (25, 111, 'JARDINEIRO'),
  (26, 200, 'TRATORISTA FUGS'),
  (27, 53, 'AUX ADMINISTRATIVO DE PESSOAL'),
  (28, 157, 'PSICOLOGA DO TRABALHO'),
  (29, 150, 'PEDAGOGA'),
  (30, 134, 'MOTORISTA'),
  (31, 151, 'PEDREIRO'),
  (32, 204, 'VIDRACEIRO'),
  (33, 97, 'ELETRICISTA'),
  (34, 96, 'ELETRECISTA'),
  (35, 97, 'ELETRICISTA'),
  (36, 168, 'SERVENTE DE OBRAS'),
  (37, 153, 'PINTOR'),
  (38, 77, 'CARPINTEIRO'),
  (39, 133, 'MESTRE DE OBRAS'),
  (40, 98, 'ENCANADOR'),
  (41, 158, 'RECEPCIONISTA'),
  (42, 54, 'AUX. ADMINISTRATIVO'),
  (43, 29, 'APRENDIZ AUXILIAR ADMINISTRATIVO'),
  (44, 18, 'ANALISTA DE LOGISTICA'),
  (45, 66, 'AUXILIAR DE PINTOR'),
  (46, 18, 'ANALISTA DE LOGISTICA'),
  (47, 132, 'MERENDEIRA'),
  (48, 105, 'GERENTE ADMINISTRATIVO'),
  (49, 132, 'MERENDEIRA'),
  (50, 19, 'ANALISTA DE RECURSOS HUMANOS'),
  (51, 88, 'COZINHEIRA'),
  (52, 19, 'ANALISTA DE RECURSOS HUMANOS'),
  (53, 146, 'OPERADOR DE MAQUINA'),
  (54, 185, 'SUPERVISOR OPERACIONAL'),
  (55, 146, 'OPERADOR DE MAQUINA'),
  (56, 65, 'AUXILIAR DE MANUTENÇÃO PREDIAL'),
  (57, 72, 'AUXILIAR FINANCEIRO'),
  (58, 65, 'AUXILIAR DE MANUTENÇÃO PREDIAL'),
  (59, 158, 'RECEPCIONISTA'),
  (60, 73, 'AUXILIAR NOS SERVIÇOS DE ALIMENTAÇÃO'),
  (61, 158, 'RECEPCIONISTA'),
  (62, 167, 'SERVENTE DE LIMPEZA - II'),
  (63, 62, 'AUXILIAR DE LAVANDERIA'),
  (64, 155, 'PROFESSOR'),
  (65, 190, 'TEC AGRICOLA'),
  (66, 19, 'ANALISTA DE RECURSOS HUMANOS'),
  (67, 52, 'ATENDENTE DE CRECHE'),
  (68, 128, 'MECANICO'),
  (69, 18, 'ANALISTA DE LOGISTICA'),
  (70, 100, 'ESTAGIARIA'),
  (71, 87, 'COVEIRO'),
  (72, 154, 'PORTEIRO'),
  (73, 61, 'AUXILIAR DE EDUCACAO INFANTIL'),
  (74, 104, 'EXUMADOR'),
  (75, 84, 'COPEIRO'),
  (76, 191, 'TECNICA EM ENFERMAGEM'),
  (77, 90, 'COZINHEIRO'),
  (78, 191, 'TECNICA EM ENFERMAGEM'),
  (79, 188, 'SUPERVISORA DE COZINHA'),
  (80, 199, 'TRATORISTA'),
  (81, 207, 'ZELADOR'),
  (82, 58, 'AUXILIAR DE ALMOXARIFADO'),
  (83, 202, 'VENDEDORA'),
  (84, 67, 'AUXILIAR DE SERVICOS GERAIS'),
  (85, 140, 'OFFICEBOY'),
  (86, 92, 'CUIDADOR EM SAUDE'),
  (87, 58, 'AUXILIAR DE ALMOXARIFADO'),
  (88, 193, 'TECNICO EM SEGURANCA DO TRABALHO'),
  (89, 121, 'LIDER DE SERVENTE DE LIMPEZA'),
  (90, 207, 'ZELADOR'),
  (91, 134, 'MOTORISTA'),
  (92, 8, 'ALMOXARIFE'),
  (93, 64, 'AUXILIAR DE MANUTENCAO PREDIAL'),
  (94, 57, 'AUXILIAR DE ALMOXARIDADO'),
  (95, 104, 'EXUMADOR'),
  (96, 58, 'AUXILIAR DE ALMOXARIFADO'),
  (97, 87, 'COVEIRO'),
  (98, 3, 'AJUDANTE DE CARGA E DESCARGA'),
  (99, 128, 'MECANICO'),
  (100, 174, 'SUPERVISOR ADMINISTRATIVO'),
  (101, 169, 'SERVENTE DE OBRAS - MEIO OFICIAL'),
  (102, 67, 'AUXILIAR DE SERVICOS GERAIS'),
  (103, 152, 'PEDREIRO - OFICIAL'),
  (104, 84, 'COPEIRO'),
  (105, 101, 'ESTAGIARIO'),
  (106, 144, 'OPERADOR DE BOB-CAT'),
  (107, 132, 'MERENDEIRA'),
  (108, 30, 'ARQUIVISTA'),
  (109, 143, 'OFICIAL DE MANUTENÇAO PREDIAL'),
  (110, 59, 'AUXILIAR DE ARQUIVO'),
  (111, 97, 'ELETRICISTA'),
  (112, 125, 'MAQUEIRO'),
  (113, 195, 'TELEFONISTA'),
  (114, 164, 'SECRETARIO EXECUTIVO'),
  (115, 148, 'OPERADOR DE MAQUINAS'),
  (116, 192, 'TECNICO EM SECRETARIADO'),
  (117, 199, 'TRATORISTA'),
  (118, 99, 'ENCARREGADO ADMINISTRATIVO'),
  (119, 138, 'MOTORISTA DE CAMINHAO'),
  (120, 195, 'TELEFONISTA'),
  (121, 128, 'MECANICO'),
  (122, 63, 'AUXILIAR DE LIMPEZA'),
  (123, 130, 'MEIO OFICIAL - PEDREIRO'),
  (124, 141, 'OFICIAL - LIDER DE MANUTENCAO PREDIAL'),
  (125, 194, 'TELEATENDENTE'),
  (126, 142, 'OFICIAL DE MANUTENCAO'),
  (127, 129, 'MEIO OFICIAL'),
  (128, 129, 'MEIO OFICIAL'),
  (129, 60, 'AUXILIAR DE COZINHA'),
  (130, 113, 'LAVADOR DE ROUPAS A MAQUINA'),
  (131, 85, 'COSTUREIRO'),
  (132, 75, 'CAMAREIRO'),
  (133, 114, 'LAVADOR DE VEICULO'),
  (134, 82, 'COLETOR DE LIXO'),
  (135, 52, 'ATENDENTE DE CRECHE'),
  (136, 71, 'AUXILIAR EM SAUDE BUCAL'),
  (137, 182, 'SUPERVISOR DE SERVICOS DE SAUDE'),
  (138, 134, 'MOTORISTA'),
  (139, 198, 'TRADUTOR E INTERPRETE DE LIBRAS'),
  (140, 197, 'TRABALHADOR VOLANTE DA AGRICULTURA'),
  (141, 78, 'CARREGADOR'),
  (142, 74, 'AUXLIAR DE ALMOXARIFADO'),
  (143, 69, 'AUXILIAR DE VETERINARIO'),
  (144, 160, 'RECEPCIONISTA HOSPITALAR'),
  (145, 110, 'GUARDADOR DE VEÍCULOS'),
  (146, 154, 'PORTEIRO'),
  (147, 181, 'SUPERVISOR DE RECEPCIONISTAS'),
  (148, 159, 'RECEPCIONISTA BILINGUE'),
  (149, 132, 'MERENDEIRA'),
  (150, 81, 'CARREGADOR NAO EXCLUSIVO'),
  (151, 194, 'TELEATENDENTE'),
  (152, 32, 'ASSISTENTE ADMINISTRATIVO'),
  (153, 176, 'SUPERVISOR DE ATENDIMENTO'),
  (154, 102, 'ESTAGIARIO EM  PEDAGOGIA'),
  (155, 135, 'MOTORISTA CAT B'),
  (156, 136, 'MOTORISTA CAT C'),
  (157, 137, 'MOTORISTA CAT D'),
  (158, 76, 'Sem Nome'),
  (159, 145, 'OPERADOR DE ESCAVADEIRA'),
  (160, 183, 'SUPERVISOR DE TRANSPORTES'),
  (161, 186, 'SUPERVISOR TECNICO OPERACIONAL'),
  (162, 83, 'COORDENADOR ADMINISTRATIVO'),
  (163, 6, 'ALMOX. HU DIURNO 12X36'),
  (164, 7, 'ALMOX. HU NOTURNO 12X36'),
  (165, 4, 'ALMOX. HU 36H 6X1'),
  (166, 5, 'ALMOX. HU 40H 5X2'),
  (167, 80, 'CARREGADOR HU 40H 5X2 INSALUB.'),
  (168, 79, 'CARREGADOR HU 40H 5X2'),
  (169, 86, 'COSTUREIRO HU 40H 5X2'),
  (170, 127, 'MAQUEIRO HU 30H 5X2 INSALUB.'),
  (171, 163, 'ROUPEIRO 44H 6X1 INSALUB.'),
  (172, 126, 'MAQUEIRO HU 30H 5X2'),
  (173, 161, 'ROUPEIRO 220H  12X36'),
  (174, 103, 'ESTAGIO ADMINISTRATIVO'),
  (175, 120, 'LIDER DE RECURSOS HUMANOS'),
  (176, 124, 'LIDER OPERACIONAL'),
  (177, 118, 'LIDER DE LICITACOES'),
  (178, 122, 'LIDER FINANCEIRO'),
  (179, 115, 'LIDER DE COMPRAS'),
  (180, 119, 'LIDER DE QUALIDADE'),
  (181, 117, 'LIDER DE IMPORTAÇÃO'),
  (182, 1, 'ADVOGADO'),
  (183, 131, 'MENSAGEIRO'),
  (193, 123, 'LIDER JURIDICO'),
  (198, 41, 'ASSISTENTE FINANCEIRO I'),
  (202, 43, 'ASSISTENTE FINANCEIRO III'),
  (203, 149, 'OPERADOR DE RADIO CHAMADA - OPERADOR CENTRAL DE MONITORAMENT'),
  (204, 173, 'SUPERVISOR'),
  (211, 171, 'SERVIÇOS GERAIS-CARGA E DESCAR'),
  (212, 9, 'ANALISTA DE COMPRAS JUNIOR'),
  (213, 180, 'SUPERVISOR DE LIMPEZA'),
  (217, 28, 'APRENDIZ'),
  (229, 107, 'GERENTE DE SUPLY'),
  (1051, 88, 'COZINHEIRA'),
  (1100, 13, 'ANALISTA DE DEP PESSOAL I'),
  (1101, 38, 'ASSISTENTE DE DEP PESSOAL II'),
  (1102, 21, 'ANALISTA FINANCEIRO I'),
  (1103, 22, 'ANALISTA FINANCEIRO II'),
  (1104, 14, 'ANALISTA DE DEP PESSOAL JR'),
  (1105, 35, 'ASSISTENTE DE COMPRAS I'),
  (1106, 50, 'ASSISTENTE OPERACIONAL III'),
  (1107, 50, 'ASSISTENTE OPERACIONAL III')
) AS v(antigo, novo, nome)
WHERE e."Cargo" = v.antigo;

NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- CARGOS — tabela de referência de cargos (migration 20260702000001)
--
-- "Cargo" (código) e "Nome do Cargo" deixam de ser campos independentes na
-- EMPREGADOS: passam a referenciar esta tabela. A tela RH → Colaboradores
-- seleciona o cargo daqui e permite criar um novo (que recebe o próximo
-- código sequencial).
--
-- A tabela pode já ter sido criada à mão no banco do app (Table Editor) —
-- tudo aqui é idempotente: garante PK, unicidade de nome, RLS/GRANT e
-- semeia a partir dos pares (Cargo, Nome do Cargo) já gravados na
-- EMPREGADOS pela recodificação (migration 20260701000003).
-- =========================================================================

CREATE TABLE IF NOT EXISTS public."CARGOS" (
  "Cargo"         bigint NOT NULL,
  "Nome do Cargo" text   NOT NULL
);

-- PK em "Cargo" (a tabela criada à mão pode não ter).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."CARGOS"'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public."CARGOS" ADD PRIMARY KEY ("Cargo");
  END IF;
END $$;

-- Um código por nome: evita cadastrar o mesmo cargo duas vezes.
CREATE UNIQUE INDEX IF NOT EXISTS cargos_nome_unico
  ON public."CARGOS" (upper(btrim("Nome do Cargo")));

-- Semeia com o que a recodificação já gravou na EMPREGADOS
-- (ignora "Vazio" e os marcados como ambíguos).
INSERT INTO public."CARGOS" ("Cargo", "Nome do Cargo")
SELECT DISTINCT ON (e."Cargo") e."Cargo", btrim(e."Nome do Cargo")
FROM public."EMPREGADOS" e
WHERE e."Cargo" IS NOT NULL
  AND COALESCE(btrim(e."Nome do Cargo"), '') NOT IN ('', 'Vazio', 'AMBÍGUO - REVISAR MANUALMENTE')
ORDER BY e."Cargo"
ON CONFLICT DO NOTHING;

-- Tabela criada pelo Table Editor vem com RLS ligado e SEM policy — o app
-- (authenticated) lê vazio. Libera leitura/escrita para usuários logados.
ALTER TABLE public."CARGOS" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."CARGOS" TO authenticated;
DROP POLICY IF EXISTS cargos_all_auth ON public."CARGOS";
CREATE POLICY cargos_all_auth ON public."CARGOS"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- WA_CURRICULOS — nome do candidato SEMPRE em maiúsculo (migration 20260702000002)
--
-- O nome digitado no portal público (e o que vier do bot do WhatsApp) é
-- normalizado para maiúsculo no banco, via trigger — assim vale para
-- qualquer origem, não só o formulário do site. Também corrige os
-- registros já existentes. Idempotente.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.wa_curriculos_nome_upper()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.nome IS NOT NULL THEN NEW.nome := upper(btrim(NEW.nome)); END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_wa_curriculos_nome_upper ON public."WA_CURRICULOS";
CREATE TRIGGER trg_wa_curriculos_nome_upper
  BEFORE INSERT OR UPDATE OF nome ON public."WA_CURRICULOS"
  FOR EACH ROW EXECUTE FUNCTION public.wa_curriculos_nome_upper();

-- Corrige os registros já gravados.
UPDATE public."WA_CURRICULOS"
SET nome = upper(btrim(nome))
WHERE nome IS NOT NULL AND nome <> upper(btrim(nome));

NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- SST — link do Google Maps do local do exame (migration 20260702000003)
--
-- Além do texto livre "Local do exame", o SST pode colar o link do Google
-- Maps do lugar exato (Compartilhar → Copiar link). A coluna entra na
-- VW_RECRUTAMENTO_CANDIDATOS (recriada com TODAS as colunas + a nova).
-- Idempotente.
-- =========================================================================

ALTER TABLE public."WA_CURRICULOS"
  ADD COLUMN IF NOT EXISTS sst_maps_url text;

DROP VIEW IF EXISTS public."VW_RECRUTAMENTO_CANDIDATOS";
CREATE VIEW public."VW_RECRUTAMENTO_CANDIDATOS" AS
  SELECT
    c.id AS candidato_id, c.vaga_id, c.nome, c.telefone, c.email,
    COALESCE(c.cpf, c.cpf_cand) AS cpf, c.origem, c.storage_path, c.mensagem,
    c.etapa_processo, c.etapa_changed_at, c.selecionado_por, c.selecionado_em,
    c.juridico_ok, c.juridico_obs, c.juridico_por, c.juridico_em,
    c.sst_ok, c.sst_obs, c.sst_por, c.sst_em,
    c.sst_data_exame, c.sst_hora_exame, c.sst_local_exame, c.sst_agendado_por, c.sst_agendado_em,
    c.sst_maps_url,
    c.compras_necessidades, c.compras_por, c.compras_em, c.compras_obs, c.compras_data_chegada,
    c.epis_informados, c.epis_informados_em,
    c.enviado_admissao_por, c.enviado_admissao_em,
    c.admitido_por, c.admitido_em, c.empregado_id, c.motivo_reprovacao,
    c.experiencia_1, c.experiencia_2, c.experiencia_3, c.favorito, c.tipo_candidatura,
    c.created_at AS candidatura_em,
    s.cargo, s.contrato, s.cidade, s.status AS vaga_status,
    s.motivo_vaga, s.nome_substituido, s.escala, s.horario, s.salario,
    s.beneficios, s.insalubridade_recebe, s.insalubridade_quanto, s.local_exato,
    s.data_inicio_prevista, s.quantidade_vagas, s.req_obrigatorios, s.req_desejaveis,
    s.exp_minima, s.exp_minima_qual, s.grau_urgencia, s.solicitante_nome,
    (b.cpf_digits IS NOT NULL) AS possui_restricao, b.motivo AS restricao_motivo
  FROM public."WA_CURRICULOS" c
  JOIN public."SISTEMA_RECRUTAMENTO" s ON s.id = c.vaga_id
  LEFT JOIN public."RECRUTAMENTO_CPF_BLACKLIST" b
    ON b.cpf_digits = regexp_replace(COALESCE(c.cpf, c.cpf_cand, ''), '\D', '', 'g')
  WHERE c.etapa_processo IS NOT NULL;

GRANT SELECT ON public."VW_RECRUTAMENTO_CANDIDATOS" TO authenticated;

NOTIFY pgrst, 'reload schema';


-- ===== 20260709000002_central_servicos_denuncias =====
-- =========================================================================
-- CENTRAL DE SERVIÇOS — Denúncias (Canal de Ética / Contato Seguro)
--
-- Espelho local das denúncias ANÔNIMAS registradas na plataforma Contato
-- Seguro, sincronizadas pela edge function sync-denuncias-contato-seguro
-- (service role — bypassa RLS). LEITURA SOMENTE PARA ADMIN: nenhuma policy
-- de INSERT/UPDATE/DELETE para authenticated; a escrita é exclusiva do sync.
--
-- CS_DENUNCIAS          — uma linha por denúncia (upsert por cs_id).
-- CS_DENUNCIAS_SYNC_LOG — histórico das execuções do sync.
-- Idempotente.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public."CS_DENUNCIAS" (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cs_id                text NOT NULL UNIQUE,   -- identificador da denúncia na Contato Seguro
  protocolo            text,
  categoria            text,
  assunto              text,
  relato               text,
  status               text,
  canal                text,                   -- site / app / telefone / whatsapp
  empresa              text,
  area                 text,
  criado_na_origem     timestamptz,
  atualizado_na_origem timestamptz,
  raw                  jsonb NOT NULL DEFAULT '{}'::jsonb,  -- payload completo da API (à prova de campos novos)
  sincronizado_em      timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cs_denuncias_status_idx    ON public."CS_DENUNCIAS"(status);
CREATE INDEX IF NOT EXISTS cs_denuncias_categoria_idx ON public."CS_DENUNCIAS"(categoria);
CREATE INDEX IF NOT EXISTS cs_denuncias_criado_idx    ON public."CS_DENUNCIAS"(criado_na_origem DESC);

CREATE TABLE IF NOT EXISTS public."CS_DENUNCIAS_SYNC_LOG" (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  executado_em    timestamptz NOT NULL DEFAULT now(),
  executado_por   uuid,
  sucesso         boolean NOT NULL DEFAULT false,
  mensagem        text,
  total_recebidas integer,
  novas           integer,
  atualizadas     integer
);

ALTER TABLE public."CS_DENUNCIAS"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CS_DENUNCIAS_SYNC_LOG" ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public."CS_DENUNCIAS"          TO authenticated;
GRANT SELECT ON public."CS_DENUNCIAS_SYNC_LOG" TO authenticated;

-- Leitura: SOMENTE admin. Escrita: nenhuma policy — só o service role (sync).
DROP POLICY IF EXISTS cs_denuncias_select_admin ON public."CS_DENUNCIAS";
CREATE POLICY cs_denuncias_select_admin ON public."CS_DENUNCIAS"
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS cs_denuncias_sync_log_select_admin ON public."CS_DENUNCIAS_SYNC_LOG";
CREATE POLICY cs_denuncias_sync_log_select_admin ON public."CS_DENUNCIAS_SYNC_LOG"
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Garante o módulo pai (20260625000003). A tela do hub (/app/central-servicos)
-- é cadastrada UMA única vez, guardada por rota, na seção 20260710000003.
INSERT INTO public.app_modulo (codigo, nome, ordem, icone)
SELECT 'central_servicos', 'Central de Serviços',
       COALESCE((SELECT ordem FROM public.app_modulo WHERE codigo = 'sistemas'), 200) + 5,
       'Headset'
WHERE NOT EXISTS (SELECT 1 FROM public.app_modulo WHERE codigo = 'central_servicos');

-- Tela na matriz de menus. A liberação para os admins é feita em
-- 20260709000005 (a RPC list_accessible_menus vigente exige allow=true
-- explícito por usuário — sem bypass de role). Mesmo que alguém sem papel
-- admin ganhe o menu, a RLS acima continua bloqueando os dados.
INSERT INTO public.app_menu (modulo_id, codigo, nome, rota, ordem)
SELECT m.id, x.codigo, x.nome, x.rota, x.ordem
  FROM (VALUES
    ('central_servicos_denuncias', 'Denúncias (Canal de Ética)', '/app/central-servicos/denuncias', 20)
  ) AS x(codigo, nome, rota, ordem)
  JOIN public.app_modulo m ON m.codigo = 'central_servicos'
ON CONFLICT (modulo_id, codigo) DO NOTHING;

NOTIFY pgrst, 'reload schema';


-- ===== 20260709000003_cs_denuncias_config_vault =====
-- =========================================================================
-- CENTRAL DE SERVIÇOS — Denúncias: config da integração via Supabase Vault
--
-- A conta que administra este projeto no CLI não tem privilégio de org para
-- gravar secrets de edge function, então as credenciais da Contato Seguro
-- vivem no Vault (criptografadas). Esta função é a ÚNICA porta de leitura e
-- só o service_role (edge function) pode executá-la.
--
-- Os VALORES não ficam no repositório: são criados direto no banco com
--   SELECT vault.create_secret('<valor>', 'cs_api_key',  'API Key Contato Seguro');
--   SELECT vault.create_secret('<valor>', 'cs_api_secret','Secret Contato Seguro');
--   SELECT vault.create_secret('<url>',   'cs_base_url',  'Base URL Contato Seguro');
--   SELECT vault.create_secret('<rota>',  'cs_complaints_path', 'Rota de denúncias');
-- (para trocar TST→PROD, atualizar com vault.update_secret)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.cs_denuncias_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $fn$
  SELECT COALESCE(jsonb_object_agg(name, decrypted_secret), '{}'::jsonb)
    FROM vault.decrypted_secrets
   WHERE name IN ('cs_api_key','cs_api_secret','cs_base_url','cs_complaints_path');
$fn$;

REVOKE ALL ON FUNCTION public.cs_denuncias_config() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cs_denuncias_config() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cs_denuncias_config() TO service_role;


-- ===== 20260709000004_cs_denuncias_responsaveis =====
-- =========================================================================
-- CENTRAL DE SERVIÇOS — Denúncias: responsáveis pelo tratamento
--
-- CS_DENUNCIAS_RESPONSAVEIS — lista (curada pelos admins) de quem cuida das
-- denúncias do Canal de Ética. Colunas responsavel_* em CS_DENUNCIAS
-- registram o responsável atribuído a cada denúncia.
--
-- Visibilidade continua SOMENTE ADMIN (regra do módulo): estar na lista de
-- responsáveis NÃO concede leitura — é registro/atribuição. Se um dia os
-- responsáveis não-admin precisarem ver as denúncias deles, estender a
-- policy de SELECT de CS_DENUNCIAS.
-- Idempotente.
-- =========================================================================

ALTER TABLE public."CS_DENUNCIAS"
  ADD COLUMN IF NOT EXISTS responsavel_user_id      uuid,
  ADD COLUMN IF NOT EXISTS responsavel_definido_em  timestamptz,
  ADD COLUMN IF NOT EXISTS responsavel_definido_por uuid;

CREATE INDEX IF NOT EXISTS cs_denuncias_responsavel_idx
  ON public."CS_DENUNCIAS"(responsavel_user_id);

CREATE TABLE IF NOT EXISTS public."CS_DENUNCIAS_RESPONSAVEIS" (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public."CS_DENUNCIAS_RESPONSAVEIS" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public."CS_DENUNCIAS_RESPONSAVEIS" TO authenticated;

DROP POLICY IF EXISTS cs_denuncias_resp_select_admin ON public."CS_DENUNCIAS_RESPONSAVEIS";
CREATE POLICY cs_denuncias_resp_select_admin ON public."CS_DENUNCIAS_RESPONSAVEIS"
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS cs_denuncias_resp_insert_admin ON public."CS_DENUNCIAS_RESPONSAVEIS";
CREATE POLICY cs_denuncias_resp_insert_admin ON public."CS_DENUNCIAS_RESPONSAVEIS"
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS cs_denuncias_resp_delete_admin ON public."CS_DENUNCIAS_RESPONSAVEIS";
CREATE POLICY cs_denuncias_resp_delete_admin ON public."CS_DENUNCIAS_RESPONSAVEIS"
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Atribuição de responsável pelo app: UPDATE de admins limitado (grant por
-- coluna) aos campos responsavel_* — o conteúdo da denúncia continua
-- imutável pela API; só o sync (service role) escreve o resto.
GRANT UPDATE (responsavel_user_id, responsavel_definido_em, responsavel_definido_por)
  ON public."CS_DENUNCIAS" TO authenticated;

DROP POLICY IF EXISTS cs_denuncias_update_admin ON public."CS_DENUNCIAS";
CREATE POLICY cs_denuncias_update_admin ON public."CS_DENUNCIAS"
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

NOTIFY pgrst, 'reload schema';


-- ===== 20260710000001_drop_tabelas_comentarios_legadas =====
-- =========================================================================
-- COMENTÁRIOS — remove de vez as tabelas legadas duplicadas
-- JUR_COMENTARIOS e SISTEMA_JURIDICO_COMENTARIOS foram substituídas pelo
-- feed único SISTEMA_COMENTARIOS (modulo + entidade_id) na 016, mas
-- continuavam existindo porque os CREATEs legados eram reexecutados.
-- Idempotente: migra o que ainda houver e dropa as duas.
-- =========================================================================
DO $$
BEGIN
  IF to_regclass('public."JUR_COMENTARIOS"') IS NOT NULL THEN
    INSERT INTO public."SISTEMA_COMENTARIOS" (modulo, entidade_id, autor_nome, texto, created_at)
    SELECT 'patrimonio', c.patrimonio_id::text, c.autor, c.texto, c.created_at
      FROM public."JUR_COMENTARIOS" c
     WHERE c.patrimonio_id IS NOT NULL
       AND NOT EXISTS (
             SELECT 1 FROM public."SISTEMA_COMENTARIOS" s
              WHERE s.modulo = 'patrimonio'
                AND s.entidade_id = c.patrimonio_id::text
                AND s.texto = c.texto
                AND s.created_at = c.created_at
           );
    DROP TABLE public."JUR_COMENTARIOS";
  END IF;

  IF to_regclass('public."SISTEMA_JURIDICO_COMENTARIOS"') IS NOT NULL THEN
    INSERT INTO public."SISTEMA_COMENTARIOS" (modulo, entidade_id, autor_nome, texto, created_at)
    SELECT 'processo', c.numero_processo, c.autor, c.comentario, c.criado_em
      FROM public."SISTEMA_JURIDICO_COMENTARIOS" c
     WHERE c.numero_processo IS NOT NULL
       AND NOT EXISTS (
             SELECT 1 FROM public."SISTEMA_COMENTARIOS" s
              WHERE s.modulo = 'processo'
                AND s.entidade_id = c.numero_processo
                AND s.texto = c.comentario
                AND s.created_at = c.criado_em
           );
    DROP TABLE public."SISTEMA_JURIDICO_COMENTARIOS";
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
