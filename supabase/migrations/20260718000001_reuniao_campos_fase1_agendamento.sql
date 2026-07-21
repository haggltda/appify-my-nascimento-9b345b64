-- Agenda de Reunião — Fase 1 da reformulação pedida pelo CEO: campos novos
-- no formulário de agendamento (Tipo de reunião com duração padrão,
-- Finalidade, Resultado esperado, Organizador, Observadores, Notificar
-- por, modalidade Híbrido, Setor responsável automático).

-- 1) Colunas novas em reuniao ---------------------------------------------
ALTER TABLE public.reuniao
  ADD COLUMN IF NOT EXISTS tipo_reuniao text
    CHECK (tipo_reuniao IN ('comunicacao','alinhamento','operacional','comite','gerencial','diretoria','equipe','acompanhamento','outro')),
  ADD COLUMN IF NOT EXISTS finalidade text[] NOT NULL DEFAULT '{}'
    CHECK (finalidade <@ ARRAY['comunicacao','alinhamento','decisao','acompanhamento_indicadores','resolver_problema','plano_acao']::text[]),
  ADD COLUMN IF NOT EXISTS resultado_esperado text[] NOT NULL DEFAULT '{}'
    CHECK (resultado_esperado <@ ARRAY['compreensao','decisao','acao_definida','responsaveis_definidos','prazos_definidos','outro']::text[]),
  ADD COLUMN IF NOT EXISTS notificar_por text[] NOT NULL DEFAULT '{erp}'
    CHECK (notificar_por <@ ARRAY['erp','email','whatsapp']::text[]),
  ADD COLUMN IF NOT EXISTS organizador_user_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS setor_responsavel text,
  ADD COLUMN IF NOT EXISTS link_online text;

-- link_online: só usado quando tipo_local = 'hibrido' (sala + link ao mesmo
-- tempo). Pra 'online' pura, o link continua em local_ou_link como já era —
-- não mexe no caminho existente pra não quebrar reuniões já criadas.

-- Backfill: reuniões existentes não tinham organizador — usa o responsável
-- pela ata como organizador padrão (era o papel mais próximo antes desta
-- fase), depois trava NOT NULL pra daqui em diante.
UPDATE public.reuniao SET organizador_user_id = responsavel_preenchimento_user_id WHERE organizador_user_id IS NULL;
ALTER TABLE public.reuniao ALTER COLUMN organizador_user_id SET NOT NULL;

-- 2) tipo_local ganha "hibrido" --------------------------------------------
ALTER TABLE public.reuniao DROP CONSTRAINT IF EXISTS reuniao_tipo_local_check;
ALTER TABLE public.reuniao ADD CONSTRAINT reuniao_tipo_local_check CHECK (tipo_local IN ('presencial', 'online', 'hibrido'));

-- Híbrido também ocupa sala física, então entra na trava de conflito de sala.
ALTER TABLE public.reuniao DROP CONSTRAINT IF EXISTS reuniao_local_sem_sobreposicao;
ALTER TABLE public.reuniao
  ADD CONSTRAINT reuniao_local_sem_sobreposicao
  EXCLUDE USING gist (
    local_ou_link WITH =,
    public.reuniao_faixa_horario(data_hora, duracao_minutos) WITH &&
  )
  WHERE (etapa <> 'cancelada' AND tipo_local IN ('presencial', 'hibrido'));

-- 3) reuniao_convidado ganha papel (convidado/observador) -----------------
-- Observador reaproveita a mesma tabela: tem_interacao_reuniao e
-- pessoa_tem_conflito_horario já checam só "existe linha pra esse
-- usuário", sem olhar o papel — então observador já sai coberto por
-- visibilidade e por conflito de horário automaticamente, sem precisar
-- tocar nessas duas funções.
ALTER TABLE public.reuniao_convidado
  ADD COLUMN IF NOT EXISTS papel text NOT NULL DEFAULT 'convidado' CHECK (papel IN ('convidado', 'observador'));

-- 4) Organizador entra em todas as checagens de "quem gerencia" -----------

DROP POLICY IF EXISTS reuniao_update ON public.reuniao;
CREATE POLICY reuniao_update ON public.reuniao
  FOR UPDATE TO authenticated
  USING (public.tem_acesso_menu('central_servicos_reunioes') AND auth.uid() IN (criado_por, responsavel_preenchimento_user_id, organizador_user_id))
  WITH CHECK (public.tem_acesso_menu('central_servicos_reunioes') AND auth.uid() IN (criado_por, responsavel_preenchimento_user_id, organizador_user_id));

