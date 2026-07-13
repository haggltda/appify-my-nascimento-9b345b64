import { useState } from "react";
import { Send, Save, Shield, FileText } from "lucide-react";

export interface PareceristaFormProps {
  papel: string;
  subtitulo?: string;
  cor?: "primary" | "accent";
}

const trilhaMock = [
  { d: "Hoje 14:30", a: "Você", e: "Iniciou redação do parecer" },
  { d: "Hoje 09:12", a: "Sistema", e: "Triagem por IA concluída" },
  { d: "Ontem 16:50", a: "Marcos P.", e: "Parecer técnico aprovado" },
  { d: "12/04 11:05", a: "Ana C.", e: "Cadastrou oportunidade" },
];

export function PareceristaForm({ papel, subtitulo, cor = "primary" }: PareceristaFormProps) {
  const [decisao, setDecisao] = useState<"aprovado" | "reprovado" | "ressalvas">("aprovado");
  const [justificativa, setJustificativa] = useState("");

  const opcoes: { id: typeof decisao; label: string; chip: string }[] = [
    { id: "aprovado", label: "Aprovado", chip: "border-success/40 bg-success-soft text-success" },
    { id: "reprovado", label: "Reprovado", chip: "border-destructive/40 bg-destructive-soft text-destructive" },
    { id: "ressalvas", label: "Aprovado com Ressalvas", chip: "border-warning/40 bg-warning-soft text-warning" },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        {/* Resumo */}
        <section className="card-elevated p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resumo do Processo</p>
          <h2 className="mt-1 font-display text-base font-bold">PE 142/2025 - Operação e manutenção de UTEs · Lote 03</h2>
          <p className="text-sm text-muted-foreground">SABESP · Pregão Eletrônico · Responsável: Ana Carvalho</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="chip border border-border bg-muted">Valor: R$ 18.420.000</span>
            <span className="chip border border-warning/30 bg-warning-soft text-warning">Criticidade Alta</span>
            <span className="chip border border-info/30 bg-info-soft text-info">Sessão: 19/05/2025</span>
            <span className="chip border border-primary/30 bg-primary-soft text-primary">{papel}</span>
          </div>
        </section>

        {/* Decisão */}
        <section className="card-elevated">
          <header className="flex items-center gap-2 border-b border-border px-5 py-3">
            <FileText className={`h-4 w-4 text-${cor}`} />
            <h3 className="font-display text-sm font-bold">Decisão do Parecer - {papel}</h3>
          </header>
          <div className="space-y-5 p-5">
            {subtitulo && <p className="text-sm text-muted-foreground">{subtitulo}</p>}

            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Selecione a decisão
              </legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {opcoes.map((op) => (
                  <label
                    key={op.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                      decisao === op.id ? op.chip : "border-border bg-card hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="decisao"
                      value={op.id}
                      checked={decisao === op.id}
                      onChange={() => setDecisao(op.id)}
                      className="accent-primary"
                    />
                    {op.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Justificativa Legal / Executiva
              </label>
              <textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                rows={10}
                placeholder="Descreva os fundamentos legais, executivos e técnicos que embasam sua decisão..."
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm leading-relaxed focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {justificativa.length} caracteres · este parecer comporá a trilha de auditoria do processo.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
              <button className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-secondary">
                <Save className="h-4 w-4" /> Salvar rascunho
              </button>
              <button className="btn-relief inline-flex h-10 items-center gap-2 rounded-md bg-gradient-accent px-4 text-sm font-semibold text-accent-foreground">
                <Send className="h-4 w-4" /> Salvar e Enviar para Próxima Etapa
              </button>
            </div>
          </div>
        </section>
      </div>

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
      </aside>
    </div>
  );
}
