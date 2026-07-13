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
