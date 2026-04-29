import { EntityCrudPage, fmtBRL, fmtDate } from "@/components/crud/EntityCrudPage";
import { Badge } from "@/components/ui/badge";

export default function Requisicoes() {
  return (
    <EntityCrudPage
      table="requisicao_compra"
      title="Requisições de Compra"
      description="Solicitações internas que originam pedidos de compra."
      orderBy="data_solicitacao"
      fields={[
        { key: "numero", label: "Número", required: true, placeholder: "RC-2026-0001" },
        { key: "data_solicitacao", label: "Data Solicitação", type: "date", required: true },
        { key: "data_necessidade", label: "Data Necessidade", type: "date" },
        { key: "valor_estimado", label: "Valor Estimado", type: "number", default: 0 },
        { key: "status", label: "Status", type: "select", default: "rascunho", options: [
          { value: "rascunho", label: "Rascunho" },
          { value: "enviada", label: "Enviada" },
          { value: "aprovada", label: "Aprovada" },
          { value: "rejeitada", label: "Rejeitada" },
          { value: "pedido_emitido", label: "Pedido Emitido" },
          { value: "cancelada", label: "Cancelada" },
        ]},
        { key: "justificativa", label: "Justificativa", type: "textarea" },
        { key: "observacoes", label: "Observações", type: "textarea" },
      ]}
      columns={[
        { key: "numero", label: "Número" },
        { key: "data_solicitacao", label: "Data", render: (r) => fmtDate(r.data_solicitacao) },
        { key: "valor_estimado", label: "Valor", render: (r) => fmtBRL(r.valor_estimado) },
        { key: "status", label: "Status", render: (r) => <Badge variant="outline">{r.status}</Badge> },
        { key: "justificativa", label: "Justificativa", render: (r) => <span className="line-clamp-1 max-w-md">{r.justificativa ?? "—"}</span> },
      ]}
    />
  );
}
