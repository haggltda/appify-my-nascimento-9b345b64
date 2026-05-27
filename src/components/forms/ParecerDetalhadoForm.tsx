import { useState } from "react";
import { Save, Send, Shield, FileCheck2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import type { Licitacao } from "@/data/licitacoes";
import { formatBRL, formatDate } from "@/data/licitacoes";
import { usePermissoes } from "@/context/PermissoesContext";

export interface ChecklistItem {
  id: string;
  label: string;
  desc?: string;
}

export interface CampoExtra {
  id: string;
  label: string;
  tipo: "texto" | "numero" | "moeda" | "percentual" | "select";
  opcoes?: string[];
  placeholder?: string;
}

export interface ParecerDetalhadoConfig {
  papel: string;
  /** título exibido no topo do card de redação */
  tituloCard: string;
  /** subtítulo abaixo do número da licitação */
  subtitulo?: string;
  /** chips contextuais extras a aparecer no header (além dos padrão) */
  chipsExtras?: { label: string; tom?: "info" | "warning" | "destructive" | "success" }[];
  /** itens de checklist (multi-select) */
  checklist: { titulo: string; itens: ChecklistItem[]; defaultMarcados?: string[] };
  /** campos extras estruturados */
  campos?: CampoExtra[];
  /** recomendações disponíveis no select */
  recomendacoes: string[];
  /** label do botão de envio principal */
  labelEnviar: string;
  /** próxima etapa (lateral) */
  proximaEtapa?: { titulo: string; desc: string };
  /** lista de "frequentes" mostrados na lateral */
  referenciasLaterais?: { titulo: string; itens: string[] };
  cor?: "primary" | "accent";
  /** B2.1.e — código do menu em app_menu, usado para gating fino de permissões (`incluir` para salvar rascunho, `aprovar` para enviar). */
  menuCodigo?: string;
}

const tomChip = {
  info: "border-info/30 bg-info-soft text-info",
  warning: "border-warning/30 bg-warning-soft text-warning",
  destructive: "border-destructive/30 bg-destructive-soft text-destructive",
  success: "border-success/30 bg-success-soft text-success",
};

export function ParecerDetalhadoForm({
  licitacao: l,
  voltar,
  config,
}: {
  licitacao: Licitacao;
  voltar: () => void;
  config: ParecerDetalhadoConfig;
}) {
  const [marcados, setMarcados] = useState<string[]>(config.checklist.defaultMarcados ?? []);
  const [valoresCampos, setValoresCampos] = useState<Record<string, string>>({});
  const [recomendacao, setRecomendacao] = useState(config.recomendacoes[0]);
  const [fundamentacao, setFundamentacao] = useState("");
  const [pendencias, setPendencias] = useState("");

  const toggle = (id: string) =>
    setMarcados((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const setCampo = (id: string, v: string) => setValoresCampos((s) => ({ ...s, [id]: v }));

  const enviar = () => {
    toast.success(`Parecer ${config.papel} enviado · ${l.numero}`, {
      description: `${marcados.length} itens validados · recomendação: ${recomendacao}`,
    });
    voltar();
  };

  const cor = config.cor ?? "primary";

  return (
    <div className="space-y-5">
      {/* Cabeçalho do processo */}
      <section className="card-elevated p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Processo</p>
        <h2 className="mt-1 font-display text-lg font-bold">
          {l.numero} — {l.objeto}
        </h2>
        <p className="text-sm text-muted-foreground">
          {l.orgao} · {l.modalidade} · Empresa {l.empresa} · Responsável: {l.responsavel}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="chip border border-border bg-muted">Valor: {formatBRL(l.valorEstimado)}</span>
          <span className="chip border border-warning/30 bg-warning-soft text-warning">
            Criticidade {l.criticidade}
          </span>
          <span className="chip border border-info/30 bg-info-soft text-info">Sessão: {formatDate(l.abertura)}</span>
          <span className={`chip border border-${cor}/30 bg-${cor}-soft text-${cor}`}>{config.papel}</span>
          {config.chipsExtras?.map((c) => (
            <span key={c.label} className={`chip border ${tomChip[c.tom ?? "info"]}`}>
              {c.label}
            </span>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <section className="card-elevated">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <FileCheck2 className={`h-4 w-4 text-${cor}`} />
              <h3 className="font-display text-sm font-bold">{config.tituloCard}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-secondary">
                <Save className="h-3.5 w-3.5" /> Salvar rascunho
              </button>
              <button
                onClick={enviar}
                className="btn-relief inline-flex h-9 items-center gap-2 rounded-md bg-gradient-accent px-3.5 text-xs font-semibold text-accent-foreground"
              >
                <Send className="h-3.5 w-3.5" /> {config.labelEnviar}
              </button>
            </div>
          </header>

          <div className="space-y-6 p-5">
            {config.subtitulo && <p className="text-sm text-muted-foreground">{config.subtitulo}</p>}

            {/* Checklist */}
            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {config.checklist.titulo}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {config.checklist.itens.map((it) => {
                  const active = marcados.includes(it.id);
                  return (
                    <label
                      key={it.id}
                      className={`flex cursor-pointer items-start gap-2.5 rounded-md border-2 px-3 py-2.5 text-sm transition-colors ${
                        active ? `border-${cor} bg-${cor}-soft` : "border-border bg-card hover:bg-muted/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggle(it.id)}
                        className="mt-1 accent-primary"
                      />
                      <div>
                        <p className="font-semibold">{it.label}</p>
                        {it.desc && <p className="text-[11px] text-muted-foreground">{it.desc}</p>}
                      </div>
                    </label>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {marcados.length} de {config.checklist.itens.length} itens validados
              </p>
            </fieldset>

            {/* Campos extras */}
            {config.campos && config.campos.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-3">
                {config.campos.map((c) => (
                  <label key={c.id} className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {c.label}
                    </span>
                    {c.tipo === "select" ? (
                      <select
                        value={valoresCampos[c.id] ?? ""}
                        onChange={(e) => setCampo(c.id, e.target.value)}
                        className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                      >
                        <option value="">— Selecione —</option>
                        {c.opcoes?.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={c.tipo === "numero" || c.tipo === "moeda" || c.tipo === "percentual" ? "number" : "text"}
                        value={valoresCampos[c.id] ?? ""}
                        onChange={(e) => setCampo(c.id, e.target.value)}
                        placeholder={c.placeholder}
                        className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                      />
                    )}
                  </label>
                ))}
              </div>
            )}

            {/* Recomendação + fundamentação */}
            <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recomendação
                </span>
                <select
                  value={recomendacao}
                  onChange={(e) => setRecomendacao(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm font-semibold focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                >
                  {config.recomendacoes.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Fundamentação
                </span>
                <textarea
                  value={fundamentacao}
                  onChange={(e) => setFundamentacao(e.target.value)}
                  rows={6}
                  placeholder="Descreva os fundamentos que embasam a decisão deste parecer…"
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm leading-relaxed focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pendências identificadas
              </span>
              <textarea
                value={pendencias}
                onChange={(e) => setPendencias(e.target.value)}
                rows={3}
                placeholder="Liste pendências documentais, técnicas, jurídicas ou comerciais a sanar."
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </label>

            <button className="inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline">
              <Paperclip className="h-3.5 w-3.5" /> Anexar fundamentos adicionais
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="card-elevated p-4">
            <h3 className="flex items-center gap-2 font-display text-sm font-bold">
              <Shield className="h-3.5 w-3.5" /> Trilha de auditoria
            </h3>
            <ul className="mt-3 space-y-3 text-xs">
              {[
                { d: "Hoje 14:30", a: "Você", e: `Iniciou parecer ${config.papel}` },
                { d: "Hoje 11:02", a: l.responsavel, e: "Parecer técnico concluído" },
                { d: "Hoje 09:12", a: "Sistema", e: "Triagem por IA concluída" },
                { d: "Ontem 16:50", a: l.responsavel, e: "Editou cadastro do edital" },
              ].map((t, i) => (
                <li key={i} className="relative pl-4">
                  <span className="absolute left-0 top-1 h-2 w-2 rounded-full bg-primary" />
                  <p className="font-semibold">{t.e}</p>
                  <p className="text-muted-foreground">
                    {t.d} · {t.a}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {config.referenciasLaterais && (
            <div className="card-elevated p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {config.referenciasLaterais.titulo}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {config.referenciasLaterais.itens.map((r) => (
                  <span key={r} className="chip border border-border bg-muted text-[10px]">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          {config.proximaEtapa && (
            <div className="card-elevated p-4">
              <h3 className="font-display text-sm font-bold">Próxima etapa</h3>
              <div className="mt-3 rounded-md border border-border bg-card p-3">
                <p className="text-xs font-semibold">{config.proximaEtapa.titulo}</p>
                <p className="text-[11px] text-muted-foreground">{config.proximaEtapa.desc}</p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
