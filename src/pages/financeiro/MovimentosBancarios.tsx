import { EntityCrudPage, fmtBRL, fmtDate } from "@/components/crud/EntityCrudPage";
import { Badge } from "@/components/ui/badge";
import { useList } from "@/hooks/useGenericCrud";

export default function MovimentosBancarios() {
  const { data: contas = [] } = useList<any>("conta_bancaria", { orderBy: "banco_nome", ascending: true });
  return (
    <EntityCrudPage
      table="movimento_bancario"
      title="Movimentos Bancários"
      description="Entradas e saídas das contas bancárias."
      orderBy="data_movimento"
      fields={[
        { key: "conta_bancaria_id", label: "Conta", type: "select", required: true,
          options: contas.map((c: any) => ({ value: c.id, label: `${c.banco_nome} ${c.agencia}/${c.conta}` })) },
        { key: "data_movimento", label: "Data", type: "date", required: true },
        { key: "tipo", label: "Tipo", type: "select", required: true, default: "credito",
          options: [{ value: "credito", label: "Crédito (entrada)" }, { value: "debito", label: "Débito (saída)" }] },
        { key: "valor", label: "Valor", type: "number", required: true, default: 0 },
        { key: "documento", label: "Documento" },
        { key: "contraparte", label: "Contraparte" },
        { key: "descricao", label: "Descrição", type: "textarea" },
        { key: "conciliado", label: "Conciliado", type: "boolean", default: false },
      ]}
      columns={[
        { key: "data_movimento", label: "Data", render: (r) => fmtDate(r.data_movimento) },
        { key: "conta_bancaria_id", label: "Conta", render: (r) => {
          const c = contas.find((x: any) => x.id === r.conta_bancaria_id);
          return c ? `${c.banco_nome} ${c.agencia}/${c.conta}` : "—";
        } },
        { key: "tipo", label: "Tipo", render: (r) => <Badge variant={r.tipo === "credito" ? "default" : "destructive"}>{r.tipo}</Badge> },
        { key: "valor", label: "Valor", render: (r) => fmtBRL(r.valor) },
        { key: "descricao", label: "Descrição" },
        { key: "conciliado", label: "Conc.", render: (r) => r.conciliado ? "✓" : "—" },
      ]}
    />
  );
}
