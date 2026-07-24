-- =========================================================================
-- RH — HIERARQUIA
--
-- A hierarquia da empresa tem DOIS eixos e nenhum deles é digitado à mão:
--
--   1. Administrativo (por setor): dentro de cada Setor_ERP, a ordem sai do
--      nível em EMPREGADOS.LIDER (GERENTE › COORDENADOR › SUPERVISOR …), e o
--      staff sem nível entra por cargo. Isso é 100% derivado do cadastro.
--
--   2. Operacional (por contrato): a coluna EMPREGADOS."Descrição do Local" é
--      o NOME DO CONTRATO a que o colaborador pertence. Cada contrato tem um
--      ENCARREGADO, e todo mundo daquele contrato fica sob ele. Só que "qual
--      encarregado responde por qual contrato" nem sempre está no cadastro de
--      forma confiável — é o que ESTA tabela guarda: a designação, por contrato.
--
-- Ou seja: a árvore é calculada ao vivo do cadastro; esta tabela guarda apenas
-- a CONFIGURAÇÃO que o cadastro não resolve sozinho — o encarregado de cada
-- contrato. Contrato sem linha aqui cai na sugestão automática (o membro com
-- nível ENCARREGADO), e fica sinalizado como "a definir".
-- =========================================================================

CREATE TABLE IF NOT EXISTS public."RH_CONTRATO_ENCARREGADO" (
  contrato          text PRIMARY KEY,        -- = EMPREGADOS."Descrição do Local"
  encarregado_id    bigint NOT NULL,         -- EMPREGADOS."ID" escolhido
  encarregado_nome  text,                    -- cópia p/ exibir sem novo join
  setor             text,                    -- setor predominante do contrato (referência)
  observacao        text,
  definido_por      uuid DEFAULT auth.uid(),
  definido_por_nome text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.rh_contrato_enc_touch() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS rh_contrato_enc_touch_trg ON public."RH_CONTRATO_ENCARREGADO";
CREATE TRIGGER rh_contrato_enc_touch_trg BEFORE UPDATE ON public."RH_CONTRATO_ENCARREGADO"
  FOR EACH ROW EXECUTE FUNCTION public.rh_contrato_enc_touch();

-- ── Permissões ───────────────────────────────────────────────────────────
-- Acesso ao módulo RH é controlado pelo menu (app_menu/profiles); aqui basta
-- exigir usuário autenticado. anon nunca toca.
ALTER TABLE public."RH_CONTRATO_ENCARREGADO" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."RH_CONTRATO_ENCARREGADO" FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."RH_CONTRATO_ENCARREGADO" TO authenticated;

DROP POLICY IF EXISTS rh_contrato_enc_all ON public."RH_CONTRATO_ENCARREGADO";
CREATE POLICY rh_contrato_enc_all ON public."RH_CONTRATO_ENCARREGADO"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Leitura da hierarquia (RPC) ────────────────────────────────────────────
-- Ler EMPREGADOS direto do cliente (PostgREST) estoura o statement_timeout num
-- cadastro grande — o mesmo motivo que fez a tela de Colaboradores ler por RPC.
-- Aqui devolvemos só os campos da hierarquia, numa chamada, server-side.
-- SECURITY DEFINER: não paga o custo por-linha da RLS da EMPREGADOS. Expõe a
-- estrutura (nome/setor/nível/cargo/contrato) org-wide, que é a natureza da
-- tela; troque para SECURITY INVOKER se precisar restringir por empresa.
-- plpgsql (não `sql`) de propósito: função SQL valida o corpo na criação e
-- pega lock em EMPREGADOS; plpgsql resolve a tabela só na 1ª execução, então
-- criar a função não disputa lock com o app (evita deadlock com a leitura viva).
CREATE OR REPLACE FUNCTION public.rh_hierarquia_dados()
RETURNS TABLE (id bigint, nome text, setor text, nivel text, cargo text, local_desc text, situacao text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    e."ID"::bigint,
    btrim(coalesce(e."Nome", '')),
    btrim(coalesce(e."Setor_ERP", '')),
    btrim(coalesce(e."LIDER", '')),
    coalesce(nullif(btrim(coalesce(e."Título do Cargo", '')), ''),
             nullif(btrim(coalesce(e."Nome do Cargo", '')), ''), ''),
    btrim(coalesce(e."Descrição do Local", '')),
    btrim(coalesce(e."Situação", ''))
  FROM public."EMPREGADOS" e;
END $$;
REVOKE ALL ON FUNCTION public.rh_hierarquia_dados() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rh_hierarquia_dados() TO authenticated;

NOTIFY pgrst, 'reload schema';
