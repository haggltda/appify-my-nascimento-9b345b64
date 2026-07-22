-- FASE 3 (complemento) — reescreve has_permissao(user,modulo,acao,menu), a
-- 3ª função de gate que nunca tinha sido migrada para o modelo perfil_acesso
-- (ficou fora das Fases 1/3 porque usa uma assinatura diferente de
-- has_screen_access/can_access). Ela ainda fazia:
--   EXISTS(...role='admin') OR (user_roles JOIN role_permissions ...)
-- ou seja, mantinha o mesmo bypass de admin master que motivou toda essa
-- refatoração, só que por um caminho que o has_screen_access/can_access
-- não cobria.
--
-- Efeito desta migration: has_permissao passa a delegar 100% em can_access
-- (perfil_acesso), sem nenhum parâmetro extra. Como o nome da função e a
-- assinatura não mudam, NENHUM call site precisa ser alterado — os únicos
-- 2 valores de _menu usados hoje fora de 'composicao' são strings de
-- sub-recurso que não são um app_menu.codigo real
-- ('fornecedor.conta_bancaria', 'colaborador.conta_bancaria'); mapeamos os
-- dois para o menu real da tela-mãe (fornecedores/colaboradores) — a conta
-- bancária é uma aba dentro do cadastro de fornecedor/colaborador, não uma
-- tela própria no app_menu.
--
-- Isso fecha de uma vez:
--   • fornecedor_conta_bancaria (Suprimentos, políticas fcb_* de
--     20260527022852) — reabria o vazamento que o hotfix
--     20260717190001 achou que tinha fechado (aquele hotfix só removeu uma
--     policy órfã duplicada; as políticas fcb_* que sobraram continuavam
--     chamando has_permissao, que por sua vez ainda tinha o bypass).
--   • colaborador_conta_bancaria (RH, mesma migration 20260518191240) —
--     módulo ainda não tocado por nenhum lote da Fase 3.
--   • bdi_versao/bdi_posto/bdi_verba_folha/bdi_item/bdi_aprovacao/
--     bdi_snapshot (Licitações — Composição & BDI).
--
-- As políticas fcb_*/colab_conta/bdi_* também tinham
-- `has_role(auth.uid(),'admin') OR (...)` direto além do has_permissao —
-- removido junto, já que com has_permissao corrigido o bypass extra é
-- redundante e reabre a mesma porta.
--
-- Também tinham `user_pode_atuar_empresa(...)` como condição adicional nas
-- tabelas bdi_* — removido pelo mesmo motivo de sempre (empresa não é mais
-- critério de acesso, só perfil_acesso). NÃO removido: a policy
-- fcb_insert/update mantém o EXISTS que confere se o fornecedor referenciado
-- é global ou da mesma empresa da conta — isso é integridade de dado
-- (a conta pertence ao fornecedor certo), não controle de acesso.

CREATE OR REPLACE FUNCTION public.has_permissao(_user uuid, _modulo text, _acao text, _menu text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_access(
    _user,
    CASE _menu
      WHEN 'fornecedor.conta_bancaria'  THEN 'fornecedores'
      WHEN 'colaborador.conta_bancaria' THEN 'colaboradores'
      ELSE _menu
    END,
    _acao::app_acao
  );
$$;

-- ── fornecedor_conta_bancaria ────────────────────────────────────────────
DROP POLICY IF EXISTS fcb_select ON public.fornecedor_conta_bancaria;
CREATE POLICY fcb_select ON public.fornecedor_conta_bancaria FOR SELECT TO authenticated
  USING (public.has_permissao(auth.uid(), 'suprimentos', 'visualizar', 'fornecedor.conta_bancaria'));

DROP POLICY IF EXISTS fcb_insert ON public.fornecedor_conta_bancaria;
CREATE POLICY fcb_insert ON public.fornecedor_conta_bancaria FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permissao(auth.uid(), 'suprimentos', 'incluir', 'fornecedor.conta_bancaria')
    AND EXISTS (
      SELECT 1 FROM public.fornecedor f
      WHERE f.id = fornecedor_conta_bancaria.fornecedor_id
        AND (f.is_global = true OR f.empresa_id = fornecedor_conta_bancaria.empresa_id)
    )
  );

