-- =========================================================================
-- PASS_MODO_LOGIN — senhas dos modos de criação de acesso
--
-- Gate do "Criar Acesso": ao escolher Encarregado ou Administrativo, o usuário
-- precisa informar a senha do modo. Validação é feita server-side (Edge Function
-- auth-criar-acesso, service role). Hash SHA-256, igual ao app legado.
--
-- RLS habilitado SEM policy e SEM grant → só o service_role lê (nunca o client).
-- =========================================================================

CREATE TABLE IF NOT EXISTS public."PASS_MODO_LOGIN" (
  modo          text PRIMARY KEY,           -- 'ENCARREGADO' | 'ADMINISTRATIVO'
  senha_hash    text NOT NULL,              -- SHA-256 hex
  atualizado_em timestamptz DEFAULT now()
);

ALTER TABLE public."PASS_MODO_LOGIN" ENABLE ROW LEVEL SECURITY;
-- (sem policy / sem grant: apenas service_role acessa)

INSERT INTO public."PASS_MODO_LOGIN" (modo, senha_hash) VALUES
  ('ENCARREGADO',    'a3a2c4daa88dd0f23a7f5ea92287cc391e6411a324d7ac9dc515ba0a300eee4c'),  -- Hagg1234*
  ('ADMINISTRATIVO', '9809353be88f25bf63eedf4ff0c4e5665e822803b81d059dae5155c95098aece')   -- Adm1771*
ON CONFLICT (modo) DO UPDATE SET senha_hash = EXCLUDED.senha_hash, atualizado_em = now();
