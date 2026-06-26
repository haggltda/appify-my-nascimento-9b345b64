-- =========================================================================
-- RH — Colaboradores: permite editar campos de RH na EMPREGADOS pela UI.
--
-- A página RH → Colaboradores lê a EMPREGADOS e permite editar alguns campos
-- de RH (Setor_ERP, LIDER, Perfil_ERP, Situação, email). A leitura já é
-- liberada para authenticated; aqui adicionamos a policy de UPDATE.
--
-- Padrão do app: gating na UI (módulo RH é controlado por permissão) + RLS
-- permissiva. Se quiser restringir a escrita só ao RH, troque o USING/CHECK
-- por uma função tipo is_rh_ativo() (avisar que eu monto).
-- Idempotente.
-- =========================================================================

ALTER TABLE public."EMPREGADOS" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empregados_update_rh ON public."EMPREGADOS";
CREATE POLICY empregados_update_rh ON public."EMPREGADOS"
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
