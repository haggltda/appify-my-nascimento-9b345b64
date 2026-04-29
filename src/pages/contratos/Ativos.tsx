import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { useContratos, formatBRL, statusLabel } from "@/hooks/useContratos";
import { Building2, Search, Filter, Download, ArrowUpRight } from "lucide-react";

export default function ContratosAtivos() {
  const [q, setQ] = useState("");
  const { data: contratos = [], isLoading } = useContratos();
  const list = contratos.filter(
    (c) =>
      c.objeto.toLowerCase().includes(q.toLowerCase()) ||
      c.numero.toLowerCase().includes(q.toLowerCase())
  );

  const ativos = contratos.filter((c) => c.status === "ativo").length;
  const implantacao = contratos.filter((c) => c.status === "implantacao").length;
  const faturamentoMensal = contratos
    .filter((c) => c.status === "ativo" || c.status === "implantacao")
    .reduce((acc, c) => acc + Number(c.faturamento_mensal ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contratos Ativos"
        breadcrumb={["Contratos", "Ativos"]}
        module="Contratos"
        subtitle="Carteira completa de contratos vigentes, suspensos e em implantação."
        actions={
          <>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted">
              <Download className="h-3.5 w-3.5" /> Exportar
            </button>
            <button className="btn-relief inline-flex h-9 items-center gap-1.5 rounded-md bg-gradient-accent px-3 text-sm font-semibold text-accent-foreground">
              Novo contrato
            </button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Contratos ativos" v={String(ativos)} />
        <Kpi label="Em implantação" v={String(implantacao)} />
        <Kpi label="Faturamento mensal" v={formatBRL(faturamentoMensal)} />
        <Kpi label="Total na carteira" v={String(contratos.length)} />
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por número ou objeto..."
              className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <button className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted">
            <Filter className="h-3.5 w-3.5" /> Filtros
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Contrato</th>
                <th className="px-4 py-3">Objeto</th>
                <th className="px-4 py-3">Órgão</th>
                <th className="px-4 py-3">Vigência</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Carregando contratos…</td></tr>
              )}
              {!isLoading && list.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum contrato cadastrado ainda.</td></tr>
              )}
              {list.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    {c.origem_licitacao_texto && (
                      <p className="font-mono text-[11px] text-muted-foreground">{c.origem_licitacao_texto}</p>
                    )}
                    <p className="font-semibold">{c.numero}</p>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <div className="flex items-start gap-2">
                      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary-soft text-primary"><Building2 className="h-3.5 w-3.5" /></div>
                      <span className="line-clamp-2">{c.objeto}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.orgao}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <p>{new Date(c.vigencia_inicio).toLocaleDateString("pt-BR")}</p>
                    <p className="text-[11px]">até {new Date(c.vigencia_fim).toLocaleDateString("pt-BR")}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">{formatBRL(Number(c.valor_total))}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/app/contratos/${c.id}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Abrir contrato"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, v, t = "primary" }: { label: string; v: string; t?: string }) {
  return (
    <div className="card-elevated p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 font-display text-2xl font-bold text-${t}`}>{v}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ativo: "bg-success-soft text-success",
    implantacao: "bg-info-soft text-info",
    suspenso: "bg-warning-soft text-warning",
    encerrado: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${map[status] ?? "bg-muted"}`}>
      {statusLabel[status] ?? status}
    </span>
  );
}
