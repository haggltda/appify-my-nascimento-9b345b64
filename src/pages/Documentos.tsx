import { PageHeader } from "@/components/layout/PageHeader";
import { Search, Filter, Upload, FileText, FileSpreadsheet, FileArchive, Clock, Eye, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { usePermissoes } from "@/context/PermissoesContext";

const docs = [
  { id: "d1", nome: "Edital_PE_142-2025.pdf", tipo: "Edital", licitacao: "PE 142/2025", versao: "v3", autor: "Ana Carvalho", data: "12/04/2025", status: "validado", tamanho: "4.2 MB" },
  { id: "d2", nome: "Anexo_I_Termo_Referencia.pdf", tipo: "Anexo", licitacao: "PE 142/2025", versao: "v1", autor: "Ana Carvalho", data: "12/04/2025", status: "validado", tamanho: "1.8 MB" },
  { id: "d3", nome: "Planilha_Orcamento_Base.xlsx", tipo: "Planilha", licitacao: "PE 142/2025", versao: "v2", autor: "Marcos Pinto", data: "14/04/2025", status: "pendente", tamanho: "320 KB" },
  { id: "d4", nome: "Atestado_Capacidade_Tecnica.pdf", tipo: "Documento", licitacao: "CC 089/2025", versao: "v1", autor: "Juliana Reis", data: "10/04/2025", status: "validado", tamanho: "890 KB" },
  { id: "d5", nome: "Proposta_Comercial_Base.docx", tipo: "Proposta", licitacao: "PE 077/2025", versao: "v4", autor: "Juliana Reis", data: "16/04/2025", status: "pendente", tamanho: "640 KB" },
  { id: "d6", nome: "Documentacao_Habilitacao.zip", tipo: "Pacote", licitacao: "PE 058/2025", versao: "v1", autor: "Rafael Souza", data: "11/04/2025", status: "validado", tamanho: "12.4 MB" },
];

const tipoIcon: Record<string, any> = {
  Edital: FileText, Anexo: FileText, Planilha: FileSpreadsheet, Documento: FileText, Proposta: FileText, Pacote: FileArchive,
};

export default function Documentos() {
  const { can } = usePermissoes();
  // B2.1.b — Fase 2 (Documentos): permissões finas
  const canIncluir = can("incluir", "licitacoes", "documentos");
  const canExportar = can("exportar", "licitacoes", "documentos");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Repositório de Documentos"
        breadcrumb={["Documentos"]}
        subtitle="Centralize, versione e rastreie todos os arquivos vinculados a cada licitação."
        actions={
          <>
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-secondary">
              <Filter className="h-3.5 w-3.5" /> Filtros
            </button>
            {canIncluir && (
              <button className="btn-relief inline-flex h-9 items-center gap-2 rounded-md bg-gradient-accent px-3.5 text-xs font-semibold text-accent-foreground">
                <Upload className="h-3.5 w-3.5" /> Enviar arquivo
              </button>
            )}
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { l: "Total de documentos", v: "248", c: "text-foreground" },
          { l: "Aguardando validação", v: "12", c: "text-warning" },
          { l: "Validados", v: "231", c: "text-success" },
          { l: "Pendências críticas", v: "5", c: "text-destructive" },
        ].map((s) => (
          <div key={s.l} className="card-elevated p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.l}</p>
            <p className={`mt-2 font-display text-2xl font-bold ${s.c}`}>{s.v}</p>
          </div>
        ))}
      </div>

      <div className="card-elevated">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-3">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input placeholder="Buscar arquivo, licitação ou autor…"
              className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30" />
          </div>
          <select className="h-9 rounded-md border border-border bg-card px-3 text-xs">
            <option>Todos os tipos</option><option>Editais</option><option>Anexos</option><option>Planilhas</option>
          </select>
          <select className="h-9 rounded-md border border-border bg-card px-3 text-xs">
            <option>Todas as licitações</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left">Arquivo</th>
                <th className="px-3 py-3 text-left">Tipo</th>
                <th className="px-3 py-3 text-left">Licitação</th>
                <th className="px-3 py-3 text-left">Versão</th>
                <th className="px-3 py-3 text-left">Autor</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {docs.map((d) => {
                const Icon = tipoIcon[d.tipo] || FileText;
                return (
                  <tr key={d.id} className="hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{d.nome}</p>
                          <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <Clock className="h-3 w-3" /> {d.data} · {d.tamanho}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs">{d.tipo}</td>
                    <td className="px-3 py-3"><span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{d.licitacao}</span></td>
                    <td className="px-3 py-3 font-mono text-xs">{d.versao}</td>
                    <td className="px-3 py-3 text-xs">{d.autor}</td>
                    <td className="px-3 py-3">
                      {d.status === "validado" ? (
                        <span className="chip border border-success/30 bg-success-soft text-success"><CheckCircle2 className="h-3 w-3" /> Validado</span>
                      ) : (
                        <span className="chip border border-warning/30 bg-warning-soft text-warning"><AlertCircle className="h-3 w-3" /> Pendente</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground" title="Visualizar"><Eye className="h-3.5 w-3.5" /></button>
                        <button
                          disabled={!canExportar}
                          title={canExportar ? "Baixar" : "Sem permissão para exportar documentos"}
                          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                        ><Download className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
