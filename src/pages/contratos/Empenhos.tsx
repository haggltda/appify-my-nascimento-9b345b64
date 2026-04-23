import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { contratos, formatBRL, statusEmpenhoLabel } from "@/data/contratos";
import { Wallet, Plus, X, Building2, Calendar, Hash } from "lucide-react";

export default function Empenhos() {
  const [open, setOpen] = useState(false);

  const todos = contratos.flatMap((c) =>
    c.empenhos.map((e) => ({ ...e, contrato: c.numero, objeto: c.objeto, orgaoOrigem: c.orgao }))
  );

  const total = todos.reduce((s, e) => s + e.valor, 0);
  const utilizado = todos.reduce((s, e) => s + (e.saldoUtilizado ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empenhos"
        breadcrumb={["Contratos", "Empenhos"]}
        subtitle="Reservas orçamentárias formalizadas pelo órgão público — código, valor, data e área responsável."
        actions={
          <button onClick={() => setOpen(true)} className="btn-relief inline-flex h-9 items-center gap-1.5 rounded-md bg-gradient-accent px-3 text-sm font-semibold text-accent-foreground">
            <Plus className="h-4 w-4" /> Cadastrar empenho
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Total empenhado" v={formatBRL(total)} t="primary" />
        <Kpi label="Saldo utilizado" v={formatBRL(utilizado)} t="info" />
        <Kpi label="Saldo disponível" v={formatBRL(total - utilizado)} t="success" />
        <Kpi label="Empenhos vigentes" v={String(todos.filter((e) => e.status === "vigente" || e.status === "parcial").length)} t="warning" />
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Código NE</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Contrato</th>
                <th className="px-4 py-3">Área / Órgão</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-right">Utilizado</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {todos.map((e) => (
                <tr key={e.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono font-semibold">{e.codigo}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(e.data).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{e.contrato}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">{e.objeto}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <p>{e.area}</p>
                    <p className="text-[11px]">{e.orgao}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">{formatBRL(e.valor)}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{formatBRL(e.saldoUtilizado ?? 0)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge s={e.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && <EmpenhoModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function Kpi({ label, v, t }: { label: string; v: string; t: string }) {
  return (
    <div className="card-elevated p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 font-display text-xl font-bold text-${t}`}>{v}</p>
    </div>
  );
}

function StatusBadge({ s }: { s: keyof typeof statusEmpenhoLabel }) {
  const map: Record<string, string> = {
    vigente: "bg-success-soft text-success",
    parcial: "bg-info-soft text-info",
    exaurido: "bg-muted text-muted-foreground",
    cancelado: "bg-destructive-soft text-destructive",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${map[s]}`}>{statusEmpenhoLabel[s]}</span>;
}

function EmpenhoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl rounded-xl bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-accent-soft text-accent"><Wallet className="h-4 w-4" /></div>
            <div>
              <h3 className="font-display text-base font-bold">Cadastrar empenho</h3>
              <p className="text-xs text-muted-foreground">Reserva orçamentária formal do órgão público.</p>
            </div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted"><X className="h-4 w-4" /></button>
        </header>

        <div className="space-y-4 px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Código do empenho (NE)" icon={Hash} placeholder="2025NE000128" />
            <Field label="Data do empenho" icon={Calendar} type="date" />
            <Field label="Valor empenhado (R$)" placeholder="0,00" />
            <Field label="Vincular ao contrato" placeholder="CT 2025/0118" />
          </div>
          <Field label="Órgão público" icon={Building2} placeholder="Ex.: Prefeitura Municipal" />
          <Field label="Área / Secretaria responsável" placeholder="Ex.: Secretaria de Limpeza Urbana" />
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">Observações</label>
            <textarea rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </div>
          <div className="rounded-md border border-info/30 bg-info-soft px-3 py-2.5 text-[12px] text-info">
            O empenho garante a reserva de recursos para o pagamento. Cadastre-o assim que recebido pelo órgão para liberar a fase de contrato.
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-5 py-3">
          <button onClick={onClose} className="h-9 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted">Cancelar</button>
          <button className="btn-relief h-9 rounded-md bg-gradient-accent px-4 text-sm font-semibold text-accent-foreground">Salvar empenho</button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, ...rest }: any) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-foreground">{label}</label>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />}
        <input {...rest} className={`h-9 w-full rounded-md border border-input bg-background ${Icon ? "pl-9" : "pl-3"} pr-3 text-sm outline-none focus:border-primary`} />
      </div>
    </div>
  );
}
