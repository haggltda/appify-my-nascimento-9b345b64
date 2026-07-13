import { EntityCrudPage, fmtDate } from "@/components/crud/EntityCrudPage";
import { useList } from "@/hooks/useGenericCrud";

export default function Alocacoes() {
  const { data: colaboradores = [] } = useList<any>("colaborador", { orderBy: "nome", ascending: true });
  const { data: contratos = [] } = useList<any>("contrato", { orderBy: "numero", ascending: true });
  return (
    <EntityCrudPage
      table="alocacao_colaborador"
      title="Alocações de Colaboradores"
      description="Vínculo entre colaboradores e contratos/postos."
      orderBy="data_inicio"
      fields={[
        { key: "colaborador_id", label: "Colaborador", type: "select", required: true,
          options: colaboradores.map((c: any) => ({ value: c.id, label: `${c.matricula ?? ""} ${c.nome}`.trim() })) },
        { key: "contrato_id", label: "Contrato", type: "select",
          options: contratos.map((c: any) => ({ value: c.id, label: `${c.numero} - ${c.orgao}` })) },
        { key: "data_inicio", label: "Início", type: "date", required: true },
        { key: "data_fim", label: "Fim", type: "date" },
        { key: "ativo", label: "Ativo", type: "boolean", default: true },
        { key: "observacoes", label: "Observações", type: "textarea" },
      ]}
      columns={[
        { key: "colaborador_id", label: "Colaborador", render: (r) => colaboradores.find((c: any) => c.id === r.colaborador_id)?.nome ?? "-" },
        { key: "contrato_id", label: "Contrato", render: (r) => contratos.find((c: any) => c.id === r.contrato_id)?.numero ?? "-" },
        { key: "data_inicio", label: "Início", render: (r) => fmtDate(r.data_inicio) },
        { key: "data_fim", label: "Fim", render: (r) => fmtDate(r.data_fim) },
        { key: "ativo", label: "Ativo", render: (r) => r.ativo ? "✓" : "-" },
      ]}
    />
  );
}
