
-- 1) Garantir Messias como admin sem vínculo de empresa
UPDATE public.profiles
   SET empresa_id = NULL,
       display_name = 'Messias Pereira de Souza'
 WHERE lower(email) = 'messias.souza@cheetahconsultores.com';

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM public.profiles
 WHERE lower(email) = 'messias.souza@cheetahconsultores.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) Remover quaisquer outras roles do Messias para deixar só admin
DELETE FROM public.user_roles
 WHERE user_id = (SELECT id FROM public.profiles WHERE lower(email) = 'messias.souza@cheetahconsultores.com')
   AND role <> 'admin'::app_role;

-- 3) Tabela de notificações por usuário
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid,
  titulo text NOT NULL,
  mensagem text,
  tipo text NOT NULL DEFAULT 'info',
  link text,
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ver minhas notificacoes" ON public.notificacoes;
CREATE POLICY "ver minhas notificacoes" ON public.notificacoes
  FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "marcar minhas notificacoes" ON public.notificacoes;
CREATE POLICY "marcar minhas notificacoes" ON public.notificacoes
  FOR UPDATE USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "criar notificacoes admin" ON public.notificacoes;
CREATE POLICY "criar notificacoes admin" ON public.notificacoes
  FOR INSERT WITH CHECK (public.has_role(auth.uid(),'admin') OR user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_notif_user_lida ON public.notificacoes(user_id, lida, created_at DESC);

-- 4) Tabela de sessões ativas (registro simples baseado em login)
CREATE TABLE IF NOT EXISTS public.sessoes_ativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_agent text,
  ip text,
  iniciada_em timestamptz NOT NULL DEFAULT now(),
  ultima_atividade timestamptz NOT NULL DEFAULT now(),
  ativa boolean NOT NULL DEFAULT true
);
ALTER TABLE public.sessoes_ativas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ver minhas sessoes" ON public.sessoes_ativas;
CREATE POLICY "ver minhas sessoes" ON public.sessoes_ativas
  FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "criar minhas sessoes" ON public.sessoes_ativas;
CREATE POLICY "criar minhas sessoes" ON public.sessoes_ativas
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "atualizar minhas sessoes" ON public.sessoes_ativas;
CREATE POLICY "atualizar minhas sessoes" ON public.sessoes_ativas
  FOR UPDATE USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- 5) Notificação de boas-vindas para o admin Messias
INSERT INTO public.notificacoes (user_id, titulo, mensagem, tipo)
SELECT p.id, 'Bem-vindo, Administrador',
       'Seu perfil foi promovido a Administrador Master, sem vínculo obrigatório a empresa.',
       'success'
  FROM public.profiles p
 WHERE lower(p.email) = 'messias.souza@cheetahconsultores.com'
   AND NOT EXISTS (
     SELECT 1 FROM public.notificacoes n
      WHERE n.user_id = p.id AND n.titulo = 'Bem-vindo, Administrador'
   );
