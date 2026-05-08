import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { usePermissoes } from "@/context/PermissoesContext";
import { usePlanoAcaoPermissao } from "@/hooks/usePlanoAcaoPermissao";
import { ForbiddenCard } from "./Lista";
import { useToast } from "@/hooks/use-toast";
import { PLANO_ACOES_SEED, PLANO_ACOES_SEED_TOTAL } from "@/data/planoAcoesSeed";
import { Upload, CheckCircle2, AlertTriangle, Database } from "lucide-react";

export default function PlanoAcoesImportar() {
  const { empresaId } = usePermissoes();
  const { can, loading } = usePlanoAcaoPermissao();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);

  const carregarBatches = async () => {
    if (!empresaId) return;
    const { data } = await supabase.from("plano_acao_import_batch")
      .select("*").eq("empresa_id", empresaId).order("created_at", { ascending: false }).limit(10);
    setBatches(data ?? []);
  };

  if (loading) return null;
  if (!can("importar")) return <ForbiddenCard />;

  const executarSeed = async () => {
    if (!empresaId) return;
    if (!confirm(`Executar carga inicial das ${PLANO_ACOES_SEED_TOTAL} ações? A operação é idempotente — reexecutar não duplica dados.`)) return;
    setRunning(true); setResult(null);
    try {
      const { data, error } = await supabase.rpc("plano_acao_seed_inicial", {
        _empresa: empresaId,
        _payload: PLANO_ACOES_SEED as any,
      });
      if (error) throw error;
      setResult(data);
      toast({ title: "Carga concluída", description: JSON.stringify(data) });
      qc.invalidateQueries({ queryKey: ["plano_acoes"] });
      carregarBatches();
    } catch (e: any) {
      toast({ title: "Erro na carga", description: e.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Importação — Plano de Ações"
        subtitle="Carga inicial e reimportações idempotentes via id_importacao"
        module="Plano de Ações"
        breadcrumb={["Importar"]}
        actions={<Button asChild variant="outline" size="sm"><Link to="/app/plano-acoes">← Lista</Link></Button>}
      />

      <Card className="mb-4 p-5">
        <div className="flex items-start gap-4">
          <div className="rounded-md bg-primary/10 p-3"><Database className="h-6 w-6 text-primary" /></div>
          <div className="flex-1">
            <h3 className="font-display text-lg font-bold">Carga Inicial — 123 ações Nascimento</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Origem: <span className="font-mono">Gerenciamento de Tarefas - Nascimento - Tático - Plano de Ações.csv</span>.
              Status: em_andamento (47), a_definir (43), concluida_pendente_evidencia (30), atrasada (2), nao_iniciada (1).
              Reexecuções fazem upsert por <span className="font-mono">id_importacao</span>.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Button onClick={executarSeed} disabled={running}>
                <Upload className="mr-2 h-4 w-4" />
                {running ? "Executando..." : `Executar carga (${PLANO_ACOES_SEED_TOTAL} ações)`}
              </Button>
              <Button variant="outline" onClick={carregarBatches}>Atualizar lotes</Button>
            </div>
          </div>
        </div>

        {result && (
          <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Reconciliação
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
              <Stat label="Recebidas" value={result.recebidas} />
              <Stat label="Processadas" value={result.processadas} />
              <Stat label="Inseridas" value={result.inseridas} tone="success" />
              <Stat label="Atualizadas" value={result.atualizadas} />
              <Stat label="Pendentes" value={result.pendentes} tone="warning" />
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Últimos lotes</h3>
        {batches.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum lote ainda carregado. Clique em <strong>Atualizar lotes</strong> ou execute a carga acima.
          </p>
        )}
        <div className="space-y-2">
          {batches.map(b => (
            <div key={b.id} className="flex items-center justify-between rounded border border-border p-2 text-sm">
              <div>
                <p className="font-medium">{b.arquivo_nome ?? "Lote sem arquivo"}</p>
                <p className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString("pt-BR")}</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <Badge variant="secondary">{b.total_linhas} linhas</Badge>
                <Badge variant="outline">{b.total_importado} importadas</Badge>
                {b.total_pendente > 0 && <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400"><AlertTriangle className="mr-1 h-3 w-3" />{b.total_pendente} pendentes</Badge>}
                <Badge>{b.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: any; tone?: "success"|"warning" }) {
  const t = tone === "success" ? "text-emerald-600 dark:text-emerald-400" : tone === "warning" ? "text-amber-600 dark:text-amber-400" : "text-foreground";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-display text-xl font-bold ${t}`}>{value}</div>
    </div>
  );
}