DROP POLICY IF EXISTS fcb_update ON public.fornecedor_conta_bancaria;
CREATE POLICY fcb_update ON public.fornecedor_conta_bancaria FOR UPDATE TO authenticated
  USING (public.has_permissao(auth.uid(), 'suprimentos', 'alterar', 'fornecedor.conta_bancaria'))
  WITH CHECK (
    public.has_permissao(auth.uid(), 'suprimentos', 'alterar', 'fornecedor.conta_bancaria')
    AND EXISTS (
      SELECT 1 FROM public.fornecedor f
      WHERE f.id = fornecedor_conta_bancaria.fornecedor_id
        AND (f.is_global = true OR f.empresa_id = fornecedor_conta_bancaria.empresa_id)
    )
  );

DROP POLICY IF EXISTS fcb_delete ON public.fornecedor_conta_bancaria;
CREATE POLICY fcb_delete ON public.fornecedor_conta_bancaria FOR DELETE TO authenticated
  USING (public.has_permissao(auth.uid(), 'suprimentos', 'excluir', 'fornecedor.conta_bancaria'));

-- ── colaborador_conta_bancaria ───────────────────────────────────────────
DROP POLICY IF EXISTS "perm select colab_conta" ON public.colaborador_conta_bancaria;
CREATE POLICY "perm select colab_conta" ON public.colaborador_conta_bancaria FOR SELECT TO authenticated
  USING (public.has_permissao(auth.uid(), 'rh', 'visualizar', 'colaborador.conta_bancaria'));

DROP POLICY IF EXISTS "perm insert colab_conta" ON public.colaborador_conta_bancaria;
CREATE POLICY "perm insert colab_conta" ON public.colaborador_conta_bancaria FOR INSERT TO authenticated
  WITH CHECK (public.has_permissao(auth.uid(), 'rh', 'incluir', 'colaborador.conta_bancaria'));

DROP POLICY IF EXISTS "perm update colab_conta" ON public.colaborador_conta_bancaria;
CREATE POLICY "perm update colab_conta" ON public.colaborador_conta_bancaria FOR UPDATE TO authenticated
  USING (public.has_permissao(auth.uid(), 'rh', 'alterar', 'colaborador.conta_bancaria'))
  WITH CHECK (public.has_permissao(auth.uid(), 'rh', 'alterar', 'colaborador.conta_bancaria'));

DROP POLICY IF EXISTS "perm delete colab_conta" ON public.colaborador_conta_bancaria;
CREATE POLICY "perm delete colab_conta" ON public.colaborador_conta_bancaria FOR DELETE TO authenticated
  USING (public.has_permissao(auth.uid(), 'rh', 'excluir', 'colaborador.conta_bancaria'));

-- ── bdi_versao ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "bdi_versao_select_empresa" ON public.bdi_versao;
CREATE POLICY bdi_versao_select ON public.bdi_versao FOR SELECT TO authenticated
  USING (public.has_permissao(auth.uid(), 'licitacoes', 'visualizar', 'composicao'));

DROP POLICY IF EXISTS "bdi_versao_insert_empresa" ON public.bdi_versao;
CREATE POLICY bdi_versao_insert ON public.bdi_versao FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permissao(auth.uid(), 'licitacoes', 'incluir', 'composicao')
    AND status = 'rascunho'
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "bdi_versao_update_empresa" ON public.bdi_versao;
CREATE POLICY bdi_versao_update ON public.bdi_versao FOR UPDATE TO authenticated
  USING (
    public.has_permissao(auth.uid(), 'licitacoes', 'alterar', 'composicao')
    AND status IN ('rascunho','em_revisao')
  )
  WITH CHECK (
    public.has_permissao(auth.uid(), 'licitacoes', 'alterar', 'composicao')
    AND status IN ('rascunho','em_revisao')
  );

DROP POLICY IF EXISTS "bdi_versao_delete_admin_rascunho" ON public.bdi_versao;
CREATE POLICY bdi_versao_delete ON public.bdi_versao FOR DELETE TO authenticated
  USING (
    public.has_permissao(auth.uid(), 'licitacoes', 'excluir', 'composicao')
    AND status = 'rascunho'
  );

-- ── bdi_posto ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "bdi_posto_select_empresa" ON public.bdi_posto;
CREATE POLICY bdi_posto_select ON public.bdi_posto FOR SELECT TO authenticated
  USING (public.has_permissao(auth.uid(), 'licitacoes', 'visualizar', 'composicao'));