DROP POLICY IF EXISTS reuniao_pauta_insert ON public.reuniao_pauta;
CREATE POLICY reuniao_pauta_insert ON public.reuniao_pauta
  FOR INSERT TO authenticated
  WITH CHECK (
    public.tem_acesso_menu('central_servicos_reunioes')
    AND EXISTS (
      SELECT 1 FROM public.reuniao r
       WHERE r.id = reuniao_id AND r.etapa IN ('agendada', 'em_andamento')
         AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id, r.organizador_user_id)
    )
  );

DROP POLICY IF EXISTS reuniao_pauta_update ON public.reuniao_pauta;
CREATE POLICY reuniao_pauta_update ON public.reuniao_pauta
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reuniao r
       WHERE r.id = reuniao_id AND r.etapa IN ('agendada', 'em_andamento')
         AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id, r.organizador_user_id, reuniao_pauta.responsavel_user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reuniao r
       WHERE r.id = reuniao_id AND r.etapa IN ('agendada', 'em_andamento')
         AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id, r.organizador_user_id, reuniao_pauta.responsavel_user_id)
    )
  );

DROP POLICY IF EXISTS reuniao_pauta_delete ON public.reuniao_pauta;
CREATE POLICY reuniao_pauta_delete ON public.reuniao_pauta
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reuniao r
       WHERE r.id = reuniao_id AND r.etapa IN ('agendada', 'em_andamento')
         AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id, r.organizador_user_id)
    )
  );

DROP POLICY IF EXISTS reuniao_resposta_insert ON public.reuniao_resposta;
CREATE POLICY reuniao_resposta_insert ON public.reuniao_resposta
  FOR INSERT TO authenticated
  WITH CHECK (
    public.tem_acesso_menu('central_servicos_reunioes')
    AND EXISTS (
      SELECT 1 FROM public.reuniao_pauta p JOIN public.reuniao r ON r.id = p.reuniao_id
       WHERE p.id = pauta_id AND r.etapa = 'em_andamento'
         AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id, r.organizador_user_id, p.responsavel_user_id)
    )
  );

DROP POLICY IF EXISTS reuniao_resposta_update ON public.reuniao_resposta;
CREATE POLICY reuniao_resposta_update ON public.reuniao_resposta
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reuniao_pauta p JOIN public.reuniao r ON r.id = p.reuniao_id
       WHERE p.id = pauta_id AND r.etapa = 'em_andamento'
         AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id, r.organizador_user_id, p.responsavel_user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reuniao_pauta p JOIN public.reuniao r ON r.id = p.reuniao_id
       WHERE p.id = pauta_id AND r.etapa = 'em_andamento'
         AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id, r.organizador_user_id, p.responsavel_user_id)
    )
  );

DROP POLICY IF EXISTS reuniao_convidado_insert ON public.reuniao_convidado;
CREATE POLICY reuniao_convidado_insert ON public.reuniao_convidado
  FOR INSERT TO authenticated
  WITH CHECK (
    public.tem_acesso_menu('central_servicos_reunioes')
    AND EXISTS (
      SELECT 1 FROM public.reuniao r
       WHERE r.id = reuniao_id AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id, r.organizador_user_id)
    )
  );

DROP POLICY IF EXISTS reuniao_convidado_delete ON public.reuniao_convidado;
CREATE POLICY reuniao_convidado_delete ON public.reuniao_convidado
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reuniao r
       WHERE r.id = reuniao_id AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id, r.organizador_user_id)
    )
  );

CREATE OR REPLACE FUNCTION public.checar_transicao_reuniao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.etapa = OLD.etapa THEN
    RETURN NEW;
  END IF;

  IF auth.uid() NOT IN (OLD.criado_por, OLD.responsavel_preenchimento_user_id, OLD.organizador_user_id) THEN
    RAISE EXCEPTION 'Só o criador, o organizador ou o responsável pelo preenchimento podem mudar a etapa da reunião.';
  END IF;

  IF NEW.etapa = 'cancelada' THEN
    IF OLD.etapa IN ('concluida', 'cancelada') THEN
      RAISE EXCEPTION 'Não é possível cancelar uma reunião %.', OLD.etapa;
    END IF;
    IF NEW.motivo_cancelamento IS NULL OR btrim(NEW.motivo_cancelamento) = '' THEN
      RAISE EXCEPTION 'Motivo do cancelamento é obrigatório.';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.etapa = 'agendada' AND NEW.etapa = 'em_andamento')
    OR (OLD.etapa = 'em_andamento' AND NEW.etapa = 'concluida')
  ) THEN
    RAISE EXCEPTION 'Transição de etapa não permitida: % → %', OLD.etapa, NEW.etapa;
  END IF;

  RETURN NEW;
