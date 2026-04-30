import { Card } from "@/components/ui/card";
import { CheckCircle2, Database, ShieldCheck, Sparkles, ArrowDown } from "lucide-react";

export function BatchStepper({
  status,
  blockingErrors,
  filesCount = 0,
  materializedCount = 0,
}: {
  status: string;
  blockingErrors: number;
  filesCount?: number;
  materializedCount?: number;
}) {
  let current = 1;
  if (["validado_ok", "validado_com_erros", "processando"].includes(status)) current = 2;
  else if (status === "aprovado") current = 3;
  else if (status === "carregado") current = 4;
  else if (status === "rejeitado") current = 0;

  // Próxima ação contextual
  let nextAction = "";
  if (current === 1) {
    if (filesCount === 0) {
      nextAction = "Envie um arquivo XLSX/CSV no painel abaixo para começar.";
    } else if (materializedCount < filesCount) {
      nextAction = `Clique em "Materializar" na linha do arquivo (${filesCount - materializedCount} pendente(s)) para aplicar o de-para e gerar as validações.`;
    } else {
      nextAction = "Arquivo materializado — aguardando consolidação do status do lote. Recarregue a página se persistir.";
    }
  } else if (current === 2) {
    nextAction = blockingErrors > 0
      ? `Resolva ${blockingErrors} erro(s) bloqueante(s) na tabela de Validações abaixo. Depois clique em "Aprovar".`
      : 'Revise as validações e clique em "Aprovar" no topo da página.';
  } else if (current === 3) {
    nextAction = 'Clique em "Promover para tabelas finais" no topo para gravar nas tabelas do ERP (ex.: Colaboradores).';
  } else if (current === 4) {
    nextAction = "Lote concluído. Os dados já estão disponíveis nas telas finais (ex.: RH › Colaboradores).";
  } else if (current === 0) {
    nextAction = "Lote rejeitado. Crie um novo lote para reprocessar.";
  }

  const steps = [
    { n: 1, icon: Database,    title: "Materializar",    desc: "Lê a planilha, aplica o de-para e grava em staging com validações." },
    { n: 2, icon: ShieldCheck, title: "Aprovar",         desc: blockingErrors > 0 ? `Resolva ${blockingErrors} erro(s) bloqueante(s) antes de aprovar.` : "Conferir validações e aprovar o lote." },
    { n: 3, icon: Sparkles,    title: "Promover ao ERP", desc: "Insere os dados nas tabelas finais (ex.: Colaboradores)." },
  ];

  return (
    <Card className="mb-4 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Fluxo do lote (3 etapas)</h3>
        <span className="text-xs text-muted-foreground">
          {current === 4 ? "✅ Concluído — dados disponíveis nas telas finais." : current === 0 ? "❌ Lote rejeitado." : `Etapa atual: ${current} de 3`}
        </span>
      </div>
      <ol className="flex flex-col gap-3 md:flex-row md:items-stretch">
        {steps.map((s, i) => {
          const done = current > s.n;
          const active = current === s.n;
          const Icon = s.icon;
          return (
            <li key={s.n} className="flex flex-1 items-stretch">
              <div className={`flex flex-1 items-start gap-3 rounded-lg border p-3 transition-colors ${done ? "border-emerald-500/40 bg-emerald-500/5" : active ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-muted/20 opacity-70"}`}>
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done ? "bg-emerald-600 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {done ? <CheckCircle2 className="h-4 w-4" /> : s.n}
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium"><Icon className="h-3.5 w-3.5" /> {s.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </div>
              {i < steps.length - 1 && <div className="mx-1 hidden self-center text-muted-foreground md:block">→</div>}
            </li>
          );
        })}
      </ol>

      {nextAction && current !== 4 && current !== 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <ArrowDown className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="text-xs">
            <p className="font-semibold text-primary">Próxima ação</p>
            <p className="text-foreground/80">{nextAction}</p>
          </div>
        </div>
      )}
    </Card>
  );
}
