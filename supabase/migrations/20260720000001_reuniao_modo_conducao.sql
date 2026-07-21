-- Agenda de Reunião — Fase 3: Modo Condução da Reunião. Reaproveita a
-- máquina de estados que já existe (agendada → em_andamento → concluida);
-- os check-lists de início/encerramento são só dados extras capturados no
-- mesmo instante das transições que já existem (iniciarReuniao/
-- encerrarReuniao) — não cria etapa nova nenhuma.

-- 1) reuniao: checklists + horários reais ------------------------------------
ALTER TABLE public.reuniao
  ADD COLUMN IF NOT EXISTS checklist_inicio jsonb,
  ADD COLUMN IF NOT EXISTS checklist_encerramento jsonb,
  ADD COLUMN IF NOT EXISTS hora_inicio_real timestamptz,
  ADD COLUMN IF NOT EXISTS hora_termino_real timestamptz,
  ADD COLUMN IF NOT EXISTS duracao_real_minutos int;

-- 2) reuniao_pauta: natureza do item ------------------------------------------
ALTER TABLE public.reuniao_pauta
  ADD COLUMN IF NOT EXISTS natureza text
    CHECK (natureza IN ('comunicacao', 'alinhamento', 'decisao', 'acompanhamento', 'problema', 'plano_acao'));

-- 3) reuniao_resposta: perguntas estruturadas da condução ao vivo ------------
ALTER TABLE public.reuniao_resposta
  ADD COLUMN IF NOT EXISTS checklist_conducao jsonb;

-- 4) reuniao_convidado: presença -----------------------------------------------
ALTER TABLE public.reuniao_convidado
  ADD COLUMN IF NOT EXISTS presente boolean;

-- 5) Decisões e Ações, por tópico de pauta ------------------------------------
CREATE TABLE IF NOT EXISTS public.reuniao_decisao_acao (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pauta_id              uuid NOT NULL REFERENCES public.reuniao_pauta(id) ON DELETE CASCADE,
  tipo                  text NOT NULL CHECK (tipo IN ('decisao', 'acao')),
  texto                 text NOT NULL,
  responsavel_user_id   uuid REFERENCES public.profiles(id),
  prazo                 date,
  prioridade            text NOT NULL DEFAULT 'media' CHECK (prioridade IN ('alta', 'media', 'baixa')),
  status                text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida')),
  necessita_comprovacao boolean NOT NULL DEFAULT false,
  setor_impactado       text,
  anexo_storage_path    text,
  criado_por            uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reuniao_decisao_acao_pauta ON public.reuniao_decisao_acao(pauta_id);

ALTER TABLE public.reuniao_decisao_acao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reuniao_decisao_acao_select ON public.reuniao_decisao_acao;
CREATE POLICY reuniao_decisao_acao_select ON public.reuniao_decisao_acao
  FOR SELECT TO authenticated
  USING (
    public.tem_acesso_menu('central_servicos_reunioes')
    AND EXISTS (SELECT 1 FROM public.reuniao_pauta p WHERE p.id = pauta_id AND public.tem_interacao_reuniao(p.reuniao_id))
  );

DROP POLICY IF EXISTS reuniao_decisao_acao_insert ON public.reuniao_decisao_acao;
CREATE POLICY reuniao_decisao_acao_insert ON public.reuniao_decisao_acao
  FOR INSERT TO authenticated
  WITH CHECK (
    public.tem_acesso_menu('central_servicos_reunioes')
    AND EXISTS (SELECT 1 FROM public.reuniao_pauta p WHERE p.id = pauta_id AND public.tem_interacao_reuniao(p.reuniao_id))
  );

DROP POLICY IF EXISTS reuniao_decisao_acao_update ON public.reuniao_decisao_acao;
CREATE POLICY reuniao_decisao_acao_update ON public.reuniao_decisao_acao
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reuniao_pauta p WHERE p.id = pauta_id AND public.tem_interacao_reuniao(p.reuniao_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.reuniao_pauta p WHERE p.id = pauta_id AND public.tem_interacao_reuniao(p.reuniao_id)));

DROP POLICY IF EXISTS reuniao_decisao_acao_delete ON public.reuniao_decisao_acao;
CREATE POLICY reuniao_decisao_acao_delete ON public.reuniao_decisao_acao
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reuniao_pauta p WHERE p.id = pauta_id AND public.tem_interacao_reuniao(p.reuniao_id)));

-- 6) Assuntos fora da pauta ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reuniao_assunto_fora_pauta (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id                  uuid NOT NULL REFERENCES public.reuniao(id) ON DELETE CASCADE,
  classificacao               text NOT NULL CHECK (classificacao IN ('urgente_relevante', 'importante_nao_urgente', 'sem_relacao')),
  tratativa                   text NOT NULL CHECK (tratativa IN ('tratar_agora', 'estacionar', 'encerrar_retornar_pauta')),
  assunto_estacionado         text,
  responsavel_tratativa_user_id uuid REFERENCES public.profiles(id),
  data_prevista               date,
  reuniao_futura_necessaria   boolean NOT NULL DEFAULT false,
  observacoes                 text,
  criado_por                  uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  CHECK (tratativa <> 'estacionar' OR (responsavel_tratativa_user_id IS NOT NULL AND data_prevista IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_reuniao_assunto_fora_pauta_reuniao ON public.reuniao_assunto_fora_pauta(reuniao_id);

ALTER TABLE public.reuniao_assunto_fora_pauta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reuniao_assunto_fora_pauta_select ON public.reuniao_assunto_fora_pauta;
CREATE POLICY reuniao_assunto_fora_pauta_select ON public.reuniao_assunto_fora_pauta
  FOR SELECT TO authenticated
  USING (public.tem_acesso_menu('central_servicos_reunioes') AND public.tem_interacao_reuniao(reuniao_id));

DROP POLICY IF EXISTS reuniao_assunto_fora_pauta_insert ON public.reuniao_assunto_fora_pauta;
CREATE POLICY reuniao_assunto_fora_pauta_insert ON public.reuniao_assunto_fora_pauta
  FOR INSERT TO authenticated
  WITH CHECK (public.tem_acesso_menu('central_servicos_reunioes') AND public.tem_interacao_reuniao(reuniao_id));

DROP POLICY IF EXISTS reuniao_assunto_fora_pauta_delete ON public.reuniao_assunto_fora_pauta;
CREATE POLICY reuniao_assunto_fora_pauta_delete ON public.reuniao_assunto_fora_pauta
  FOR DELETE TO authenticated
  USING (public.tem_acesso_menu('central_servicos_reunioes') AND public.tem_interacao_reuniao(reuniao_id));
