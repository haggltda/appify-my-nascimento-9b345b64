import { EntityCrudPage, fmtBRL } from "@/components/crud/EntityCrudPage";

export default function ProdutosServicos() {
  return (
    <EntityCrudPage
      table="produto_servico"
      title="Produtos e Serviços"
      description="Catálogo de produtos e serviços para requisições e pedidos."
      orderBy="codigo"
      ascending={true}
      fields={[
        { key: "codigo", label: "Código", required: true },
        { key: "descricao", label: "Descrição", required: true },
        { key: "tipo", label: "Tipo", type: "select", options: [{ value: "produto", label: "Produto" }, { value: "servico", label: "Serviço" }], default: "produto", required: true },
        { key: "unidade", label: "Unidade", default: "UN" },
        { key: "preco_referencia", label: "Preço de Referência", type: "number", default: 0 },
        { key: "ativo", label: "Ativo", type: "boolean", default: true },
      ]}
      columns={[
        { key: "codigo", label: "Código" },
        { key: "descricao", label: "Descrição" },
        { key: "tipo", label: "Tipo" },
        { key: "unidade", label: "Un." },
        { key: "preco_referencia", label: "Preço Ref.", render: (r) => fmtBRL(r.preco_referencia) },
      ]}
    />
  );
}
