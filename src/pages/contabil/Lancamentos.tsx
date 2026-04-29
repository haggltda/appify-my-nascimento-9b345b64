import { EntityCrudPage, fmtBRL, fmtDate } from "@/components/crud/EntityCrudPage";
import { Badge } from "@/components/ui/badge";

export default function Lancamentos() {
  return (
    <EntityCrudPage
      table="lancamento_contabil"
      title="Lançamentos Contábeis"
      description="Cabeçalhos dos lançamentos. Partidas (D/C) gerenciadas por integração."
      orderBy="data_lancamento"
      fields={[
        { key: "numero", label: "Número", required: true, placeholder: "LC-2026-0001" },
        { key: "data_lancamento", label: "Data", type: "date", required: true },
        { key: "historico", label: "Histórico", required: true, type: "textarea" },
        { key: "valor_total", label: "Valor Total", type: "number", required: true, default: 0 },
        { key: "origem", label: "Origem", placeholder: "manual / financeiro / folha" },
        { key: "status", label: "Status", type: "select", default: "rascunho", options: [
          { value: "rascunho", label: "Rascunho" },
          { value: "efetivado", label: "Efetivado" },
          { value: "estornado", label: "Estornado" },
        ]},
      ]}
      columns={[
        { key: "numero", label: "Número" },
        { key: "data_lancamento", label: "Data", render: (r) => fmtDate(r.data_lancamento) },
        { key: "historico", label: "Histórico", render: (r) => <span className="line-clamp-1 max-w-md">{r.historico}</span> },
        { key: "valor_total", label: "Valor", render: (r) => fmtBRL(r.valor_total) },
        { key: "status", label: "Status", render: (r) => <Badge variant="outline">{r.status}</Badge> },
      ]}
    />
  );
}
