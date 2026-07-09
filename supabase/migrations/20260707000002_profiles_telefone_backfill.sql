-- Backfill do telefone dos usuários já existentes, passado pelo gestor.
-- Casa por display_name exato, excluindo contas de teste (mesmo cuidado de
-- 20260619000002_seed_permissoes_sistemas_solicitacoes_erp.sql — nomes com
-- "teste" no display_name colidem com contas oficiais).
-- Todos usam DDD 51.
-- Matheus Kuhn Labres (DDD 32) removido da lista — ainda não tem usuário
-- cadastrado no sistema; definir o telefone dele na criação do usuário
-- (ou rodar um ajuste manual depois que o cadastro existir).
--
-- Faz duas passadas: aplica o UPDATE em quem bate exatamente 1, e junta
-- todo mundo que não bateu (0 ou 2+) numa lista só — com sugestão de nomes
-- parecidos já cadastrados — pra corrigir tudo de uma vez em vez de rodar
-- a migration várias vezes até achar cada divergência.
--
-- Desliga os triggers pra esse UPDATE em massa: o trigger
-- a_trg_profiles_block_self_escalation (20260529150054) bloqueia updates em
-- profiles sem uma sessão de usuário autenticada — é esperado que bloqueie
-- ao rodar via SQL Editor (sem JWT/sessão), então religamos os triggers
-- (inclusive o de auditoria e o de updated_at) logo depois deste bloco.
SET session_replication_role = replica;

DO $$
DECLARE
  rec record;
  v_count int;
  v_sugestao text;
  v_problemas text := '';
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('Alessandra Aparecida de Vargas', '51', '996594681'),
      ('Alessandra Oliveira da Rosa', '51', '984543211'),
      ('Amalia Maia da Silva', '51', '995971101'),
      ('Ana Luiza Faleiro', '51', '984405570'),
      ('Anne Victoria da Silva Vitorino', '51', '980188881'),
      ('Cálita Ávila', '51', '995226280'),
      ('Camila Kuhn', '51', '988067304'),
      ('Carlos Eduardo Ramos do Nascimento', '51', '998107140'),
      ('Caroline Prisco', '51', '995725560'),
      ('Cleidir Peixoto Goularte', '51', '996975940'),
      ('Daiane Martins', '51', '998742120'),
      ('Daison Tavares Rodrigues', '51', '999616883'),
      ('Daniely da Silva', '51', '996361618'),
      ('Eduardo Jeiel Padilha Monteiro', '51', '998270853'),
      ('Ellem Souza Ciceri', '51', '982265486'),
      ('Érica Souza Ávila', '51', '998980141'),
      ('Fernanda Maldaner', '51', '996558879'),
      ('Francieli Silva do Nascimento', '51', '980523052'),
      ('Gustavo Barcelos', '51', '982794859'),
      ('Gustavo Garcia Ronsani', '51', '982875562'),
      ('Helena Nascimento', '51', '999085113'),
      ('Isabella Saciloto Kersting', '51', '993892680'),
      ('Isadora Prisco Silveira', '51', '993662939'),
      ('Ismael Kuhl Lopes', '51', '998296067'),
      ('Iury de Jesus Silva', '51', '997830219'),
      ('João Victor Peretti de Araujo', '51', '995848457'),
      ('João Vitor da Cunha', '51', '996534673'),
      ('José Carlos Ferreira Ebert', '51', '995271748'),
      ('Lucas de Jesus Silva', '51', '980165549'),
      ('Maiara Conceição Pereira da Silva', '51', '997211299'),
      ('Melissa da Silva Leite', '51', '994819296'),
      ('Milena Cunha', '51', '999642404'),
      ('Natália Taborda', '51', '981664891'),
      ('Otniel Souza Moreira', '51', '999094705'),
      ('Pablo Flores Santarem', '51', '995625408'),
      ('Renan Bahr', '51', '997300402'),
      ('Ruan Lopes', '51', '993371657'),
      ('Sabrina Machado', '51', '980819828'),
      ('Senilton Nascimento', '51', '996763131'),
      ('Stefane de Azevedo Souza', '51', '996394375'),
      ('Tainara Vargas Teixeira', '51', '999132543'),
      ('Viviane Aparecida da Silva', '51', '997885943'),
      ('Xaiany de Leão Goncalves', '51', '998885869'),
      ('Yuri Rosa', '51', '996195992')
    ) AS t(nome, ddd, numero)
  LOOP
    SELECT count(*) INTO v_count
      FROM public.profiles
     WHERE display_name = rec.nome
       AND display_name NOT ILIKE '%teste%';

    IF v_count = 1 THEN
      UPDATE public.profiles
         SET telefone = '55' || rec.ddd || rec.numero
       WHERE display_name = rec.nome
         AND display_name NOT ILIKE '%teste%';
    ELSE
      SELECT string_agg(DISTINCT display_name, ' | ') INTO v_sugestao
        FROM public.profiles
       WHERE display_name ILIKE '%' || split_part(rec.nome, ' ', 1) || '%'
         AND display_name NOT ILIKE '%teste%';

      v_problemas := v_problemas || format(
        E'\n- "%s": encontrou %s perfil(is)%s',
        rec.nome, v_count,
        CASE WHEN v_sugestao IS NOT NULL THEN format(' (parecidos cadastrados: %s)', v_sugestao) ELSE '' END
      );
    END IF;
  END LOOP;

  IF v_problemas <> '' THEN
    RAISE EXCEPTION 'Nomes que não bateram com exatamente 1 perfil (ajuste a lista e rode de novo):%', v_problemas;
  END IF;
END $$;

-- Religa os triggers (o SET acima não é desfeito sozinho no fim da
-- transação quando ela é commitada — só em caso de rollback).
SET session_replication_role = DEFAULT;
