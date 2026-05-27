import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Save, Send, Calculator, Plus } from "lucide-react";
import { usePermissoes } from "@/context/PermissoesContext";

interface CampoNum { key: string; label: string; tipo?: "moeda" | "percent" | "texto" | "numero" }
interface Grupo { id: string; label: string; cor: string; campos: CampoNum[] }

const grupos: Grupo[] = [
  {
    id: "posto",
    label: "Posto",
    cor: "bg-info-soft text-info border-info/30",
    campos: [
      { key: "posto", label: "Posto", tipo: "texto" },
      { key: "servico", label: "Serviço", tipo: "texto" },
      { key: "qtd", label: "Quantidade", tipo: "numero" },
      { key: "vigencia", label: "Vigência (meses)", tipo: "numero" },
    ],
  },
  {
    id: "salario",
    label: "Salário",
    cor: "bg-primary-soft text-primary border-primary/30",
    campos: [
      { key: "salBase", label: "Salário Base", tipo: "moeda" },
      { key: "insalub", label: "Adic. Insalubridade", tipo: "moeda" },
      { key: "pericul", label: "Adic. Periculosidade", tipo: "moeda" },
      { key: "lider", label: "Adic. Líder", tipo: "moeda" },
      { key: "noturno", label: "ADD Noturno", tipo: "moeda" },
      { key: "hrExtra", label: "ADD Hr Extra", tipo: "moeda" },
      { key: "dsr", label: "DSR", tipo: "moeda" },
    ],
  },
  {
    id: "encargos",
    label: "Encargos / Férias",
    cor: "bg-warning-soft text-warning border-warning/30",
    campos: [
      { key: "decimo", label: "13º", tipo: "percent" },
      { key: "adicFerias", label: "Adic. Férias (1/3)", tipo: "percent" },
      { key: "encPrev", label: "Encargos Previd. s/ Salário e Férias", tipo: "percent" },
    ],
  },
  {
    id: "impostos",
    label: "Impostos sobre Folha",
    cor: "bg-destructive-soft text-destructive border-destructive/30",
    campos: [
      { key: "inss", label: "INSS", tipo: "percent" },
      { key: "salEduc", label: "Salário Educação", tipo: "percent" },
      { key: "ratFap", label: "RAT × FAP", tipo: "percent" },
      { key: "sescSesi", label: "SESC/SESI", tipo: "percent" },
      { key: "senacSenai", label: "SENAC/SENAI", tipo: "percent" },
      { key: "sebrae", label: "SEBRAE", tipo: "percent" },
      { key: "incra", label: "INCRA", tipo: "percent" },
      { key: "fgts", label: "FGTS", tipo: "percent" },
    ],
  },
  {
    id: "beneficios",
    label: "Benefícios",
    cor: "bg-success-soft text-success border-success/30",
    campos: [
      { key: "vt", label: "VT", tipo: "moeda" },
      { key: "auxAlim", label: "Aux. Alimentação", tipo: "moeda" },
      { key: "auxRef", label: "Aux. Refeição", tipo: "moeda" },
      { key: "segVida", label: "Seguro de Vida", tipo: "moeda" },
      { key: "auxEduc", label: "Aux. Educação", tipo: "moeda" },
      { key: "auxSaude", label: "Aux. Saúde", tipo: "moeda" },
    ],
  },
  {
    id: "insumos",
    label: "Insumos",
    cor: "bg-muted text-foreground border-border",
    campos: [
      { key: "uniformes", label: "Uniformes", tipo: "moeda" },
      { key: "epis", label: "EPIs", tipo: "moeda" },
      { key: "materiais", label: "Materiais", tipo: "moeda" },
      { key: "equipamentos", label: "Equipamentos", tipo: "moeda" },
      { key: "relogio", label: "Relógio Ponto", tipo: "moeda" },
    ],
  },
  {
    id: "bdi",
    label: "BDI / Lucro / Tributos",
    cor: "bg-accent/15 text-accent border-accent/30",
    campos: [
      { key: "indiretos", label: "Custos Indiretos", tipo: "percent" },
      { key: "lucro", label: "Lucro", tipo: "percent" },
      { key: "cofins", label: "COFINS", tipo: "percent" },
      { key: "pis", label: "PIS", tipo: "percent" },
      { key: "irpj", label: "IRPJ", tipo: "percent" },
      { key: "csll", label: "CSLL", tipo: "percent" },
      { key: "iss", label: "ISS", tipo: "percent" },
    ],
  },
];

interface Linha { id: string; nome: string; valores: Record<string, number | string> }

