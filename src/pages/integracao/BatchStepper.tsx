import { Card } from "@/components/ui/card";
import { CheckCircle2, Database, ShieldCheck, Sparkles } from "lucide-react";

export function BatchStepper({ status, blockingErrors }: { status: string; blockingErrors: number }) {
  let current = 1;
  if (["validado_ok", "validado_com_erros", "processando"].includes(status)) current = 2;
  else if (status === "aprovado") current = 3;
  else if (status === "carregado") current = 4;
  else if (status === "rejeitado") current = 0;

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
    </Card>
  );
}
