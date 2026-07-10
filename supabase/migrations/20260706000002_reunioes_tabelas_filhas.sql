-- Atas de Reunião: tabelas filhas — pauta (tópicos definidos ao agendar),
-- resposta (preenchida pelo responsável depois da reunião), convidados,
-- anexos, comentários (nunca entram no PDF, só visual lateral) e
-- assinaturas (livres/opcionais, não bloqueiam a conclusão da ata).

-- 1) Pauta -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reuniao_pauta (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id   uuid NOT NULL REFERENCES public.reuniao(id) ON DELETE CASCADE,
  ordem        int NOT NULL DEFAULT 0,
  titulo_topico text NOT NULL,
  descricao    text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reuniao_pauta_reuniao ON public.reuniao_pauta(reuniao_id);

ALTER TABLE public.reuniao_pauta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reuniao_pauta_select ON public.reuniao_pauta;
CREATE POLICY reuniao_pauta_select ON public.reuniao_pauta
  FOR SELECT TO authenticated
  USING (public.tem_acesso_menu('central_servicos_reunioes'));

-- Pauta só é editável enquanto a reunião está "agendada", e só por quem
-- criou ou é o responsável pelo preenchimento — depois que a reunião
-- acontece, a pauta fica travada (só as respostas mudam).
DROP POLICY IF EXISTS reuniao_pauta_insert ON public.reuniao_pauta;
CREATE POLICY reuniao_pauta_insert ON public.reuniao_pauta
  FOR INSERT TO authenticated
  WITH CHECK (
    public.tem_acesso_menu('central_servicos_reunioes')
    AND EXISTS (
      SELECT 1 FROM public.reuniao r
       WHERE r.id = reuniao_id AND r.etapa = 'agendada'
         AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id)
    )
  );

DROP POLICY IF EXISTS reuniao_pauta_update ON public.reuniao_pauta;
CREATE POLICY reuniao_pauta_update ON public.reuniao_pauta
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reuniao r
       WHERE r.id = reuniao_id AND r.etapa = 'agendada'
         AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reuniao r
       WHERE r.id = reuniao_id AND r.etapa = 'agendada'
         AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id)
    )
  );

DROP POLICY IF EXISTS reuniao_pauta_delete ON public.reuniao_pauta;
CREATE POLICY reuniao_pauta_delete ON public.reuniao_pauta
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reuniao r
       WHERE r.id = reuniao_id AND r.etapa = 'agendada'
         AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id)
    )
  );

-- 2) Respostas -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reuniao_resposta (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pauta_id       uuid NOT NULL UNIQUE REFERENCES public.reuniao_pauta(id) ON DELETE CASCADE,
  texto_resposta text,
  encaminhamento text,
  respondido_por uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_reuniao_resposta_updated ON public.reuniao_resposta;
CREATE TRIGGER trg_reuniao_resposta_updated
  BEFORE UPDATE ON public.reuniao_resposta
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.reuniao_resposta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reuniao_resposta_select ON public.reuniao_resposta;
CREATE POLICY reuniao_resposta_select ON public.reuniao_resposta
  FOR SELECT TO authenticated
  USING (public.tem_acesso_menu('central_servicos_reunioes'));

-- Resposta só pode ser criada/editada enquanto a reunião está
-- "aguardando_ata", e só pelo criador ou responsável pelo preenchimento.
DROP POLICY IF EXISTS reuniao_resposta_insert ON public.reuniao_resposta;
CREATE POLICY reuniao_resposta_insert ON public.reuniao_resposta
  FOR INSERT TO authenticated
  WITH CHECK (
    public.tem_acesso_menu('central_servicos_reunioes')
    AND EXISTS (
      SELECT 1 FROM public.reuniao_pauta p JOIN public.reuniao r ON r.id = p.reuniao_id
       WHERE p.id = pauta_id AND r.etapa = 'aguardando_ata'
         AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id)
    )
  );

DROP POLICY IF EXISTS reuniao_resposta_update ON public.reuniao_resposta;
CREATE POLICY reuniao_resposta_update ON public.reuniao_resposta
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reuniao_pauta p JOIN public.reuniao r ON r.id = p.reuniao_id
       WHERE p.id = pauta_id AND r.etapa = 'aguardando_ata'
         AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reuniao_pauta p JOIN public.reuniao r ON r.id = p.reuniao_id
       WHERE p.id = pauta_id AND r.etapa = 'aguardando_ata'
         AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id)
    )
  );

