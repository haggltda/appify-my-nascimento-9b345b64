import { EntityCrudPage, fmtBRL, fmtDate } from "@/components/crud/EntityCrudPage";
import { Badge } from "@/components/ui/badge";

const statusOpts = [
  { value: "aberto", label: "Aberto" },
  { value: "parcial", label: "Parcial" },
  { value: "pago", label: "Recebido" },
  { value: "vencido", label: "Vencido" },
  { value: "cancelado", label: "Cancelado" },
];

export default function ContasReceber() {
  return (
    <EntityCrudPage
      table="titulo_receber"
      title="Contas a Receber"
      description="Títulos a receber de clientes/contratos."
      orderBy="data_vencimento"
      ascending={true}
      fields={[
        { key: "cliente_nome", label: "Cliente", required: true },
        { key: "numero_documento", label: "Nº Documento", required: true },
        { key: "competencia", label: "Competência", type: "date", required: true },
        { key: "data_emissao", label: "Emissão", type: "date" },
        { key: "data_vencimento", label: "Vencimento", type: "date", required: true },
        { key: "data_recebimento", label: "Recebimento", type: "date" },
        { key: "valor", label: "Valor", type: "number", required: true, default: 0 },
        { key: "valor_recebido", label: "Valor Recebido", type: "number", default: 0 },
        { key: "status", label: "Status", type: "select", default: "aberto", options: statusOpts },
        { key: "observacoes", label: "Observações", type: "textarea" },
      ]}
      columns={[
        { key: "numero_documento", label: "Nº Doc" },
        { key: "cliente_nome", label: "Cliente" },
        { key: "data_vencimento", label: "Vencimento", render: (r) => fmtDate(r.data_vencimento) },
        { key: "valor", label: "Valor", render: (r) => fmtBRL(r.valor) },
        { key: "status", label: "Status", render: (r) => <Badge variant="outline">{r.status}</Badge> },
      ]}
    />
  );
}
