import { ContasBancariasGenericTab } from "@/components/contas-bancarias/ContasBancariasGenericTab";

interface Props {
  fornecedorId: string;
  empresaId: string;
}

export function ContasBancariasTab({ fornecedorId, empresaId }: Props) {
  return (
    <ContasBancariasGenericTab
      tableName="fornecedor_conta_bancaria"
      parentField="fornecedor_id"
      parentId={fornecedorId}
      empresaId={empresaId}
      modulo="suprimentos"
      menu="fornecedor.conta_bancaria"
    />
  );
}
