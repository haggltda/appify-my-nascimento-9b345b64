import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBuilderStore } from "../store";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Copy, ShieldCheck, Webhook, AlertTriangle } from "lucide-react";

export function Etapa3Credenciais() {
  const { metodoConexao, bancoCodigo, contaBancariaId } = useBuilderStore();
  const { toast } = useToast();

  const projectId = (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID || "seu-projeto";
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/webhook-banco-${bancoCodigo || "xxx"}`;
  const callbackUrl = `${window.location.origin}/api/banco/callback/${contaBancariaId || "..."}`;

  const segredosNecessarios =
    metodoConexao === "api_rest" || metodoConexao === "open_finance"
      ? [
          { nome: `BANCO_${bancoCodigo || "XXX"}_CLIENT_ID`, ja: false },
          { nome: `BANCO_${bancoCodigo || "XXX"}_CLIENT_SECRET`, ja: false },
          { nome: `BANCO_${bancoCodigo || "XXX"}_CERTIFICADO`, ja: false, opcional: true },
        ]
      : metodoConexao === "cnab_arquivo"
      ? [
          { nome: `BANCO_${bancoCodigo || "XXX"}_FTP_USER`, ja: false, opcional: true },
          { nome: `BANCO_${bancoCodigo || "XXX"}_FTP_PASSWORD`, ja: false, opcional: true },
        ]
      : [];

  function copiar(s: string) {
    navigator.clipboard.writeText(s);
    toast({ title: "Copiado!", description: s });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Credenciais e webhook</h2>
        <p className="text-muted-foreground">
          As credenciais ficam armazenadas no Vault da Lovable (nunca no banco de dados).
        </p>
      </div>

      {segredosNecessarios.length > 0 && (
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Segredos necessários</h3>
          </div>
          <div className="space-y-2">
            {segredosNecessarios.map((s) => (
              <div key={s.nome} className="flex items-center justify-between rounded-md border p-3">
                <div className="flex items-center gap-3">
                  <code className="text-xs font-mono">{s.nome}</code>
                  {s.opcional && <Badge variant="outline">opcional</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  {s.ja ? (
                    <Badge variant="default" className="gap-1">
                      <ShieldCheck className="h-3 w-3" /> No Vault
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <AlertTriangle className="h-3 w-3" /> Pendente
                    </Badge>
                  )}
                  <Button size="sm" variant="outline" onClick={() => toast({ title: "Use o tooling", description: "Peça ao admin para registrar o segredo via Lovable Cloud." })}>
                    Registrar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">URLs para configurar no banco</h3>
        </div>
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Webhook (banco → sistema)</Label>
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} className="font-mono text-xs" />
              <Button size="icon" variant="outline" onClick={() => copiar(webhookUrl)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-xs">Callback OAuth (se aplicável)</Label>
            <div className="flex gap-2">
              <Input readOnly value={callbackUrl} className="font-mono text-xs" />
              <Button size="icon" variant="outline" onClick={() => copiar(callbackUrl)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
