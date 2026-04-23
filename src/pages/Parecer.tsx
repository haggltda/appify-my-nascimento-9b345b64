import { PageHeader } from "@/components/layout/PageHeader";
import { FileCheck2, Save, Send, Paperclip, Shield, ChevronRight } from "lucide-react";

interface Props { papel?: "tecnico" | "gerencial" }

export default function Parecer({ papel = "tecnico" }: Props) {
  const isGerencial = papel === "gerencial";
  return (
    <div className="space-y-6">
      <PageHeader
        title={isGerencial ? "Parecer Gerencial" : "Parecer Técnico do Analista"}
        breadcrumb={[isGerencial ? "Parecer Gerencial" : "Parecer Técnico"]}
        subtitle={isGerencial
          ? "Revise a análise técnica, complemente observações e encaminhe para controladoria."
          : "Redija o parecer fundamentado. O documento integra a trilha de auditoria do processo."}
        actions={
          <>
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-secondary">
              <Save className="h-3.5 w-3.5" /> Salvar rascunho
            </button>
            {isGerencial && (
              <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-secondary">
                Devolver à equipe
              </button>
            )}
            <button className="btn-relief inline-flex h-9 items-center gap-2 rounded-md bg-gradient-accent px-3.5 text-xs font-semibold text-accent-foreground">
              <Send className="h-3.5 w-3.5" /> {isGerencial ? "Encaminhar para controladoria" : "Enviar para gerência"}
            </button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {/* Contexto */}
          <section className="card-elevated p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Processo</p>
            <h2 className="mt-1 font-display text-lg font-bold">PE 142/2025 — Operação e manutenção de UTEs · Lote 03</h2>
            <p className="text-sm text-muted-foreground">SABESP · Pregão Eletrônico · Empresa NEN · Responsável: Ana Carvalho</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="chip border border-border bg-muted">Valor: R$ 18.420.000</span>
              <span className="chip border border-warning/30 bg-warning-soft text-warning">Criticidade alta</span>
              <span className="chip border border-info/30 bg-info-soft text-info">Sessão: 19/05/2025</span>
            </div>
          </section>

          {isGerencial && (
            <section className="card-elevated">
              <header className="border-b border-border px-5 py-3">
                <h3 className="font-display text-sm font-bold">Parecer técnico vinculado</h3>
              </header>
              <div className="space-y-2 p-5 text-sm leading-relaxed text-muted-foreground">
                <p>Analista Marcos Pinto recomenda <strong className="text-foreground">prosseguir com participação</strong>, observadas as ressalvas:</p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>Margem operacional próxima ao limite mínimo institucional</li>
                  <li>Garantia exigida acima do padrão (10%)</li>
                  <li>Necessidade de subcontratação parcial para frota</li>
                </ul>
              </div>
            </section>
          )}

          {/* Editor de parecer */}
          <section className="card-elevated">
            <header className="flex items-center gap-2 border-b border-border px-5 py-3">
              <FileCheck2 className="h-4 w-4 text-primary" />
              <h3 className="font-display text-sm font-bold">Redação do parecer</h3>
            </header>
            <div className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Recomendação">
                  <select className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30">
                    <option>Prosseguir</option><option>Prosseguir com ressalvas</option><option>Não prosseguir</option><option>Devolver para análise</option>
                  </select>
                </Field>
                <Field label="Data do parecer">
                  <input type="date" className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" />
                </Field>
                <Field label="Status">
                  <select className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm">
                    <option>Em redação</option><option>Concluído</option>
                  </select>
                </Field>
              </div>

              <Field label="Fundamentação">
                <textarea rows={9}
                  placeholder="Descreva detalhadamente os fundamentos técnicos, premissas, riscos avaliados e recomendações."
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30" />
              </Field>

              <Field label="Pendências identificadas">
                <textarea rows={3}
                  placeholder="Liste pendências documentais, técnicas ou comerciais que precisam ser sanadas."
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30" />
              </Field>

              <button className="inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline">
                <Paperclip className="h-3.5 w-3.5" /> Anexar fundamentos adicionais
              </button>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="card-elevated p-4">
            <h3 className="flex items-center gap-2 font-display text-sm font-bold"><Shield className="h-3.5 w-3.5" /> Trilha de auditoria</h3>
            <ul className="mt-3 space-y-3 text-xs">
              {[
                { d: "Hoje 14:30", a: "Ana C.", e: "Iniciou redação do parecer" },
                { d: "Hoje 09:12", a: "Sistema", e: "Triagem por IA concluída" },
                { d: "Ontem 16:50", a: "Ana C.", e: "Editou cadastro do edital" },
                { d: "12/04 11:05", a: "Ana C.", e: "Cadastrou oportunidade" },
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
            <h3 className="font-display text-sm font-bold">Próxima etapa</h3>
            <button className="group mt-3 flex w-full items-center justify-between rounded-md border border-border bg-card p-3 hover:border-primary/40">
              <div className="text-left">
                <p className="text-xs font-semibold">{isGerencial ? "Revisão controladoria" : "Parecer gerencial"}</p>
                <p className="text-[11px] text-muted-foreground">{isGerencial ? "Revisão de margem e tributos" : "Revisão e endosso pelo gerente"}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold">{label}</span>{children}</label>;
}
