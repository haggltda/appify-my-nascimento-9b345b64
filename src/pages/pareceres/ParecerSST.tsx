import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PareceristaWorkspace } from "@/components/pareceres/PareceristaWorkspace";
import { HardHat, Save, Send, Shield, X, Plus, ShieldCheck } from "lucide-react";
import type { Licitacao } from "@/data/licitacoes";
import { toast } from "sonner";
import { usePermissoes } from "@/context/PermissoesContext";

const cargosMock = [
  "Operador de UTE",
  "Eletricista de manutenção",
  "Mecânico industrial",
  "Encarregado de turno",
  "Técnico de segurança do trabalho",
];

const riscosMock = [
  { id: "fisico", label: "Físico", desc: "Ruído, calor, vibração, radiação" },
  { id: "quimico", label: "Químico", desc: "Gases, vapores, poeiras" },
  { id: "biologico", label: "Biológico", desc: "Vírus, bactérias, fungos" },
  { id: "ergonomico", label: "Ergonômico", desc: "Postura, esforço, repetição" },
  { id: "acidente", label: "Acidentes", desc: "Quedas, choques, impactos" },
];

const episCatalogo = [
  "Luva Acrílica",
  "Botina de Segurança",
  "Protetor Auricular",
  "Cinto",
  "Óculos",
  "Capacete",
];

const recomendacoes = ["Prosseguir", "Ajustar", "Reprovar"];

export default function ParecerSST() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Parecer SST — Saúde e Segurança do Trabalho"
        breadcrumb={["Licitações", "Análise & Decisão", "Parecer SST"]}
        subtitle="Selecione um processo da fila para avaliar riscos ocupacionais, EPIs e treinamentos exigidos."
      />
      <PareceristaWorkspace
        papel="SST"
        statusFiltro={["em_analise", "parecer_tecnico", "parecer_gerencial", "controladoria"]}
        renderDetalhe={(l, voltar) => <FormularioSST licitacao={l} voltar={voltar} />}
      />
    </div>
  );
}

