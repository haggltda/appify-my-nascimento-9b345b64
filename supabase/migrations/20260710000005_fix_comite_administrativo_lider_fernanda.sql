-- Corrige o líder do comitê "Administrativo": a migration 20260514212623
-- tinha deixado só o texto livre (descricao = 'Líder: Fernanda'), sem
-- vincular a um profile real — funcionava com o campo antigo (input de
-- texto), mas o novo dropdown de "Líder do Comitê" (ligado a profiles)
-- não consegue pré-selecionar ninguém sem um gestor_profile_id de verdade.
--
-- Resolve o profile por nome e falha (RAISE EXCEPTION) se não achar
-- exatamente 1 resultado — evita vincular a pessoa errada por nome
-- ambíguo ou ausente. Se falhar, ajuste o ILIKE pro nome exato cadastrado
-- e rode a migration de novo.

DO $$
DECLARE v_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_ids FROM public.profiles
   WHERE display_name ILIKE '%Fernanda Maldaner%' AND display_name NOT ILIKE '%teste%';
  IF v_ids IS NULL OR array_length(v_ids, 1) <> 1 THEN
    RAISE EXCEPTION 'Esperava 1 profile para "Fernanda Maldaner", encontrou %.', COALESCE(array_length(v_ids, 1), 0);
  END IF;

  UPDATE public.comite
     SET gestor_profile_id = v_ids[1],
         descricao = NULL
   WHERE empresa_id = '5a61c769-21d8-4e61-b9bb-506b8db0bce8'
     AND nome = 'Administrativo';
END $$;