const linhasMock: Linha[] = [
  {
    id: "l1",
    nome: "Posto Diurno - Limpeza Predial",
    valores: {
      posto: "P-001", servico: "Limpeza", qtd: 12, vigencia: 12,
      salBase: 1850, insalub: 264, pericul: 0, lider: 0, noturno: 0, hrExtra: 90, dsr: 380,
      decimo: 8.33, adicFerias: 11.11, encPrev: 7.39,
      inss: 20, salEduc: 2.5, ratFap: 3, sescSesi: 1.5, senacSesi: 1, sebrae: 0.6, incra: 0.2, fgts: 8,
      vt: 240, auxAlim: 480, auxRef: 320, segVida: 35, auxEduc: 0, auxSaude: 180,
      uniformes: 95, epis: 145, materiais: 120, equipamentos: 80, relogio: 25,
      indiretos: 8.5, lucro: 12, cofins: 3, pis: 0.65, irpj: 1.5, csll: 1, iss: 5,
    },
  },
  {
    id: "l2",
    nome: "Posto Noturno - Manutenção",
    valores: {
      posto: "P-002", servico: "Manutenção", qtd: 6, vigencia: 12,
      salBase: 2400, insalub: 264, pericul: 720, lider: 240, noturno: 480, hrExtra: 180, dsr: 520,
      decimo: 8.33, adicFerias: 11.11, encPrev: 7.39,
      inss: 20, salEduc: 2.5, ratFap: 3, sescSesi: 1.5, senacSesi: 1, sebrae: 0.6, incra: 0.2, fgts: 8,
      vt: 280, auxAlim: 540, auxRef: 360, segVida: 45, auxEduc: 80, auxSaude: 220,
      uniformes: 110, epis: 220, materiais: 180, equipamentos: 140, relogio: 25,
      indiretos: 8.5, lucro: 14, cofins: 3, pis: 0.65, irpj: 1.5, csll: 1, iss: 5,
    },
  },
];

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

function calcLinha(v: Record<string, number | string>) {
  const n = (k: string) => Number(v[k]) || 0;
  const salarioBruto =
    n("salBase") + n("insalub") + n("pericul") + n("lider") + n("noturno") + n("hrExtra") + n("dsr");
  const beneficios =
    n("vt") + n("auxAlim") + n("auxRef") + n("segVida") + n("auxEduc") + n("auxSaude");
  const insumos =
    n("uniformes") + n("epis") + n("materiais") + n("equipamentos") + n("relogio");
  const encargosPct = n("decimo") + n("adicFerias") + n("encPrev");
  const impostosPct =
    n("inss") + n("salEduc") + n("ratFap") + n("sescSesi") + n("senacSesi") + n("sebrae") + n("incra") + n("fgts");
  const encargos = (salarioBruto * (encargosPct + impostosPct)) / 100;
  const totalFunc = salarioBruto + encargos + beneficios + insumos;
  const bdiPct =
    n("indiretos") + n("lucro") + n("cofins") + n("pis") + n("irpj") + n("csll") + n("iss");
  const totalPosto = totalFunc * (1 + bdiPct / 100) * (Number(v.qtd) || 1);
  return { salarioBruto, beneficios, insumos, encargos, totalFunc, totalPosto, bdiPct };
}

