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
