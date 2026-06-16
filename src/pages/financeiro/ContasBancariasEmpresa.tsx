import { EntityCrudPage } from "@/components/crud/EntityCrudPage";
import { Badge } from "@/components/ui/badge";

export default function ContasBancariasEmpresa() {
  return (
    <EntityCrudPage
      table="conta_bancaria"
      title="Contas Bancárias"
      description="Cadastro das contas bancárias próprias da empresa."
      orderBy="banco_nome"
      ascending
      fields={[
        { key: "banco_codigo", label: "Código do Banco", required: true },
        { key: "banco_nome", label: "Nome do Banco", required: true },
        { key: "agencia", label: "Agência", required: true },
        { key: "conta", label: "Conta", required: true },
        { key: "digito", label: "Dígito" },
        { key: "tipo", label: "Tipo", type: "select", required: true, default: "corrente",
          options: [
            { value: "corrente", label: "Corrente" },
            { value: "poupanca", label: "Poupança" },
            { value: "aplicacao", label: "Aplicação" },
            { value: "vinculada", label: "Vinculada" },
          ] },
        { key: "titular", label: "Titular" },
        { key: "ativa", label: "Ativa", type: "boolean", default: true },
        { key: "observacoes", label: "Observações", type: "textarea" },
      ]}
      columns={[
        { key: "banco_codigo", label: "Cód." },
        { key: "banco_nome", label: "Banco" },
        { key: "agencia", label: "Agência" },
        { key: "conta", label: "Conta", render: (r) => `${r.conta}${r.digito ? "-" + r.digito : ""}` },
        { key: "tipo", label: "Tipo" },
        { key: "titular", label: "Titular" },
        { key: "ativa", label: "Status", render: (r) => r.ativa
          ? <Badge variant="secondary">Ativa</Badge>
          : <Badge variant="outline">Inativa</Badge> },
      ]}
    />
  );
}