export default function CustosBDI() {
  // B2.1.g — Fase 3: gating fino (incluir/alterar/aprovar) no menu "custos-bdi".
  const { can } = usePermissoes();
  const canIncluir = can("incluir", "licitacoes", "custos-bdi");
  const canAlterar = can("alterar", "licitacoes", "custos-bdi");
  const canAprovar = can("aprovar", "licitacoes", "custos-bdi");

  const [linhas, setLinhas] = useState<Linha[]>(linhasMock);
  const [ativa, setAtiva] = useState<string>(linhasMock[0].id);

  const linhaAtiva = useMemo(() => linhas.find((l) => l.id === ativa)!, [linhas, ativa]);
  const totais = useMemo(() => calcLinha(linhaAtiva.valores), [linhaAtiva]);

  const update = (key: string, raw: string, tipo?: string) => {
    const val = tipo === "texto" ? raw : Number(raw) || 0;
    setLinhas((ls) =>
      ls.map((l) => (l.id === ativa ? { ...l, valores: { ...l.valores, [key]: val } } : l)),
    );
  };

  const addLinha = () => {
    const id = `l${Date.now()}`;
    setLinhas((ls) => [
      ...ls,
      { id, nome: "Novo Posto", valores: { ...linhasMock[0].valores, posto: "", servico: "", qtd: 1 } },
    ]);
    setAtiva(id);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cadastro de Custos e BDI"
        breadcrumb={["Licitações", "Operação", "Custos e BDI"]}
        subtitle="Precificação detalhada por posto/função: salários, encargos, benefícios, insumos, BDI e tributos."
        actions={
          <>
            {canIncluir && (
              <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-secondary">
                <Save className="h-3.5 w-3.5" /> Salvar rascunho
              </button>
            )}
            <button
              disabled={!canAprovar}
              title={!canAprovar ? "Sem permissão para aprovar nesta fase" : undefined}
              className="btn-relief inline-flex h-9 items-center gap-2 rounded-md bg-gradient-accent px-3.5 text-xs font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" /> Enviar à Controladoria
            </button>
          </>
        }
      />

      {/* Tabs de postos */}
      <div className="flex flex-wrap items-center gap-2">
        {linhas.map((l) => (
          <button
            key={l.id}
            onClick={() => setAtiva(l.id)}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
              ativa === l.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted"
            }`}
          >
            {l.nome}
          </button>
        ))}
          <button
            key={l.id}
            onClick={() => setAtiva(l.id)}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
              ativa === l.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted"
            }`}
          >
            {l.nome}
          </button>
        ))}
        <button
          onClick={addLinha}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
        >
          <Plus className="h-3.5 w-3.5" /> Novo posto
        </button>
      </div>

      {/* Data Grid */}
      <section className="card-elevated overflow-hidden">
        <header className="flex items-center gap-2 border-b border-border bg-surface-sunken px-5 py-3">
          <Calculator className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-bold">Composição: {linhaAtiva.nome}</h3>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="w-[180px] px-4 py-2.5 text-left">Grupo</th>
                <th className="w-[260px] px-4 py-2.5 text-left">Custo / Campo</th>
                <th className="px-4 py-2.5 text-right">Valor</th>
                <th className="w-[80px] px-4 py-2.5 text-center">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) =>
                g.campos.map((c, idx) => (
                  <tr key={`${g.id}-${c.key}`} className="border-b border-border/60 hover:bg-muted/30">
                    {idx === 0 && (
                      <td rowSpan={g.campos.length} className="border-r border-border align-top px-4 py-3">
                        <span className={`chip border ${g.cor} font-semibold`}>{g.label}</span>
                      </td>
                    )}
                    <td className="px-4 py-2.5 font-medium">{c.label}</td>
                    <td className="px-4 py-1.5 text-right">
                      <input
                        type={c.tipo === "texto" ? "text" : "number"}
                        value={String(linhaAtiva.valores[c.key] ?? "")}
                        onChange={(e) => update(c.key, e.target.value, c.tipo)}
                        className="ml-auto block h-8 w-full max-w-[200px] rounded-md border border-input bg-background px-2 text-right font-mono text-xs outline-none focus:border-primary"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {c.tipo === "moeda" ? "R$" : c.tipo === "percent" ? "%" : c.tipo === "numero" ? "#" : "—"}
                      </span>
                    </td>
                  </tr>
                )),
              )}

              {/* Linhas de totais */}
              <tr className="border-t-2 border-primary/30 bg-primary-soft/60">
                <td className="border-r border-border px-4 py-3">
                  <span className="chip border border-primary/40 bg-primary text-primary-foreground font-bold">
                    TOTAIS
                  </span>
                </td>
                <td className="px-4 py-3 font-bold">Total por Funcionário</td>
                <td className="px-4 py-3 text-right font-mono text-base font-bold text-primary">
                  {fmtBRL(totais.totalFunc)}
                </td>
                <td className="px-4 py-3 text-center text-[10px] font-semibold uppercase text-muted-foreground">
                  R$
                </td>
              </tr>
              <tr className="bg-accent/10">
                <td className="border-r border-border px-4 py-3" />
                <td className="px-4 py-3 font-bold">
                  Total Posto <span className="text-xs font-medium text-muted-foreground">(× qtd · com BDI {totais.bdiPct.toFixed(2)}%)</span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-lg font-bold text-accent">
                  {fmtBRL(totais.totalPosto)}
                </td>
                <td className="px-4 py-3 text-center text-[10px] font-semibold uppercase text-muted-foreground">
                  R$
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { l: "Salário Bruto", v: fmtBRL(totais.salarioBruto), c: "text-primary" },
          { l: "Encargos s/ Folha", v: fmtBRL(totais.encargos), c: "text-warning" },
          { l: "Benefícios + Insumos", v: fmtBRL(totais.beneficios + totais.insumos), c: "text-info" },
          { l: "BDI Aplicado", v: `${totais.bdiPct.toFixed(2)}%`, c: "text-accent" },
        ].map((r) => (
          <div key={r.l} className="card-elevated p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{r.l}</p>
            <p className={`mt-1 font-display text-xl font-bold ${r.c}`}>{r.v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