DROP POLICY IF EXISTS "bdi_posto_insert_empresa" ON public.bdi_posto;
CREATE POLICY bdi_posto_insert ON public.bdi_posto FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permissao(auth.uid(), 'licitacoes', 'incluir', 'composicao')
    AND EXISTS (SELECT 1 FROM public.bdi_versao v
                WHERE v.id = bdi_posto.bdi_versao_id
                  AND v.empresa_id = bdi_posto.empresa_id
                  AND v.status IN ('rascunho','em_revisao'))
  );

DROP POLICY IF EXISTS "bdi_posto_update_empresa" ON public.bdi_posto;
CREATE POLICY bdi_posto_update ON public.bdi_posto FOR UPDATE TO authenticated
  USING (
    public.has_permissao(auth.uid(), 'licitacoes', 'alterar', 'composicao')
    AND EXISTS (SELECT 1 FROM public.bdi_versao v
                WHERE v.id = bdi_posto.bdi_versao_id
                  AND v.empresa_id = bdi_posto.empresa_id
                  AND v.status IN ('rascunho','em_revisao'))
  )
  WITH CHECK (
    public.has_permissao(auth.uid(), 'licitacoes', 'alterar', 'composicao')
    AND EXISTS (SELECT 1 FROM public.bdi_versao v
                WHERE v.id = bdi_posto.bdi_versao_id
                  AND v.empresa_id = bdi_posto.empresa_id
                  AND v.status IN ('rascunho','em_revisao'))
  );

DROP POLICY IF EXISTS "bdi_posto_delete_empresa" ON public.bdi_posto;
CREATE POLICY bdi_posto_delete ON public.bdi_posto FOR DELETE TO authenticated
  USING (
    public.has_permissao(auth.uid(), 'licitacoes', 'alterar', 'composicao')
    AND EXISTS (SELECT 1 FROM public.bdi_versao v
                WHERE v.id = bdi_posto.bdi_versao_id
                  AND v.empresa_id = bdi_posto.empresa_id
                  AND v.status IN ('rascunho','em_revisao'))
  );

-- ── bdi_verba_folha ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "bdi_verba_folha_select_empresa" ON public.bdi_verba_folha;
CREATE POLICY bdi_verba_folha_select ON public.bdi_verba_folha FOR SELECT TO authenticated
  USING (public.has_permissao(auth.uid(), 'licitacoes', 'visualizar', 'composicao'));

DROP POLICY IF EXISTS "bdi_verba_folha_insert_empresa" ON public.bdi_verba_folha;
CREATE POLICY bdi_verba_folha_insert ON public.bdi_verba_folha FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permissao(auth.uid(), 'licitacoes', 'incluir', 'composicao')
    AND EXISTS (SELECT 1 FROM public.bdi_versao v
                WHERE v.id = bdi_verba_folha.bdi_versao_id
                  AND v.empresa_id = bdi_verba_folha.empresa_id
                  AND v.status IN ('rascunho','em_revisao'))
  );

DROP POLICY IF EXISTS "bdi_verba_folha_update_empresa" ON public.bdi_verba_folha;
CREATE POLICY bdi_verba_folha_update ON public.bdi_verba_folha FOR UPDATE TO authenticated
  USING (
    public.has_permissao(auth.uid(), 'licitacoes', 'alterar', 'composicao')
    AND EXISTS (SELECT 1 FROM public.bdi_versao v
                WHERE v.id = bdi_verba_folha.bdi_versao_id
                  AND v.empresa_id = bdi_verba_folha.empresa_id
                  AND v.status IN ('rascunho','em_revisao'))
  )
  WITH CHECK (
    public.has_permissao(auth.uid(), 'licitacoes', 'alterar', 'composicao')
    AND EXISTS (SELECT 1 FROM public.bdi_versao v
                WHERE v.id = bdi_verba_folha.bdi_versao_id
                  AND v.empresa_id = bdi_verba_folha.empresa_id
                  AND v.status IN ('rascunho','em_revisao'))
  );

