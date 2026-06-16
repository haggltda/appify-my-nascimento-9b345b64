import { EntityCrudPage } from "@/components/crud/EntityCrudPage";
import { useList } from "@/hooks/useGenericCrud";
import { Badge } from "@/components/ui/badge";

export default function Almoxarifados() {
  const { data: contratos = [] } = useList<any>("contrato", { orderBy: "numero" });

  return (
    <EntityCrudPage
      table="almoxarifado"
      title="Almoxarifados"
      description="Locais de estoque (Matriz, Depósitos, Obras). A Matriz é criada automaticamente para cada empresa."
      orderBy="codigo"
      ascending
      fields={[
        { key: "codigo", label: "Código", required: true, placeholder: "Ex.: DEPOSITO-1" },
        { key: "nome", label: "Nome", required: true },
        {
          key: "tipo", label: "Tipo", type: "select", required: true, default: "deposito",
          options: [
            { value: "matriz", label: "Matriz" },
            { value: "deposito", label: "Depósito" },
            { value: "obra", label: "Obra/Posto" },
            { value: "veiculo", label: "Veículo" },
            { value: "outro", label: "Outro" },
          ],
        },
        {
          key: "contrato_id", label: "Contrato vinculado (opcional)", type: "select",
          options: [{ value: "", label: "— nenhum —" }, ...contratos.map((c: any) => ({ value: c.id, label: `${c.numero} — ${c.objeto?.slice(0, 40)}` }))],
        },
        { key: "responsavel", label: "Responsável" },
        { key: "endereco", label: "Endereço" },
        { key: "ativo", label: "Ativo", type: "boolean", default: true },
        { key: "observacoes", label: "Observações", type: "textarea" },
      ]}
      columns={[
        { key: "codigo", label: "Código" },
        { key: "nome", label: "Nome" },
        { key: "tipo", label: "Tipo", render: (r) => <Badge variant="outline" className="capitalize">{r.tipo}</Badge> },
        { key: "is_matriz", label: "Matriz?", render: (r) => r.is_matriz ? <Badge>Sim</Badge> : "—" },
        { key: "responsavel", label: "Responsável" },
        { key: "ativo", label: "Status", render: (r) => r.ativo ? <Badge variant="outline">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge> },
      ]}
    />
  );
}
