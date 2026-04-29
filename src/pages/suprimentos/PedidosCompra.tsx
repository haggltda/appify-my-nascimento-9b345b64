import { EntityCrudPage, fmtBRL, fmtDate } from "@/components/crud/EntityCrudPage";
import { Badge } from "@/components/ui/badge";
import { useList } from "@/hooks/useGenericCrud";

export default function PedidosCompra() {
  const { data: fornecedores = [] } = useList<any>("fornecedor", { orderBy: "razao_social", ascending: true });
  return (
    <EntityCrudPage
      table="pedido_compra"
      title="Pedidos de Compra"
      description="Pedidos emitidos para fornecedores."
      orderBy="data_emissao"
      fields={[
        { key: "numero", label: "Número", required: true, placeholder: "PC-2026-0001" },
        { key: "fornecedor_id", label: "Fornecedor", type: "select", required: true,
          options: fornecedores.map((f: any) => ({ value: f.id, label: f.razao_social })) },
        { key: "data_emissao", label: "Data Emissão", type: "date", required: true },
        { key: "data_entrega_prevista", label: "Entrega Prevista", type: "date" },
        { key: "condicao_pagamento", label: "Condição Pagto", placeholder: "30/60/90" },
        { key: "valor_total", label: "Valor Total", type: "number", default: 0 },
        { key: "status", label: "Status", type: "select", default: "rascunho", options: [
          { value: "rascunho", label: "Rascunho" },
          { value: "aprovado", label: "Aprovado" },
          { value: "enviado", label: "Enviado" },
          { value: "recebido_parcial", label: "Recebido Parcial" },
          { value: "recebido", label: "Recebido" },
          { value: "cancelado", label: "Cancelado" },
        ]},
        { key: "observacoes", label: "Observações", type: "textarea" },
      ]}
      columns={[
        { key: "numero", label: "Número" },
        { key: "fornecedor_id", label: "Fornecedor", render: (r) => fornecedores.find((f: any) => f.id === r.fornecedor_id)?.razao_social ?? "—" },
        { key: "data_emissao", label: "Emissão", render: (r) => fmtDate(r.data_emissao) },
        { key: "valor_total", label: "Valor", render: (r) => fmtBRL(r.valor_total) },
        { key: "status", label: "Status", render: (r) => <Badge variant="outline">{r.status}</Badge> },
      ]}
    />
  );
}