DROP POLICY IF EXISTS "bdi_verba_folha_delete_empresa" ON public.bdi_verba_folha;
CREATE POLICY bdi_verba_folha_delete ON public.bdi_verba_folha FOR DELETE TO authenticated
  USING (
    public.has_permissao(auth.uid(), 'licitacoes', 'alterar', 'composicao')
    AND EXISTS (SELECT 1 FROM public.bdi_versao v
                WHERE v.id = bdi_verba_folha.bdi_versao_id
                  AND v.empresa_id = bdi_verba_folha.empresa_id
                  AND v.status IN ('rascunho','em_revisao'))
  );

-- ── bdi_item ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "bdi_item_select_empresa" ON public.bdi_item;
CREATE POLICY bdi_item_select ON public.bdi_item FOR SELECT TO authenticated
  USING (public.has_permissao(auth.uid(), 'licitacoes', 'visualizar', 'composicao'));

DROP POLICY IF EXISTS "bdi_item_insert_empresa" ON public.bdi_item;
CREATE POLICY bdi_item_insert ON public.bdi_item FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permissao(auth.uid(), 'licitacoes', 'incluir', 'composicao')
    AND EXISTS (SELECT 1 FROM public.bdi_versao v
                WHERE v.id = bdi_item.bdi_versao_id
                  AND v.empresa_id = bdi_item.empresa_id
                  AND v.status IN ('rascunho','em_revisao'))
  );

DROP POLICY IF EXISTS "bdi_item_update_empresa" ON public.bdi_item;
CREATE POLICY bdi_item_update ON public.bdi_item FOR UPDATE TO authenticated
  USING (
    public.has_permissao(auth.uid(), 'licitacoes', 'alterar', 'composicao')
    AND EXISTS (SELECT 1 FROM public.bdi_versao v
                WHERE v.id = bdi_item.bdi_versao_id
                  AND v.empresa_id = bdi_item.empresa_id
                  AND v.status IN ('rascunho','em_revisao'))
  )
  WITH CHECK (
    public.has_permissao(auth.uid(), 'licitacoes', 'alterar', 'composicao')
    AND EXISTS (SELECT 1 FROM public.bdi_versao v
                WHERE v.id = bdi_item.bdi_versao_id
                  AND v.empresa_id = bdi_item.empresa_id
                  AND v.status IN ('rascunho','em_revisao'))
  );

DROP POLICY IF EXISTS "bdi_item_delete_empresa" ON public.bdi_item;
CREATE POLICY bdi_item_delete ON public.bdi_item FOR DELETE TO authenticated
  USING (
    public.has_permissao(auth.uid(), 'licitacoes', 'alterar', 'composicao')
    AND EXISTS (SELECT 1 FROM public.bdi_versao v
                WHERE v.id = bdi_item.bdi_versao_id
                  AND v.empresa_id = bdi_item.empresa_id
                  AND v.status IN ('rascunho','em_revisao'))
  );

-- ── bdi_aprovacao (log interno, só SELECT) ───────────────────────────────
DROP POLICY IF EXISTS "bdi_aprovacao_select_empresa" ON public.bdi_aprovacao;
CREATE POLICY bdi_aprovacao_select ON public.bdi_aprovacao FOR SELECT TO authenticated
  USING (public.has_permissao(auth.uid(), 'licitacoes', 'visualizar', 'composicao'));

-- ── bdi_snapshot (imutável, só SELECT) ────────────────────────────────────
DROP POLICY IF EXISTS "bdi_snapshot_select_empresa" ON public.bdi_snapshot;
CREATE POLICY bdi_snapshot_select ON public.bdi_snapshot FOR SELECT TO authenticated
  USING (public.has_permissao(auth.uid(), 'licitacoes', 'visualizar', 'composicao'));

-- ── RPCs: licitacao_assumir / licitacao_transferir ──────────────────────
-- Removido: has_role(admin) OR ... (redundante — has_permissao já cobre
-- concede_tudo) e o gate de empresa do ATOR (user_pode_atuar_empresa em
-- v_uid). Mantido: em licitacao_transferir, a checagem de que o NOVO
-- responsável (p_novo_user) pertence à empresa da licitação — isso é
-- integridade do dado (não faz sentido transferir para alguém sem nenhum
-- vínculo com a empresa), não é controle de acesso do usuário que está
-- chamando a RPC.

