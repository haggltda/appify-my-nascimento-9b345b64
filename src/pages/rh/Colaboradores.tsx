import { EntityCrudPage, fmtBRL, fmtDate } from "@/components/crud/EntityCrudPage";
import { Badge } from "@/components/ui/badge";

export default function Colaboradores() {
  return (
    <EntityCrudPage
      table="colaborador"
      title="Colaboradores"
      description="Cadastro de colaboradores ativos da empresa."
      orderBy="nome"
      ascending={true}
      fields={[
        { key: "cpf", label: "CPF", required: true },
        { key: "nome", label: "Nome", required: true },
        { key: "matricula", label: "Matrícula" },
        { key: "cargo", label: "Cargo" },
        { key: "data_admissao", label: "Admissão", type: "date", required: true },
        { key: "data_demissao", label: "Demissão", type: "date" },
        { key: "salario_base", label: "Salário Base", type: "number", default: 0 },
        { key: "status", label: "Status", type: "select", default: "ativo", options: [
          { value: "ativo", label: "Ativo" },
          { value: "afastado", label: "Afastado" },
          { value: "ferias", label: "Férias" },
          { value: "demitido", label: "Demitido" },
        ]},
        { key: "email", label: "E-mail" },
        { key: "telefone", label: "Telefone" },
        { key: "observacoes", label: "Observações", type: "textarea" },
      ]}
      columns={[
        { key: "matricula", label: "Mat." },
        { key: "nome", label: "Nome" },
        { key: "cpf", label: "CPF" },
        { key: "cargo", label: "Cargo" },
        { key: "data_admissao", label: "Admissão", render: (r) => fmtDate(r.data_admissao) },
        { key: "salario_base", label: "Salário", render: (r) => fmtBRL(r.salario_base) },
        { key: "status", label: "Status", render: (r) => <Badge variant="outline">{r.status}</Badge> },
      ]}
    />
  );
}
