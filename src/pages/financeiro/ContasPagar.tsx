import { EntityCrudPage, fmtBRL, fmtDate } from "@/components/crud/EntityCrudPage";
import { Badge } from "@/components/ui/badge";
import { useList } from "@/hooks/useGenericCrud";

const statusOpts = [
  { value: "aberto", label: "Aberto" },
  { value: "parcial", label: "Parcial" },
  { value: "pago", label: "Pago" },
  { value: "vencido", label: "Vencido" },
  { value: "cancelado", label: "Cancelado" },
];

export default function ContasPagar() {
  const { data: fornecedores = [] } = useList<any>("fornecedor", { orderBy: "razao_social", ascending: true });
  return (
    <EntityCrudPage
      table="titulo_pagar"
      title="Contas a Pagar"
      description="Títulos a pagar a fornecedores."
      orderBy="data_vencimento"
      ascending={true}
      fields={[
        { key: "fornecedor_id", label: "Fornecedor", type: "select",
          options: fornecedores.map((f: any) => ({ value: f.id, label: f.razao_social })) },
        { key: "numero_documento", label: "Nº Documento", required: true },
        { key: "competencia", label: "Competência", type: "date", required: true },
        { key: "data_emissao", label: "Emissão", type: "date" },
        { key: "data_vencimento", label: "Vencimento", type: "date", required: true },
        { key: "data_pagamento", label: "Pagamento", type: "date" },
        { key: "valor", label: "Valor", type: "number", required: true, default: 0 },
        { key: "valor_pago", label: "Valor Pago", type: "number", default: 0 },
        { key: "status", label: "Status", type: "select", default: "aberto", options: statusOpts },
        { key: "observacoes", label: "Observações", type: "textarea" },
      ]}
      columns={[
        { key: "numero_documento", label: "Nº Doc" },
        { key: "fornecedor_id", label: "Fornecedor", render: (r) => fornecedores.find((f: any) => f.id === r.fornecedor_id)?.razao_social ?? "—" },
        { key: "data_vencimento", label: "Vencimento", render: (r) => fmtDate(r.data_vencimento) },
        { key: "valor", label: "Valor", render: (r) => fmtBRL(r.valor) },
        { key: "status", label: "Status", render: (r) => <Badge variant="outline">{r.status}</Badge> },
      ]}
    />
  );
}
