-- FASE 1 (redesenho de acessos) — Schema de Perfis de Acesso
--
-- 3 tabelas novas. Não altera nenhuma RLS de tabela de negócio, não altera
-- as funções de gate ainda (isso é a próxima migration) — puramente
-- aditivo e reversível (basta dropar as 3 tabelas pra reverter).
--
-- perfil_acesso.concede_tudo: um perfil marcado assim libera QUALQUER menu/
-- ação pra quem o tiver atribuído, sem precisar de uma linha por menu em
-- perfil_acesso_permissao. É o substituto do antigo "has_role(admin)"
-- hardcoded nas funções de gate — a diferença é que agora é uma atribuição
-- revogável/editável pelo próprio painel (não uma regra fixa no código), e
-- continua se sincronizando sozinho quando menus novos são criados (o
-- antigo bypass também tinha essa propriedade; um perfil comum, com linhas
-- estáticas por menu, não teria — por isso o "Administrador Geral" usa
-- concede_tudo em vez de uma linha por menu).

CREATE TABLE public.perfil_acesso (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         text NOT NULL,
  descricao    text,
  concede_tudo boolean NOT NULL DEFAULT false,
  ativo        boolean NOT NULL DEFAULT true,
  created_by   uuid REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nome)
);

CREATE TABLE public.perfil_acesso_permissao (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id   uuid NOT NULL REFERENCES public.perfil_acesso(id) ON DELETE CASCADE,
  menu_codigo text NOT NULL,
  acao        public.app_acao NOT NULL,
  allow       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, menu_codigo, acao)
);
CREATE INDEX idx_perfil_acesso_permissao_perfil ON public.perfil_acesso_permissao(perfil_id);
CREATE INDEX idx_perfil_acesso_permissao_menu   ON public.perfil_acesso_permissao(menu_codigo);

CREATE TABLE public.usuario_perfil_acesso (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  perfil_id  uuid NOT NULL REFERENCES public.perfil_acesso(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, perfil_id)
);
CREATE INDEX idx_usuario_perfil_acesso_user   ON public.usuario_perfil_acesso(user_id);
CREATE INDEX idx_usuario_perfil_acesso_perfil ON public.usuario_perfil_acesso(perfil_id);

CREATE TRIGGER trg_perfil_acesso_updated BEFORE UPDATE ON public.perfil_acesso
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_perfil_acesso_permissao_updated BEFORE UPDATE ON public.perfil_acesso_permissao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.perfil_acesso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfil_acesso_permissao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_perfil_acesso ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de app_modulo/app_menu/screen_permission_user: leitura livre
-- (é metadado de configuração, não dado de negócio), escrita só quem já
-- administra o próprio sistema de permissões (admin/diretor_adm — mesma
-- exceção "bootstrapping" que já existe hoje pra essas 3 tabelas; sem ela
-- ninguém consegue configurar o mecanismo de acesso em si).
CREATE POLICY perfil_acesso_select ON public.perfil_acesso FOR SELECT TO authenticated USING (true);
CREATE POLICY perfil_acesso_write ON public.perfil_acesso FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor_adm'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor_adm'));

CREATE POLICY pap_select ON public.perfil_acesso_permissao FOR SELECT TO authenticated USING (true);
CREATE POLICY pap_write ON public.perfil_acesso_permissao FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor_adm'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor_adm'));

CREATE POLICY upa_select ON public.usuario_perfil_acesso FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor_adm'));
CREATE POLICY upa_write ON public.usuario_perfil_acesso FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor_adm'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor_adm'));

NOTIFY pgrst, 'reload schema';
