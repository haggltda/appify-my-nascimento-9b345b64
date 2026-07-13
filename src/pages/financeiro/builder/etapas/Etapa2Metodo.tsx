import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useBuilderStore } from "../store";
import { Cable, FileText, Globe, Hand, CheckCircle2 } from "lucide-react";

const METODOS = [
  { id: "api_rest", label: "API REST", desc: "Integração via endpoint HTTP do banco", icon: Cable },
  { id: "open_finance", label: "Open Finance", desc: "Padrão regulado pelo BCB", icon: Globe },
  { id: "cnab_arquivo", label: "Arquivo CNAB", desc: "Geração de arquivo + envio FTP/SFTP/portal", icon: FileText },
  { id: "manual", label: "Manual", desc: "Operador faz o envio manualmente no internet banking", icon: Hand },
] as const;

export function Etapa2Metodo() {
  const { metodoConexao, setMeta, tipo } = useBuilderStore();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Como vamos conectar?</h2>
        <p className="text-muted-foreground">Escolha o método de envio. Cada método terá configurações específicas.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {METODOS.map((m) => {
          const ativo = metodoConexao === m.id;
          const Icon = m.icon;
          return (
            <Card
              key={m.id}
              onClick={() => {
                const novoTipo = m.id === "api_rest" || m.id === "open_finance"
                  ? "api_rest_pagamento"
                  : "cnab240_remessa_pagamento";
                setMeta({ metodoConexao: m.id as any, tipo: novoTipo });
              }}
              className={`relative cursor-pointer p-5 transition hover:shadow-lg ${
                ativo ? "ring-2 ring-primary bg-primary/5" : ""
              }`}
            >
              {ativo && <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-primary" />}
              <Icon className="mb-3 h-7 w-7 text-primary" />
              <div className="font-semibold">{m.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">{m.desc}</div>
            </Card>
          );
        })}
      </div>

      {(metodoConexao === "cnab_arquivo") && (
        <Card className="space-y-3 p-4">
          <Label>Formato do arquivo</Label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={tipo}
            onChange={(e) => setMeta({ tipo: e.target.value })}
          >
            <option value="cnab240_remessa_pagamento">CNAB 240 - Remessa Pagamento</option>
            <option value="cnab240_retorno">CNAB 240 - Retorno</option>
            <option value="cnab400_remessa">CNAB 400 - Remessa</option>
            <option value="cnab400_retorno">CNAB 400 - Retorno</option>
          </select>
        </Card>
      )}

      {(metodoConexao === "api_rest" || metodoConexao === "open_finance") && (
        <Card className="space-y-3 p-4">
          <Label>Endpoint base do banco</Label>
          <Input placeholder="https://api.banco.com.br/v1" />
          <p className="text-xs text-muted-foreground">
            Configurado por conta bancária. As credenciais ficam protegidas no Vault (próxima etapa).
          </p>
        </Card>
      )}
    </div>
  );
}
