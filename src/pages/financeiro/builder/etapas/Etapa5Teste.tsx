import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useBuilderStore } from "../store";
import { gerarPreview } from "../preview";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Play, Send, ShieldCheck, AlertTriangle, RotateCcw, FileDown } from "lucide-react";

export function Etapa5Teste() {
  const { estrutura, amostraInput, versaoId, status, empresaId } = useBuilderStore();
  const { toast } = useToast();
  const [resultado, setResultado] = useState<string>("");
  const [submetendo, setSubmetendo] = useState(false);

  const preview = useMemo(() => {
    try { return gerarPreview(estrutura, amostraInput); } catch (e: any) { return "Erro: " + e.message; }
  }, [estrutura, amostraInput]);

  async function gerarTeste() {
    if (!versaoId || !empresaId) {
      toast({ title: "Salve antes", description: "A versão precisa estar salva.", variant: "destructive" });
      return;
    }
    setResultado(preview);
    await supabase.from("banco_layout_teste").insert({
      empresa_id: empresaId,
      layout_versao_id: versaoId,
      tipo_teste: "preview",
      input_payload: amostraInput,
      output_gerado: preview,
      sucesso: true,
    });
    toast({ title: "Teste gerado", description: "Saída registrada no histórico." });
  }

  async function baixar() {
    const blob = new Blob([preview], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `teste-${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
  }

  async function submeterAprovacao() {
    if (!versaoId) return;
    setSubmetendo(true);
    const { error } = await supabase.rpc("layout_submeter_aprovacao", { _versao_id: versaoId });
    setSubmetendo(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Submetido!", description: "Versão enviada para aprovação." });
      useBuilderStore.setState({ status: "pendente_aprovacao" });
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-4 p-5">
        <div>
          <h3 className="font-semibold">Dados de teste (amostra)</h3>
          <p className="text-xs text-muted-foreground">JSON usado para preencher os campos no preview.</p>
        </div>
        <Textarea
          rows={18}
          className="font-mono text-xs"
          value={JSON.stringify(amostraInput, null, 2)}
          onChange={(e) => {
            try { useBuilderStore.setState({ amostraInput: JSON.parse(e.target.value), dirty: true }); } catch {}
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={gerarTeste}><Play className="mr-1 h-4 w-4" /> Gerar teste</Button>
          <Button variant="outline" onClick={baixar}><FileDown className="mr-1 h-4 w-4" /> Baixar arquivo</Button>
          <Button variant="outline" disabled>
            <Send className="mr-1 h-4 w-4" /> Validar com banco (sandbox)
          </Button>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold">Resultado</h3>
            <p className="text-xs text-muted-foreground">Saída gerada com a amostra.</p>
          </div>
          <Badge variant={status === "aprovada" ? "default" : status === "pendente_aprovacao" ? "secondary" : "outline"}>
            {status}
          </Badge>
        </div>
        <ScrollArea className="h-[380px]">
          <pre className="whitespace-pre-wrap break-all rounded-md bg-muted p-3 font-mono text-[11px]">
            {resultado || preview || "(clique em Gerar teste)"}
          </pre>
        </ScrollArea>

        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Fluxo de aprovação</AlertTitle>
          <AlertDescription>
            Após submeter, um <strong>admin</strong> ou <strong>diretor administrativo</strong> precisa aprovar antes desta versão ficar ativa.
          </AlertDescription>
        </Alert>

        <Button
          className="w-full"
          disabled={submetendo || status !== "rascunho"}
          onClick={submeterAprovacao}
        >
          <Send className="mr-2 h-4 w-4" />
          {status === "pendente_aprovacao" ? "Aguardando aprovação" : "Submeter para aprovação"}
        </Button>
      </Card>
    </div>
  );
}
