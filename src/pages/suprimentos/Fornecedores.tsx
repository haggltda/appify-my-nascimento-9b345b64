import { EntityCrudPage, fmtBRL } from "@/components/crud/EntityCrudPage";

export default function Fornecedores() {
  return (
    <EntityCrudPage
      table="fornecedor"
      title="Fornecedores"
      description="Cadastro de fornecedores PJ/PF da empresa."
      orderBy="razao_social"
      ascending={true}
      fields={[
        { key: "tipo", label: "Tipo", type: "select", options: [{ value: "pj", label: "Pessoa Jurídica" }, { value: "pf", label: "Pessoa Física" }], default: "pj", required: true },
        { key: "cnpj_cpf", label: "CNPJ/CPF", required: true },
        { key: "razao_social", label: "Razão Social", required: true },
        { key: "nome_fantasia", label: "Nome Fantasia" },
        { key: "contato", label: "Contato" },
        { key: "email", label: "E-mail" },
        { key: "telefone", label: "Telefone" },
        { key: "endereco", label: "Endereço", type: "textarea" },
        { key: "ativo", label: "Ativo", type: "boolean", default: true },
        { key: "observacoes", label: "Observações", type: "textarea" },
      ]}
      columns={[
        { key: "razao_social", label: "Razão Social" },
        { key: "cnpj_cpf", label: "CNPJ/CPF" },
        { key: "tipo", label: "Tipo", render: (r) => r.tipo === "pj" ? "PJ" : "PF" },
        { key: "contato", label: "Contato" },
        { key: "ativo", label: "Status", render: (r) => r.ativo ? "✓ Ativo" : "Inativo" },
      ]}
    />
  );
}
