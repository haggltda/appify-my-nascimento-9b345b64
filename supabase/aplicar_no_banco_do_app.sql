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

-- ===== 20260622000001_juridico_patrimonios =====
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

-- ===== 20260622000002_jur_contas =====
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