CREATE OR REPLACE FUNCTION public.licitacao_assumir(p_licitacao_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_emp  uuid;
  v_resp uuid;
  v_hist uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth.uid() nulo'; END IF;

  SELECT empresa_id, responsavel_user_id
    INTO v_emp, v_resp
    FROM public.licitacao
   WHERE id = p_licitacao_id
   FOR UPDATE;

  IF v_emp IS NULL THEN RAISE EXCEPTION 'Licitacao nao encontrada'; END IF;

  IF NOT public.has_permissao(v_uid, 'licitacoes', 'alterar', 'composicao') THEN
    RAISE EXCEPTION 'Sem permissao para assumir licitacao';
  END IF;

  IF v_resp IS NOT NULL THEN
    RAISE EXCEPTION 'Licitacao ja possui responsavel; use transferencia';
  END IF;

  PERFORM set_config('app.licitacao_responsavel_rpc','on', true);

  UPDATE public.licitacao
     SET responsavel_user_id = v_uid,
         assumido_em         = now(),
         assumido_por        = v_uid,
         updated_at          = now()
   WHERE id = p_licitacao_id;

  INSERT INTO public.licitacao_responsavel_historico
    (empresa_id, licitacao_id, de_user_id, para_user_id, ator_id, acao, justificativa)
    VALUES (v_emp, p_licitacao_id, NULL, v_uid, v_uid, 'assumir', NULL)
    RETURNING id INTO v_hist;

  RETURN v_hist;
END;
$$;

CREATE OR REPLACE FUNCTION public.licitacao_transferir(
  p_licitacao_id uuid,
  p_novo_user    uuid,
  p_justificativa text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_emp  uuid;
  v_resp uuid;
  v_hist uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth.uid() nulo'; END IF;
  IF p_novo_user IS NULL THEN RAISE EXCEPTION 'Novo responsavel obrigatorio'; END IF;
  IF p_justificativa IS NULL OR length(btrim(p_justificativa)) < 5 THEN
    RAISE EXCEPTION 'Justificativa obrigatoria (min 5 caracteres)';
  END IF;

  SELECT empresa_id, responsavel_user_id
    INTO v_emp, v_resp
    FROM public.licitacao
   WHERE id = p_licitacao_id
   FOR UPDATE;

  IF v_emp IS NULL THEN RAISE EXCEPTION 'Licitacao nao encontrada'; END IF;

  IF v_resp IS NULL THEN
    RAISE EXCEPTION 'Licitacao ainda nao possui responsavel; use licitacao_assumir';
  END IF;

  IF p_novo_user = v_resp THEN
    RAISE EXCEPTION 'Novo responsável deve ser diferente do responsável atual';
  END IF;

  IF NOT public.has_permissao(v_uid, 'licitacoes', 'alterar', 'composicao') THEN
    RAISE EXCEPTION 'Sem permissao para transferir';
  END IF;

  IF NOT public.user_pode_atuar_empresa(p_novo_user, v_emp) THEN
    RAISE EXCEPTION 'Novo responsavel nao pode atuar na empresa';
  END IF;

  PERFORM set_config('app.licitacao_responsavel_rpc','on', true);

  UPDATE public.licitacao
     SET responsavel_user_id = p_novo_user,
         assumido_em         = now(),
         assumido_por        = v_uid,
         updated_at          = now()
   WHERE id = p_licitacao_id;

  INSERT INTO public.licitacao_responsavel_historico
    (empresa_id, licitacao_id, de_user_id, para_user_id, ator_id, acao, justificativa)
    VALUES (v_emp, p_licitacao_id, v_resp, p_novo_user, v_uid, 'transferir', p_justificativa)
    RETURNING id INTO v_hist;

  RETURN v_hist;
END;
$$;

-- Não tocado nesta migration (achado, não ação): as RPCs
-- licitacao_importacao_criar_lote/anexar_linhas/confirmar/cancelar exigem
-- has_role(admin) direto no corpo. Verificado via grep: o componente que as
-- consome (ImportGradeDialog.tsx) não é importado por nenhuma página do
-- app hoje — feature morta/inacessível pela UI, mesmo padrão já visto em
-- RECRUTAMENTO_EPIS (Fase 0). Deixado como admin-only por não ter consumidor
-- real; se um dia a tela for religada, aí sim vale gatear por can_access.

NOTIFY pgrst, 'reload schema';
