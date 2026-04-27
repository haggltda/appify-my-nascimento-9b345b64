import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { HardHat, Save, Send, Shield, X, Plus } from "lucide-react";

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

const trilhaMock = [
  { d: "Hoje 14:30", a: "Téc. SST", e: "Iniciou avaliação SST" },
  { d: "Hoje 11:02", a: "Marcos P.", e: "Parecer técnico concluído" },
  { d: "Hoje 09:12", a: "Sistema", e: "Triagem por IA concluída" },
  { d: "Ontem 16:50", a: "Ana C.", e: "Editou cadastro do edital" },
  { d: "12/04 11:05", a: "Ana C.", e: "Cadastrou oportunidade" },
];

const recomendacoes = ["Prosseguir", "Ajustar", "Reprovar"];

export default function ParecerSST() {
  const [cargo, setCargo] = useState("");
  const [riscos, setRiscos] = useState<string[]>(["fisico"]);
  const [epis, setEpis] = useState<string[]>(["Capacete CA", "Luvas isolantes", "Botina de segurança"]);
  const [treinos, setTreinos] = useState<string[]>(["NR-10", "NR-35"]);
  const [novoEPI, setNovoEPI] = useState("");
  const [novoTreino, setNovoTreino] = useState("");
  const [recomendacao, setRecomendacao] = useState("Prosseguir");
  const [fundamentacao, setFundamentacao] = useState("");

  const toggleRisco = (id: string) =>
    setRiscos((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));

  const addTag = (
    list: string[],
    setList: (v: string[]) => void,
    value: string,
    setValue: (v: string) => void,
  ) => {
    const v = value.trim();
    if (!v || list.includes(v)) return;
    setList([...list, v]);
    setValue("");
  };

  const removeTag = (list: string[], setList: (v: string[]) => void, v: string) =>
    setList(list.filter((x) => x !== v));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parecer SST — Saúde e Segurança do Trabalho"
        breadcrumb={["Licitações", "Análise & Decisão", "Parecer SST"]}
        subtitle="Avaliação de riscos ocupacionais, EPIs e treinamentos exigidos por função, conforme NRs aplicáveis."
        actions={
          <>
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-secondary">
              <Save className="h-3.5 w-3.5" /> Salvar rascunho
            </button>
            <button className="btn-relief inline-flex h-9 items-center gap-2 rounded-md bg-gradient-accent px-3.5 text-xs font-semibold text-accent-foreground">
              <Send className="h-3.5 w-3.5" /> Enviar parecer SST
            </button>
          </>
        }
      />

      {/* Cabeçalho */}
      <section className="card-elevated p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Processo</p>
        <h2 className="mt-1 font-display text-lg font-bold">
          PE 142/2025 — Operação e manutenção de UTEs
        </h2>
        <p className="text-sm text-muted-foreground">
          SABESP · Pregão Eletrônico · Lote 03 · Responsável SST: Eng. Júlia Reis
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="chip border border-border bg-muted">Valor: R$ 18.420.000</span>
          <span className="chip border border-warning/30 bg-warning-soft text-warning">Criticidade Alta</span>
          <span className="chip border border-info/30 bg-info-soft text-info">Sessão: 19/05/2025</span>
          <span className="chip border border-destructive/30 bg-destructive-soft text-destructive">
            Ambiente industrial
          </span>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* Formulário */}
        <section className="card-elevated">
          <header className="flex items-center gap-2 border-b border-border px-5 py-3">
            <HardHat className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-bold">Avaliação por Função / Cargo</h3>
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
                        active
                          ? "border-primary bg-primary-soft"
                          : "border-border bg-card hover:bg-muted/50"
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

            {/* EPIs */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                EPIs Exigidos
              </label>
              <div className="flex flex-wrap gap-1.5 rounded-md border border-border bg-card p-2.5 min-h-[46px]">
                {epis.map((e) => (
                  <span
                    key={e}
                    className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-1 text-xs font-semibold text-primary"
                  >
                    {e}
                    <button onClick={() => removeTag(epis, setEpis, e)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <div className="flex flex-1 items-center gap-1">
                  <input
                    value={novoEPI}
                    onChange={(e) => setNovoEPI(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && (e.preventDefault(), addTag(epis, setEpis, novoEPI, setNovoEPI))
                    }
                    placeholder="Adicionar EPI e Enter…"
                    className="h-7 min-w-[140px] flex-1 bg-transparent px-1 text-xs outline-none"
                  />
                  <button
                    onClick={() => addTag(epis, setEpis, novoEPI, setNovoEPI)}
                    className="grid h-6 w-6 place-items-center rounded text-primary hover:bg-primary-soft"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Treinamentos */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Treinamentos Necessários (Ex: NR-35, NR-10)
              </label>
              <div className="flex flex-wrap gap-1.5 rounded-md border border-border bg-card p-2.5 min-h-[46px]">
                {treinos.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-md bg-info-soft px-2 py-1 text-xs font-semibold text-info"
                  >
                    {t}
                    <button onClick={() => removeTag(treinos, setTreinos, t)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <div className="flex flex-1 items-center gap-1">
                  <input
                    value={novoTreino}
                    onChange={(e) => setNovoTreino(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      (e.preventDefault(), addTag(treinos, setTreinos, novoTreino, setNovoTreino))
                    }
                    placeholder="Adicionar NR/treinamento e Enter…"
                    className="h-7 min-w-[140px] flex-1 bg-transparent px-1 text-xs outline-none"
                  />
                  <button
                    onClick={() => addTag(treinos, setTreinos, novoTreino, setNovoTreino)}
                    className="grid h-6 w-6 place-items-center rounded text-info hover:bg-info-soft"
                  >
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

        {/* Trilha de auditoria */}
        <aside className="space-y-4">
          <div className="card-elevated p-4">
            <h3 className="flex items-center gap-2 font-display text-sm font-bold">
              <Shield className="h-3.5 w-3.5" /> Trilha de auditoria
            </h3>
            <ul className="mt-3 space-y-3 text-xs">
              {trilhaMock.map((t, i) => (
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

          <div className="card-elevated p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              NRs frequentes
            </p>
            <div className="flex flex-wrap gap-1.5">
              {["NR-06 EPI", "NR-10 Eletricidade", "NR-12 Máquinas", "NR-33 Confinado", "NR-35 Altura"].map(
                (n) => (
                  <span key={n} className="chip border border-border bg-muted text-[10px]">
                    {n}
                  </span>
                ),
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
