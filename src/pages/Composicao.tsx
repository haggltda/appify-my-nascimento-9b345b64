import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PieChart, Plus, Trash2, Briefcase, Calculator, TrendingUp, MapPin, Building2 } from "lucide-react";
import { formatBRL } from "@/data/contratos";

interface Posto {
  id: string;
  cargo: string;
  qtd: number;
  local: string;
  salario: number;
  va: number;
  vt: number;
  uniformes: number;
  epis: number;
  insalubridade: number;
}

const postosIniciais: Posto[] = [
  { id: "p1", cargo: "Agente de limpeza I", qtd: 84, local: "Zona Sul", salario: 1850, va: 480, vt: 240, uniformes: 95, epis: 145, insalubridade: 20 },
  { id: "p2", cargo: "Encarregado operacional", qtd: 12, local: "Zona Sul — Base SLU", salario: 4200, va: 480, vt: 240, uniformes: 95, epis: 145, insalubridade: 20 },
];

const verbasFolha = [
  { rubrica: "INSS patronal", percentual: 20.0 },
  { rubrica: "FGTS", percentual: 8.0 },
  { rubrica: "RAT/SAT", percentual: 3.0 },
  { rubrica: "Sistema S", percentual: 5.8 },
  { rubrica: "13º + provisão férias + 1/3", percentual: 11.11 },
  { rubrica: "Provisão multa rescisória", percentual: 4.0 },
];

