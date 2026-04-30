import { Link } from "react-router-dom";
import { EntityCrudPage, fmtBRL, fmtDate } from "@/components/crud/EntityCrudPage";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Database, ShieldCheck, Sparkles } from "lucide-react";
import { useList } from "@/hooks/useGenericCrud";

function FluxoIntegracaoAviso() {
  const { data: rows = [], isLoading } = useList<any>("colaborador", { orderBy: "nome", ascending: true });
  if (isLoading || rows.length > 0) return null;
  return (
    <Card className="mb-4 border-dashed bg-muted/30 p-4">
      <p className="mb-2 text-sm font-semibold">Nenhum colaborador ainda — como carregar?</p>
      <p className="mb-3 text-xs text-muted-foreground">
        Você pode cadastrar manualmente em <Badge variant="outline">Novo</Badge> ou importar via planilha.
        A importação segue 3 etapas:
      </p>
      <ol className="grid gap-2 text-xs md:grid-cols-3">
        <li className="flex items-start gap-2 rounded border bg-background p-2">
          <Database className="mt-0.5 h-4 w-4 text-primary" />
          <div>
            <p className="font-medium">1. Materializar</p>
            <p className="text-muted-foreground">Envie a planilha em <Link className="underline" to="/app/integracao">Integração & Migração</Link> e clique em Materializar.</p>
          </div>
        </li>
        <li className="flex items-start gap-2 rounded border bg-background p-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
          <div>
            <p className="font-medium">2. Aprovar</p>
            <p className="text-muted-foreground">Revise as validações e clique em Aprovar.</p>
          </div>
        </li>
        <li className="flex items-start gap-2 rounded border bg-background p-2">
          <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
          <div>
            <p className="font-medium">3. Promover ao ERP</p>
            <p className="text-muted-foreground">Os colaboradores aparecem aqui após a promoção.</p>
          </div>
        </li>
      </ol>
    </Card>
  );
}

export default function Colaboradores() {
  return (
    <>
      <FluxoIntegracaoAviso />
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
    </>
  );
}