function FormularioSST({ licitacao: l, voltar }: { licitacao: Licitacao; voltar: () => void }) {
  const { can } = usePermissoes();
  // B2.1.e — Fase 4 (SST)
  const canIncluir = can("incluir", "licitacoes", "parecer-sst");
  const canAprovar = can("aprovar", "licitacoes", "parecer-sst");

  const [cargo, setCargo] = useState("");
  const [riscos, setRiscos] = useState<string[]>(["fisico"]);
  const [episSelecionados, setEpisSelecionados] = useState<string[]>(["Botina de Segurança", "Capacete"]);
  const [treinos, setTreinos] = useState<string[]>(["NR-10", "NR-35"]);
  const [novoTreino, setNovoTreino] = useState("");
  const [recomendacao, setRecomendacao] = useState("Prosseguir");
  const [fundamentacao, setFundamentacao] = useState("");

  const toggleRisco = (id: string) =>
    setRiscos((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));

  const toggleEPI = (epi: string) =>
    setEpisSelecionados((cur) => (cur.includes(epi) ? cur.filter((e) => e !== epi) : [...cur, epi]));

  const addTreino = () => {
    const v = novoTreino.trim();
    if (!v || treinos.includes(v)) return;
    setTreinos([...treinos, v]);
    setNovoTreino("");
  };
  const removeTreino = (v: string) => setTreinos(treinos.filter((x) => x !== v));

  const enviar = () => {
    toast.success(`Parecer SST enviado · ${l.numero}`, {
      description: `${episSelecionados.length} EPIs · ${riscos.length} riscos identificados`,
    });
    voltar();
  };

  return (
    <div className="space-y-5">
      {/* Cabeçalho do processo */}
      <section className="card-elevated p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Processo</p>
        <h2 className="mt-1 font-display text-lg font-bold">{l.numero} — {l.objeto}</h2>
        <p className="text-sm text-muted-foreground">
          {l.orgao} · {l.modalidade} · Responsável SST: Eng. Júlia Reis
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="chip border border-border bg-muted">Valor: R$ {(l.valorEstimado / 1000).toFixed(0)}k</span>
          <span className="chip border border-warning/30 bg-warning-soft text-warning">Criticidade {l.criticidade}</span>
          <span className="chip border border-info/30 bg-info-soft text-info">Sessão: {l.abertura}</span>
          <span className="chip border border-destructive/30 bg-destructive-soft text-destructive">Ambiente industrial</span>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <section className="card-elevated">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <HardHat className="h-4 w-4 text-primary" />
              <h3 className="font-display text-sm font-bold">Avaliação por Função / Cargo</h3>
            </div>
            <div className="flex items-center gap-2">
              {canIncluir && (
                <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-secondary">
                  <Save className="h-3.5 w-3.5" /> Salvar rascunho
                </button>
              )}
              <button
                onClick={enviar}
                disabled={!canAprovar}
                title={canAprovar ? undefined : "Sem permissão para enviar parecer SST"}
                className="btn-relief inline-flex h-9 items-center gap-2 rounded-md bg-gradient-accent px-3.5 text-xs font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" /> Enviar parecer SST
              </button>
            </div>
          </header>

          <div className="space-y-6 p-5">
            {/* Cargo */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Selecione a Função / Cargo
              </label>
              <select
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
              >
                <option value="">— Selecione —</option>
                {cargosMock.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Riscos */}
            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Riscos de Acidente de Trabalho
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {riscosMock.map((r) => {
                  const active = riscos.includes(r.id);
                  return (
                    <label
                      key={r.id}
                      className={`flex cursor-pointer items-start gap-2.5 rounded-md border-2 px-3 py-2.5 text-sm transition-colors ${
                        active ? "border-primary bg-primary-soft" : "border-border bg-card hover:bg-muted/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleRisco(r.id)}
                        className="mt-1 accent-primary"
                      />
                      <div>
                        <p className="font-semibold">{r.label}</p>
                        <p className="text-[11px] text-muted-foreground">{r.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* EPIs como chips clicáveis multi-select */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  EPIs Exigidos · clique para selecionar
                </label>
                <span className="text-[11px] text-muted-foreground">
                  {episSelecionados.length} de {episCatalogo.length} selecionados
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {episCatalogo.map((epi) => {
                  const active = episSelecionados.includes(epi);
                  return (
                    <button
                      key={epi}
                      type="button"
                      onClick={() => toggleEPI(epi)}
                      className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition-all ${
                        active
                          ? "border-accent bg-accent text-accent-foreground shadow-sm"
                          : "border-border bg-card text-muted-foreground hover:border-accent/40 hover:text-foreground"
                      }`}
                    >
                      {active && <ShieldCheck className="h-3.5 w-3.5" />}
                      {epi}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Treinamentos */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Treinamentos Necessários (Ex: NR-35, NR-10)
              </label>
              <div className="flex min-h-[46px] flex-wrap gap-1.5 rounded-md border border-border bg-card p-2.5">
                {treinos.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-md bg-info-soft px-2 py-1 text-xs font-semibold text-info">
                    {t}
                    <button onClick={() => removeTreino(t)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <div className="flex flex-1 items-center gap-1">
                  <input
                    value={novoTreino}
                    onChange={(e) => setNovoTreino(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTreino())}
                    placeholder="Adicionar NR/treinamento e Enter…"
                    className="h-7 min-w-[140px] flex-1 bg-transparent px-1 text-xs outline-none"
                  />
                  <button onClick={addTreino} className="grid h-6 w-6 place-items-center rounded text-info hover:bg-info-soft">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Recomendação */}
            <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recomendação
                </label>
                <select
                  value={recomendacao}
                  onChange={(e) => setRecomendacao(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm font-semibold focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                >
                  {recomendacoes.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Fundamentação Técnica
                </label>
                <textarea
                  value={fundamentacao}
                  onChange={(e) => setFundamentacao(e.target.value)}
                  rows={5}
                  placeholder="Descreva os fundamentos técnicos da recomendação SST..."
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="card-elevated p-4">
            <h3 className="flex items-center gap-2 font-display text-sm font-bold">
              <Shield className="h-3.5 w-3.5" /> Trilha de auditoria
            </h3>
            <ul className="mt-3 space-y-3 text-xs">
              {[
                { d: "Hoje 14:30", a: "Téc. SST", e: "Iniciou avaliação SST" },
                { d: "Hoje 11:02", a: l.responsavel, e: "Parecer técnico concluído" },
                { d: "Hoje 09:12", a: "Sistema", e: "Triagem por IA concluída" },
                { d: "Ontem 16:50", a: l.responsavel, e: "Editou cadastro do edital" },
              ].map((t, i) => (
                <li key={i} className="relative pl-4">
                  <span className="absolute left-0 top-1 h-2 w-2 rounded-full bg-primary" />
                  <p className="font-semibold">{t.e}</p>
                  <p className="text-muted-foreground">{t.d} · {t.a}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="card-elevated p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">NRs frequentes</p>
            <div className="flex flex-wrap gap-1.5">
              {["NR-06 EPI", "NR-10 Eletricidade", "NR-12 Máquinas", "NR-33 Confinado", "NR-35 Altura"].map((n) => (
                <span key={n} className="chip border border-border bg-muted text-[10px]">{n}</span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
