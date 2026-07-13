import { ReactNode, useState } from "react";
import { ArrowLeft, Search, Filter, ChevronRight } from "lucide-react";
import { licitacoes, formatBRL, formatDate, statusLabel, type Licitacao } from "@/data/licitacoes";

interface Props {
  papel: string;
  /** subset de status que esta área costuma analisar (apenas filtro visual do grid) */
  statusFiltro?: string[];
  /** render do detalhe - recebe a licitação selecionada */
  renderDetalhe: (licitacao: Licitacao, voltar: () => void) => ReactNode;
}

export function PareceristaWorkspace({ papel, statusFiltro, renderDetalhe }: Props) {
  const [selecionada, setSelecionada] = useState<Licitacao | null>(null);
  const [busca, setBusca] = useState("");

  if (selecionada) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelecionada(null)}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-semibold hover:bg-muted"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para a lista
        </button>
        {renderDetalhe(selecionada, () => setSelecionada(null))}
      </div>
    );
  }

  const lista = licitacoes
    .filter((l) => (statusFiltro ? statusFiltro.includes(l.status) : true))
    .filter((l) =>
      busca.trim()
        ? `${l.numero} ${l.objeto} ${l.orgao} ${l.responsavel}`.toLowerCase().includes(busca.toLowerCase())
        : true,
    );

  return (
    <section className="card-elevated overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-sunken px-5 py-3">
        <div>
          <h3 className="font-display text-sm font-bold">Fila de licitações · {papel}</h3>
          <p className="text-[11px] text-muted-foreground">
            Clique em uma linha para abrir o formulário de parecer.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nº, órgão, objeto…"
              className="h-9 w-64 rounded-md border border-border bg-card pl-8 pr-3 text-xs outline-none focus:border-primary"
            />
          </div>
          <button className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-muted">
            <Filter className="h-3.5 w-3.5" /> Filtros
          </button>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5 text-left">Processo</th>
              <th className="px-4 py-2.5 text-left">Objeto</th>
              <th className="px-4 py-2.5 text-left">Órgão</th>
              <th className="px-4 py-2.5 text-left">Responsável</th>
              <th className="px-4 py-2.5 text-right">Valor</th>
              <th className="px-4 py-2.5 text-left">Status</th>
              <th className="px-4 py-2.5 text-left">Sessão</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {lista.map((l) => (
              <tr
                key={l.id}
                onClick={() => setSelecionada(l)}
                className="cursor-pointer border-b border-border/60 transition-colors hover:bg-primary-soft/40"
              >
                <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{l.numero}</td>
                <td className="max-w-[320px] truncate px-4 py-3">{l.objeto}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{l.orgao}</td>
                <td className="px-4 py-3 text-xs">{l.responsavel}</td>
                <td className="px-4 py-3 text-right font-mono text-xs font-semibold">
                  {formatBRL(l.valorEstimado)}
                </td>
                <td className="px-4 py-3">
                  <span className="chip border border-info/30 bg-info-soft text-info text-[10px]">
                    {statusLabel[l.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(l.abertura)}</td>
                <td className="px-2 py-3 text-muted-foreground">
                  <ChevronRight className="h-4 w-4" />
                </td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-xs text-muted-foreground">
                  Nenhuma licitação na fila para esta área.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
