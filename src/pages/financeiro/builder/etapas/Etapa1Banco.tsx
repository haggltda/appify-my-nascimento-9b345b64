import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useBuilderStore } from "../store";
import { BANCOS_CATALOGO } from "../types";
import { CheckCircle2, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function Etapa1Banco() {
  const { bancoCodigo, ambiente, nomeLayout, contaBancariaId, empresaId, setMeta } = useBuilderStore();
  const [contas, setContas] = useState<any[]>([]);

  useEffect(() => {
    if (!empresaId) return;
    supabase.from("conta_bancaria").select("id,nome,banco,agencia,conta")
      .eq("empresa_id", empresaId).then(({ data }) => setContas(data || []));
  }, [empresaId]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Identifique o banco e a conta</h2>
        <p className="text-muted-foreground">Escolha o banco do layout e a conta bancária associada.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Conta bancária *</Label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={contaBancariaId || ""}
            onChange={(e) => setMeta({ contaBancariaId: e.target.value })}
          >
            <option value="">Selecione...</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} — {c.banco} • Ag {c.agencia} CC {c.conta}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Nome do layout *</Label>
          <Input
            placeholder="Ex.: Itaú Pagamento Fornecedores"
            value={nomeLayout}
            onChange={(e) => setMeta({ nomeLayout: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label className="mb-3 block">Banco</Label>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {BANCOS_CATALOGO.map((b) => {
            const ativo = bancoCodigo === b.codigo;
            return (
              <Card
                key={b.codigo}
                onClick={() => setMeta({ bancoCodigo: b.codigo })}
                className={`relative cursor-pointer p-4 transition hover:scale-[1.02] hover:shadow-lg ${
                  ativo ? "ring-2 ring-primary" : ""
                }`}
                style={{ borderLeft: `4px solid ${b.cor}` }}
              >
                {ativo && (
                  <CheckCircle2 className="absolute right-2 top-2 h-4 w-4 text-primary" />
                )}
                <Building2 className="mb-2 h-5 w-5 text-muted-foreground" />
                <div className="text-sm font-semibold leading-tight">{b.nome}</div>
                <div className="mt-1 text-xs text-muted-foreground">Cód {b.codigo}</div>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <Label>Ambiente</Label>
          <p className="text-xs text-muted-foreground">
            Sandbox para testes; produção envia ao banco real.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm">Sandbox</span>
          <Switch
            checked={ambiente === "producao"}
            onCheckedChange={(v) => setMeta({ ambiente: v ? "producao" : "sandbox" })}
          />
          <span className="text-sm">Produção</span>
          <Badge variant={ambiente === "producao" ? "destructive" : "secondary"}>
            {ambiente === "producao" ? "PROD" : "SANDBOX"}
          </Badge>
        </div>
      </div>
    </div>
  );
}
