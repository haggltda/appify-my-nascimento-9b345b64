ALTER TYPE public.integ_batch_status ADD VALUE IF NOT EXISTS 'processando';
ALTER TYPE public.integ_batch_status ADD VALUE IF NOT EXISTS 'validado_ok';
ALTER TYPE public.integ_batch_status ADD VALUE IF NOT EXISTS 'validado_com_erros';