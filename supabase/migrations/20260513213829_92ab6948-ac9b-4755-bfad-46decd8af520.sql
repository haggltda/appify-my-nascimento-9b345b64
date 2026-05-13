
CREATE TABLE public.copiloto_conversa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  user_id UUID NOT NULL,
  titulo TEXT NOT NULL DEFAULT 'Nova conversa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_copiloto_conversa_user ON public.copiloto_conversa(user_id, created_at DESC);

CREATE TABLE public.copiloto_mensagem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES public.copiloto_conversa(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','tool','system')),
  content TEXT NOT NULL DEFAULT '',
  audio_path TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_copiloto_mensagem_conversa ON public.copiloto_mensagem(conversa_id, created_at);

ALTER TABLE public.copiloto_conversa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copiloto_mensagem ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.pode_usar_copiloto(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid, 'admin'::app_role) OR public.has_role(_uid, 'presidencia'::app_role)
$$;

CREATE POLICY "copiloto_conversa_select_owner" ON public.copiloto_conversa FOR SELECT TO authenticated USING (user_id = auth.uid() AND public.pode_usar_copiloto(auth.uid()));
CREATE POLICY "copiloto_conversa_insert_owner" ON public.copiloto_conversa FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.pode_usar_copiloto(auth.uid()));
CREATE POLICY "copiloto_conversa_update_owner" ON public.copiloto_conversa FOR UPDATE TO authenticated USING (user_id = auth.uid() AND public.pode_usar_copiloto(auth.uid()));
CREATE POLICY "copiloto_conversa_delete_owner" ON public.copiloto_conversa FOR DELETE TO authenticated USING (user_id = auth.uid() AND public.pode_usar_copiloto(auth.uid()));

CREATE POLICY "copiloto_mensagem_select_owner" ON public.copiloto_mensagem FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.copiloto_conversa c WHERE c.id = conversa_id AND c.user_id = auth.uid()) AND public.pode_usar_copiloto(auth.uid()));
CREATE POLICY "copiloto_mensagem_insert_owner" ON public.copiloto_mensagem FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.copiloto_conversa c WHERE c.id = conversa_id AND c.user_id = auth.uid()) AND public.pode_usar_copiloto(auth.uid()));
CREATE POLICY "copiloto_mensagem_update_owner" ON public.copiloto_mensagem FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.copiloto_conversa c WHERE c.id = conversa_id AND c.user_id = auth.uid()) AND public.pode_usar_copiloto(auth.uid()));
CREATE POLICY "copiloto_mensagem_delete_owner" ON public.copiloto_mensagem FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.copiloto_conversa c WHERE c.id = conversa_id AND c.user_id = auth.uid()) AND public.pode_usar_copiloto(auth.uid()));

CREATE TRIGGER trg_copiloto_conversa_updated
BEFORE UPDATE ON public.copiloto_conversa
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO storage.buckets (id, name, public) VALUES ('copiloto-audios', 'copiloto-audios', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "copiloto_audios_select_own" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'copiloto-audios' AND auth.uid()::text = (storage.foldername(name))[1] AND public.pode_usar_copiloto(auth.uid()));
CREATE POLICY "copiloto_audios_insert_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'copiloto-audios' AND auth.uid()::text = (storage.foldername(name))[1] AND public.pode_usar_copiloto(auth.uid()));
CREATE POLICY "copiloto_audios_delete_own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'copiloto-audios' AND auth.uid()::text = (storage.foldername(name))[1] AND public.pode_usar_copiloto(auth.uid()));

INSERT INTO public.app_menu (modulo_id, codigo, nome, rota, ordem, ativo)
SELECT m.id, 'copiloto_ia', 'Copiloto IA', '/app/plano-acoes/copiloto', 15, true
FROM public.app_modulo m WHERE m.codigo = 'plano_acoes'
ON CONFLICT DO NOTHING;
