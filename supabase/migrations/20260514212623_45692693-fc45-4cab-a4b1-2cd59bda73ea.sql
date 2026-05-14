
ALTER TABLE public.plano_acao ADD COLUMN IF NOT EXISTS setor text;

-- Corrigir líderes dos comitês HAGG
UPDATE public.comite
  SET gestor_profile_id = NULL,
      descricao = 'Líder: Fernanda'
  WHERE empresa_id = '5a61c769-21d8-4e61-b9bb-506b8db0bce8'
    AND nome = 'Administrativo';

UPDATE public.comite
  SET gestor_profile_id = 'ab761a12-197b-403b-809f-0f53a36a16e2'
  WHERE empresa_id = '5a61c769-21d8-4e61-b9bb-506b8db0bce8'
    AND nome = 'Reunião Extraordinária';