END;
$$;

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
         OR auth.uid() = r.organizador_user_id
         OR EXISTS (SELECT 1 FROM public.reuniao_convidado c WHERE c.reuniao_id = r.id AND c.user_id = auth.uid())
       )
  );
$$;

CREATE OR REPLACE FUNCTION public.checar_conflito_horario_reuniao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_convidado_em_conflito uuid;
BEGIN
  IF NEW.etapa = 'cancelada' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.data_hora = OLD.data_hora
     AND NEW.duracao_minutos = OLD.duracao_minutos
     AND NEW.responsavel_preenchimento_user_id = OLD.responsavel_preenchimento_user_id
     AND NEW.organizador_user_id = OLD.organizador_user_id THEN
    RETURN NEW;
  END IF;

  IF public.pessoa_tem_conflito_horario(NEW.criado_por, NEW.data_hora, NEW.duracao_minutos, NEW.id) THEN
    RAISE EXCEPTION 'O criador desta reunião já está em outra reunião no mesmo horário.';
  END IF;

  IF public.pessoa_tem_conflito_horario(NEW.organizador_user_id, NEW.data_hora, NEW.duracao_minutos, NEW.id) THEN
    RAISE EXCEPTION 'O organizador já está em outra reunião no mesmo horário.';
  END IF;

  IF public.pessoa_tem_conflito_horario(NEW.responsavel_preenchimento_user_id, NEW.data_hora, NEW.duracao_minutos, NEW.id) THEN
    RAISE EXCEPTION 'O responsável pelo preenchimento já está em outra reunião no mesmo horário.';
  END IF;

  IF TG_OP = 'UPDATE' AND (NEW.data_hora <> OLD.data_hora OR NEW.duracao_minutos <> OLD.duracao_minutos) THEN
    SELECT c.user_id INTO v_convidado_em_conflito
      FROM public.reuniao_convidado c
     WHERE c.reuniao_id = NEW.id
       AND public.pessoa_tem_conflito_horario(c.user_id, NEW.data_hora, NEW.duracao_minutos, NEW.id)
     LIMIT 1;
    IF v_convidado_em_conflito IS NOT NULL THEN
      RAISE EXCEPTION 'Um dos convidados ou observadores já está em outra reunião no novo horário.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 5) listar_reunioes_calendario() passa a devolver organizador_user_id também
-- (CREATE OR REPLACE não deixa mudar a lista de colunas do retorno — precisa
-- dropar antes de recriar).
DROP FUNCTION IF EXISTS public.listar_reunioes_calendario();
CREATE OR REPLACE FUNCTION public.listar_reunioes_calendario()
RETURNS TABLE (
  id                                 uuid,
  titulo                             text,
  data_hora                          timestamptz,
  duracao_minutos                    int,
  tipo_local                         text,
  local_ou_link                      text,
  etapa                              text,
  criado_por                         uuid,
  organizador_user_id                uuid,
  responsavel_preenchimento_user_id  uuid,
  convidados                         uuid[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT r.id, r.titulo, r.data_hora, r.duracao_minutos, r.tipo_local, r.local_ou_link, r.etapa,
         r.criado_por, r.organizador_user_id, r.responsavel_preenchimento_user_id,
         COALESCE(array_agg(c.user_id) FILTER (WHERE c.user_id IS NOT NULL), '{}')
    FROM public.reuniao r
    LEFT JOIN public.reuniao_convidado c ON c.reuniao_id = r.id
   WHERE public.tem_acesso_menu('central_servicos_reunioes')
   GROUP BY r.id
   ORDER BY r.data_hora;
$$;

REVOKE ALL ON FUNCTION public.listar_reunioes_calendario() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_reunioes_calendario() TO authenticated;

NOTIFY pgrst, 'reload schema';
