-- Cadastro de usuário: campo de telefone (WhatsApp), usado pro cadastro
-- manual de novos usuários e futuramente pra automação de lembretes.
-- Formato: dígitos puros, DDI+DDD+número, sem símbolos (ex: 5551996594681)
-- — mais fácil de converter pro formato exigido por APIs de WhatsApp depois.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telefone text;
