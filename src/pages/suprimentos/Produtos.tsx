import { EntityCrudPage, fmtBRL } from "@/components/crud/EntityCrudPage";
import { useList } from "@/hooks/useGenericCrud";
import { Badge } from "@/components/ui/badge";

export default function Produtos() {
  const { data: categorias = [] } = useList<any>("produto_categoria", { orderBy: "nome" });

  return (
    <EntityCrudPage
      table="produto"
      title="Catálogo de Produtos"
      description="Itens de estoque com código auto-gerado (PRD-XXXXXX). Use 'código externo' para mapear sua planilha atual."
      orderBy="codigo"
      ascending
      fields={[
        { key: "codigo", label: "Código (deixe vazio p/ auto-gerar)", placeholder: "Auto: PRD-000001" },
        { key: "codigo_externo", label: "Código externo (planilha)" },
        { key: "descricao", label: "Descrição", required: true },
        {
          key: "categoria_id", label: "Categoria", type: "select",
          options: [{ value: "", label: "— sem categoria —" }, ...categorias.map((c: any) => ({ value: c.id, label: c.nome }))],
        },
        { key: "unidade", label: "Unidade", default: "UN" },
        {
          key: "metodo_custeio", label: "Método de custeio", type: "select", default: "medio", required: true,
          options: [
            { value: "medio", label: "Custo médio (recomendado p/ itens picados)" },
            { value: "compra", label: "Por compra (lote a lote)" },
          ],
        },
        { key: "controla_lote", label: "Controla lote?", type: "boolean", default: false },
        { key: "controla_validade", label: "Controla validade?", type: "boolean", default: false },
        { key: "estoque_minimo", label: "Estoque mínimo", type: "number", default: 0 },
        { key: "estoque_maximo", label: "Estoque máximo", type: "number" },
        { key: "preco_referencia", label: "Preço de referência", type: "number", default: 0 },
        { key: "ativo", label: "Ativo", type: "boolean", default: true },
        { key: "observacoes", label: "Observações", type: "textarea" },
      ]}
      columns={[
        { key: "codigo", label: "Código" },
        { key: "codigo_externo", label: "Cód. externo" },
        { key: "descricao", label: "Descrição" },
        { key: "unidade", label: "Un." },
        { key: "metodo_custeio", label: "Custeio", render: (r) => <Badge variant="outline" className="capitalize">{r.metodo_custeio === "medio" ? "Médio" : "Compra"}</Badge> },
        { key: "controla_lote", label: "Lote", render: (r) => r.controla_lote ? "✓" : "—" },
        { key: "custo_medio_atual", label: "Custo médio", render: (r) => fmtBRL(r.custo_medio_atual) },
        { key: "estoque_minimo", label: "Mín." },
        { key: "ativo", label: "Status", render: (r) => r.ativo ? <Badge variant="outline">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge> },
      ]}
    />
  );
}