export default function Composicao() {
  const [postos, setPostos] = useState<Posto[]>(postosIniciais);
  const [empresa] = useState("NSV — Nascimento Serviços Ltda.");
  const [licitacao] = useState("PE 044/2025 · Limpeza urbana e coleta seletiva");
  const [margem, setMargem] = useState(12);
  const [tributos] = useState(14.25); // ISS + PIS + COFINS + IRPJ + CSLL estimado
  const [custoIndireto, setCustoIndireto] = useState(8.5); // % sobre custo direto

  const totais = useMemo(() => {
    const custoDiretoMes = postos.reduce((s, p) => {
      const beneficios = p.va + p.vt + p.uniformes + p.epis;
      const folha = p.salario * (1 + verbasFolha.reduce((a, v) => a + v.percentual, 0) / 100);
      const insalub = (p.salario * p.insalubridade) / 100;
      return s + (folha + beneficios + insalub) * p.qtd;
    }, 0);
    const indiretos = (custoDiretoMes * custoIndireto) / 100;
    const subtotal = custoDiretoMes + indiretos;
    const trib = (subtotal * tributos) / 100;
    const lucro = (subtotal * margem) / 100;
    const total = subtotal + trib + lucro;
    const bdi = ((total - custoDiretoMes) / custoDiretoMes) * 100;
    return { custoDiretoMes, indiretos, subtotal, trib, lucro, total, bdi };
  }, [postos, margem, tributos, custoIndireto]);

  const addPosto = () =>
    setPostos((p) => [...p, { id: `p${Date.now()}`, cargo: "Novo cargo", qtd: 1, local: "", salario: 0, va: 0, vt: 0, uniformes: 0, epis: 0, insalubridade: 0 }]);
  const removePosto = (id: string) => setPostos((p) => p.filter((x) => x.id !== id));
  const update = (id: string, k: keyof Posto, v: any) =>
    setPostos((p) => p.map((x) => (x.id === id ? { ...x, [k]: typeof x[k] === "number" ? Number(v) || 0 : v } : x)));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Composição de Custos & BDI"
        breadcrumb={["Operação", "Composição & BDI"]}
        subtitle="Detalhamento por posto, verbas da folha, tributos e definição da margem de lucro — ainda na fase de licitação."
        actions={
          <>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted">
              Salvar rascunho
            </button>
            <button className="btn-relief inline-flex h-9 items-center gap-1.5 rounded-md bg-gradient-accent px-3 text-sm font-semibold text-accent-foreground">
              Enviar à Controladoria
            </button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Identificação */}
          <section className="card-elevated p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-bold"><Building2 className="h-4 w-4 text-primary" /> Identificação</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Empresa responsável" value={empresa} />
              <Field label="Licitação vinculada" value={licitacao} />
            </div>
          </section>

          {/* Postos */}
          <section className="card-elevated p-5">
            <header className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-sm font-bold"><Briefcase className="h-4 w-4 text-primary" /> Postos de trabalho</h2>
              <button onClick={addPosto} className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover">
                <Plus className="h-3.5 w-3.5" /> Adicionar posto
              </button>
            </header>

            <div className="space-y-4">
              {postos.map((p) => (
                <div key={p.id} className="rounded-lg border border-border bg-surface-sunken p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex flex-1 items-start gap-3">
                      <input value={p.cargo} onChange={(e) => update(p.id, "cargo", e.target.value)}
                        className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm font-semibold outline-none focus:border-primary" />
                      <div className="w-20">
                        <input type="number" value={p.qtd} onChange={(e) => update(p.id, "qtd", e.target.value)}
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-center text-sm font-semibold outline-none focus:border-primary" />
                        <p className="mt-1 text-center text-[10px] uppercase text-muted-foreground">Qtd</p>
                      </div>
                    </div>
                    <button onClick={() => removePosto(p.id)} className="grid h-8 w-8 place-items-center rounded-md text-destructive hover:bg-destructive-soft">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mb-3 flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <input value={p.local} onChange={(e) => update(p.id, "local", e.target.value)}
                      placeholder="Local de prestação"
                      className="h-8 flex-1 rounded-md border border-input bg-background px-3 text-xs outline-none focus:border-primary" />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    <Money label="Salário base" v={p.salario} onChange={(v) => update(p.id, "salario", v)} />
                    <Money label="VA" v={p.va} onChange={(v) => update(p.id, "va", v)} />
                    <Money label="VT" v={p.vt} onChange={(v) => update(p.id, "vt", v)} />
                    <Money label="Uniformes" v={p.uniformes} onChange={(v) => update(p.id, "uniformes", v)} />
                    <Money label="EPIs" v={p.epis} onChange={(v) => update(p.id, "epis", v)} />
                    <Money label="Insalub. (%)" v={p.insalubridade} onChange={(v) => update(p.id, "insalubridade", v)} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Verbas da folha */}
          <section className="card-elevated p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-bold"><Calculator className="h-4 w-4 text-primary" /> Encargos sobre a folha</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              {verbasFolha.map((v) => (
                <div key={v.rubrica} className="flex items-center justify-between rounded-md border border-border bg-surface-sunken px-3 py-2">
                  <span className="text-xs font-medium">{v.rubrica}</span>
                  <span className="font-mono text-xs font-semibold text-primary">{v.percentual.toFixed(2)}%</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Total de encargos: <strong className="text-foreground">{verbasFolha.reduce((s, v) => s + v.percentual, 0).toFixed(2)}%</strong>
            </p>
          </section>

          {/* Tributos & lucro */}
          <section className="card-elevated p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-bold"><TrendingUp className="h-4 w-4 text-accent" /> Tributos, indiretos e margem</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Slider label="Custos indiretos (% s/ direto)" v={custoIndireto} onChange={setCustoIndireto} max={30} />
              <Slider label="Carga tributária estimada" v={tributos} onChange={() => {}} max={30} disabled />
              <Slider label="Margem de lucro desejada" v={margem} onChange={setMargem} max={40} highlight />
            </div>
            <div className="mt-4 rounded-md border border-warning/30 bg-warning-soft px-3 py-2.5 text-[12px] text-warning">
              A margem definida aqui é decisão da licitação — ela será revisada pela Controladoria antes da aprovação final e comporá o BDI do contrato após assinatura.
            </div>
          </section>
        </div>

        {/* Painel lateral: BDI consolidado */}
        <aside className="space-y-4">
          <div className="card-elevated overflow-hidden">
            <header className="border-b border-border bg-gradient-primary px-5 py-3 text-primary-foreground">
              <div className="flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                <h3 className="font-display text-sm font-bold">BDI consolidado</h3>
              </div>
            </header>
            <div className="space-y-3 p-5">
              <Row label="Custo direto / mês" v={formatBRL(totais.custoDiretoMes)} />
              <Row label="Custos indiretos" v={formatBRL(totais.indiretos)} />
              <Row label="Subtotal" v={formatBRL(totais.subtotal)} bold />
              <Row label="Tributos" v={formatBRL(totais.trib)} muted />
              <Row label="Margem de lucro" v={formatBRL(totais.lucro)} accent />
              <div className="border-t border-border pt-3">
                <Row label="Preço de venda / mês" v={formatBRL(totais.total)} highlight />
              </div>
              <div className="rounded-lg bg-primary-soft p-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">BDI calculado</p>
                <p className="font-display text-3xl font-bold text-primary">{totais.bdi.toFixed(2)}%</p>
              </div>
            </div>
          </div>

          <div className="card-elevated p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Próximos passos</p>
            <ol className="space-y-1.5 text-xs text-muted-foreground">
              <li>1. Validar postos com analista técnico</li>
              <li>2. Definir margem de lucro</li>
              <li>3. Enviar à Controladoria</li>
              <li>4. Aprovação Diretoria</li>
              <li>5. Compor BDI oficial do contrato</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input readOnly value={value} className="h-9 w-full rounded-md border border-input bg-muted px-3 text-sm font-semibold" />
    </div>
  );
}

function Money({ label, v, onChange }: { label: string; v: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input type="number" value={v} onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-8 w-full rounded-md border border-input bg-background px-2 text-right font-mono text-xs outline-none focus:border-primary" />
    </div>
  );
}

function Slider({ label, v, onChange, max, disabled, highlight }: any) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
        <span className={`font-mono text-sm font-bold ${highlight ? "text-accent" : "text-primary"}`}>{Number(v).toFixed(2)}%</span>
      </div>
      <input type="range" min={0} max={max} step={0.5} value={v} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-accent" />
    </div>
  );
}

function Row({ label, v, bold, muted, accent, highlight }: any) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className={`font-mono ${bold ? "font-bold" : ""} ${accent ? "text-accent font-semibold" : ""} ${highlight ? "text-primary font-display text-lg font-bold" : ""}`}>{v}</span>
    </div>
  );
}