-- 3) Convidados ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reuniao_convidado (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id uuid NOT NULL REFERENCES public.reuniao(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reuniao_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reuniao_convidado_reuniao ON public.reuniao_convidado(reuniao_id);

ALTER TABLE public.reuniao_convidado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reuniao_convidado_select ON public.reuniao_convidado;
CREATE POLICY reuniao_convidado_select ON public.reuniao_convidado
  FOR SELECT TO authenticated
  USING (public.tem_acesso_menu('central_servicos_reunioes'));

DROP POLICY IF EXISTS reuniao_convidado_insert ON public.reuniao_convidado;
CREATE POLICY reuniao_convidado_insert ON public.reuniao_convidado
  FOR INSERT TO authenticated
  WITH CHECK (public.tem_acesso_menu('central_servicos_reunioes'));

DROP POLICY IF EXISTS reuniao_convidado_delete ON public.reuniao_convidado;
CREATE POLICY reuniao_convidado_delete ON public.reuniao_convidado
  FOR DELETE TO authenticated
  USING (public.tem_acesso_menu('central_servicos_reunioes'));

-- 4) Anexos ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reuniao_anexo (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id    uuid NOT NULL REFERENCES public.reuniao(id) ON DELETE CASCADE,
  storage_path  text NOT NULL,
  nome_arquivo  text NOT NULL,
  mime_type     text,
  tamanho_bytes bigint,
  enviado_por   uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reuniao_anexo_reuniao ON public.reuniao_anexo(reuniao_id);

ALTER TABLE public.reuniao_anexo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reuniao_anexo_select ON public.reuniao_anexo;
CREATE POLICY reuniao_anexo_select ON public.reuniao_anexo
  FOR SELECT TO authenticated
  USING (public.tem_acesso_menu('central_servicos_reunioes'));

DROP POLICY IF EXISTS reuniao_anexo_insert ON public.reuniao_anexo;
CREATE POLICY reuniao_anexo_insert ON public.reuniao_anexo
  FOR INSERT TO authenticated
  WITH CHECK (public.tem_acesso_menu('central_servicos_reunioes'));

-- 5) Comentários (nunca entram no PDF, só visual lateral na solicitação) -----
CREATE TABLE IF NOT EXISTS public.reuniao_comentario (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id uuid NOT NULL REFERENCES public.reuniao(id) ON DELETE CASCADE,
  autor_id   uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  texto      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reuniao_comentario_reuniao ON public.reuniao_comentario(reuniao_id);

ALTER TABLE public.reuniao_comentario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reuniao_comentario_select ON public.reuniao_comentario;
CREATE POLICY reuniao_comentario_select ON public.reuniao_comentario
  FOR SELECT TO authenticated
  USING (public.tem_acesso_menu('central_servicos_reunioes'));

DROP POLICY IF EXISTS reuniao_comentario_insert ON public.reuniao_comentario;
CREATE POLICY reuniao_comentario_insert ON public.reuniao_comentario
  FOR INSERT TO authenticated
  WITH CHECK (public.tem_acesso_menu('central_servicos_reunioes'));

-- 6) Assinaturas — livres/opcionais, uma por pessoa por reunião (sem coluna
--    de etapa: aqui não bloqueia a conclusão, então não precisa amarrar a
--    assinatura numa etapa específica como em sistema_solicitacao_assinatura) -
CREATE TABLE IF NOT EXISTS public.reuniao_assinatura (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id     uuid NOT NULL REFERENCES public.reuniao(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  assinatura_png text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reuniao_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reuniao_assinatura_reuniao ON public.reuniao_assinatura(reuniao_id);

ALTER TABLE public.reuniao_assinatura ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reuniao_assinatura_select ON public.reuniao_assinatura;
CREATE POLICY reuniao_assinatura_select ON public.reuniao_assinatura
  FOR SELECT TO authenticated
  USING (public.tem_acesso_menu('central_servicos_reunioes'));

DROP POLICY IF EXISTS reuniao_assinatura_insert ON public.reuniao_assinatura;
CREATE POLICY reuniao_assinatura_insert ON public.reuniao_assinatura
  FOR INSERT TO authenticated
  WITH CHECK (public.tem_acesso_menu('central_servicos_reunioes') AND user_id = auth.uid());
