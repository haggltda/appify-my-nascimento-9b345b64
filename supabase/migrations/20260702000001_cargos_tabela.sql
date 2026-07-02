-- =========================================================================
-- CARGOS — tabela de referência de cargos (código → nome)
--
-- "Cargo" (código) e "Nome do Cargo" deixam de ser campos independentes na
-- EMPREGADOS: passam a referenciar esta tabela. A tela RH → Colaboradores
-- seleciona o cargo daqui e permite criar um novo (que recebe o próximo
-- código sequencial).
--
-- A tabela pode já ter sido criada à mão no banco do app (Table Editor) —
-- tudo aqui é idempotente: garante PK, unicidade de nome, RLS/GRANT e
-- semeia a partir dos pares (Cargo, Nome do Cargo) já gravados na
-- EMPREGADOS pela recodificação (migration 20260701000003).
-- =========================================================================

CREATE TABLE IF NOT EXISTS public."CARGOS" (
  "Cargo"         bigint NOT NULL,
  "Nome do Cargo" text   NOT NULL
);

-- PK em "Cargo" (a tabela criada à mão pode não ter).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."CARGOS"'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public."CARGOS" ADD PRIMARY KEY ("Cargo");
  END IF;
END $$;

-- Um código por nome: evita cadastrar o mesmo cargo duas vezes.
CREATE UNIQUE INDEX IF NOT EXISTS cargos_nome_unico
  ON public."CARGOS" (upper(btrim("Nome do Cargo")));

-- Semeia com o que a recodificação já gravou na EMPREGADOS
-- (ignora "Vazio" e os marcados como ambíguos).
INSERT INTO public."CARGOS" ("Cargo", "Nome do Cargo")
SELECT DISTINCT ON (e."Cargo") e."Cargo", btrim(e."Nome do Cargo")
FROM public."EMPREGADOS" e
WHERE e."Cargo" IS NOT NULL
  AND COALESCE(btrim(e."Nome do Cargo"), '') NOT IN ('', 'Vazio', 'AMBÍGUO - REVISAR MANUALMENTE')
ORDER BY e."Cargo"
ON CONFLICT DO NOTHING;

-- Tabela criada pelo Table Editor vem com RLS ligado e SEM policy — o app
-- (authenticated) lê vazio. Libera leitura/escrita para usuários logados.
ALTER TABLE public."CARGOS" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."CARGOS" TO authenticated;
DROP POLICY IF EXISTS cargos_all_auth ON public."CARGOS";
CREATE POLICY cargos_all_auth ON public."CARGOS"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
