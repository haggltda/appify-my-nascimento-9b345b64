import { EntityCrudPage } from "@/components/crud/EntityCrudPage";
import { Badge } from "@/components/ui/badge";

export default function CategoriasProduto() {
  return (
    <EntityCrudPage
      table="produto_categoria"
      title="Categorias de Produto"
      description="Agrupamento de produtos (EPI, Limpeza, Escritório, etc.). Define padrões de lote/validade."
      orderBy="codigo"
      ascending
      fields={[
        { key: "codigo", label: "Código", required: true, placeholder: "Ex.: EPI" },
        { key: "nome", label: "Nome", required: true },
        { key: "descricao", label: "Descrição", type: "textarea" },
        { key: "controla_lote_padrao", label: "Controla lote (padrão)", type: "boolean", default: false },
        { key: "controla_validade_padrao", label: "Controla validade (padrão)", type: "boolean", default: false },
        { key: "ativo", label: "Ativo", type: "boolean", default: true },
      ]}
      columns={[
        { key: "codigo", label: "Código" },
        { key: "nome", label: "Nome" },
        { key: "controla_lote_padrao", label: "Lote", render: (r) => r.controla_lote_padrao ? <Badge variant="outline">Sim</Badge> : "-" },
        { key: "controla_validade_padrao", label: "Validade", render: (r) => r.controla_validade_padrao ? <Badge variant="outline">Sim</Badge> : "-" },
        { key: "ativo", label: "Status", render: (r) => r.ativo ? <Badge variant="outline">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge> },
      ]}
    />
  );
}
