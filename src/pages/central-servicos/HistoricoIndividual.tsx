import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from "recharts";
import { Pergunta } from "./Formularios";
import { Plano, situacaoDe } from "./PainelPlanosAcao";

// =====================================================================
// PAINEL GERENCIAL — aba HISTÓRICO INDIVIDUAL
//
// A trajetória de UMA pessoa ao longo dos feedbacks: como a nota andou,
// em que dimensões subiu ou caiu, o que se repete como ponto forte e de
// melhoria, e o que ficou combinado (planos de ação).
//
// Quem é "a pessoa": o COLABORADOR AVALIADO, lido da pergunta apontada em
// `mapa.avaliado`. Não é `respondente_nome` — no formulário de feedback quem
// preenche é o líder, e esse campo costuma vir vazio (foi o que fez a coluna
// "Colaborador" dos Planos de Ação aparecer só com "—").
// =====================================================================

// respondente_nome/setor opcionais: é o mesmo formato que o Painel Gerencial
// monta (a coluna pode nem vir no select). Exigir a chave aqui fazia as duas
// interfaces `Resp` serem tipos incompatíveis na hora de passar a lista.
interface Resp { id: string; formulario_id: string; enviado_em: string; respondente_nome?: string | null; setor?: string | null; itens: Record<string, any> }

// Metas dos indicadores. Vieram da tela de referência, NÃO de uma regra do
// RH — ficam juntas e nomeadas para serem fáceis de acertar (ou de virar
// configuração por formulário) quando o RH definir os números de verdade.
const META = { media: 4.0, evolucao: 0.2, feedbacks: 4, planosPct: 100, diasUltimo: 15 };

const cardBox: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", boxShadow: "0 8px 24px rgba(15,23,42,.05)" };
const btn = (bg: string, c = "#fff", border = "none"): React.CSSProperties =>
  ({ padding: "7px 13px", borderRadius: 9, border, background: bg, color: c, fontSize: 12.5, fontWeight: 700, cursor: "pointer" });
const inp: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 9, padding: "8px 10px", fontSize: 13, outline: "none", background: "#fff", width: "100%", color: "#0f172a", boxSizing: "border-box" };
const lbl: React.CSSProperties = { display: "block", fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 };
const th: React.CSSProperties = { padding: "7px 6px", fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".4px", color: "#94a3b8", textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid #eef2f7" };
const td: React.CSSProperties = { padding: "8px 6px", fontSize: 11.5, color: "#475569", borderTop: "1px solid #f5f7fb" };

const CSS_HI = `
.hi-grid3{display:grid;gap:14px;grid-template-columns:1.1fr 1.15fr .95fr}
/* Peso maior nos dois cards que têm TABELA (dimensões e planos): medido na
   marra — com larguras parecidas a coluna "Dimensão" caía para ~7 caracteres
   ("Desenv…") e o card virava enfeite. Listas e barras encolhem sem perder. */
.hi-grid5{display:grid;gap:14px;grid-template-columns:1.45fr .85fr .85fr 1.3fr .9fr}
@media (max-width:1250px){.hi-grid3,.hi-grid5{grid-template-columns:1fr 1fr}}
@media (max-width:760px){.hi-grid3,.hi-grid5{grid-template-columns:1fr}}
.hi-grid3>*,.hi-grid5>*{min-width:0}
.hi-tab{width:100%;border-collapse:collapse;table-layout:fixed}
.hi-tab td>div{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`;

const nInt = (n: number) => n.toLocaleString("pt-BR");
const n2 = (n: number) => n.toFixed(2).replace(".", ",");
const n1 = (n: number) => n.toFixed(1).replace(".", ",");
const sinal = (n: number) => `${n >= 0 ? "+" : "−"}${n2(Math.abs(n))}`;
const fmtD = (iso?: string | null) => { if (!iso) return "—"; const [a, m, d] = iso.slice(0, 10).split("-"); return `${d}/${m}/${a}`; };
const hojeISO = () => new Date().toISOString().slice(0, 10);
const diasEntre = (de: string, ate: string) => Math.round((+new Date(ate.slice(0, 10) + "T00:00:00") - +new Date(de.slice(0, 10) + "T00:00:00")) / 864e5);
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const normNome = (s: string) => semAcento(String(s ?? "")).replace(/\s+/g, " ").trim();
const trimestre = (iso: string) => { const d = new Date(iso); return `${Math.floor(d.getMonth() / 3) + 1}º Tri/${String(d.getFullYear()).slice(2)}`; };
const mesAno = (iso: string) => { const d = new Date(iso); return `${["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][d.getMonth()]}/${String(d.getFullYear()).slice(2)}`; };

// Mesma conversão para nota 1..5 usada nas outras abas: escala normaliza
// min..max; opções assumem a 1ª como a melhor.
function nota(p: Pergunta, valor: string): number | null {
  if (!valor) return null;
  if (p.tipo === "escala") {
    const n = Number(valor); if (isNaN(n)) return null;
    const min = p.config?.min ?? 1, max = p.config?.max ?? 5;
    return max === min ? null : 1 + ((n - min) / (max - min)) * 4;
  }
  const i = p.opcoes.indexOf(valor);
  if (i < 0 || p.opcoes.length < 2) return null;
  return 5 - (i / (p.opcoes.length - 1)) * 4;
}
const valorDe = (r: Resp, pid?: string) => { if (!pid) return ""; const v = r.itens[pid]; return v == null ? "" : String(Array.isArray(v) ? v[0] : v); };
const listaDe = (r: Resp, pid?: string) => { if (!pid) return [] as string[]; const v = r.itens[pid]; if (v == null || v === "") return []; return (Array.isArray(v) ? v : [v]).map(String).filter(Boolean); };

// ── Blocos ───────────────────────────────────────────────────────────
function Painel({ titulo, children, rodape }: { titulo: string; children: React.ReactNode; rodape?: React.ReactNode }) {
  return (
    <div style={{ ...cardBox, padding: 16, display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: "#0f3171", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 12 }}>{titulo}</div>
      <div style={{ flex: 1 }}>{children}</div>
      {rodape}
    </div>
  );
}
const Vazio = ({ msg = "Sem dados no recorte." }: { msg?: string }) =>
  <div style={{ fontSize: 12, color: "#94a3b8", padding: "18px 0", textAlign: "center" }}>{msg}</div>;

function Kpi({ titulo, valor, sub, meta, cor, icone }: { titulo: string; valor: string; sub: string; meta: string; cor: string; icone: string }) {
  return (
    <div style={cardBox}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 38, height: 38, borderRadius: 11, background: cor + "18", color: cor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>{icone}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px" }}>{titulo}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", lineHeight: 1.15 }}>{valor}</div>
        </div>
      </div>
      <div style={{ fontSize: 10.5, color: cor, fontWeight: 700, marginTop: 6 }}>{sub}</div>
      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{meta}</div>
    </div>
  );
}

const Delta = ({ v }: { v: number | null }) => {
  if (v == null) return <span style={{ color: "#cbd5e1" }}>—</span>;
  const cor = v > 0.001 ? "#16a34a" : v < -0.001 ? "#dc2626" : "#94a3b8";
  const seta = v > 0.001 ? "↑" : v < -0.001 ? "↓" : "→";
  return <span style={{ color: cor, fontWeight: 800 }}>{seta} {sinal(v)}</span>;
};

function Item({ icone, cor, texto }: { icone: string; cor: string; texto: string }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ color: cor, fontSize: 12, marginTop: 1, flexShrink: 0 }}>{icone}</span>
      <span style={{ fontSize: 12, color: "#475569", lineHeight: 1.4 }}>{texto}</span>
    </div>
  );
}

// ── Componente ───────────────────────────────────────────────────────
export default function HistoricoIndividual({ resps, pergs, mapa, planos, ultima, periodo, setor, onAbrirMapa }: {
  resps: Resp[]; pergs: Pergunta[]; mapa: Record<string, any>; planos: Plano[];
  ultima: string; periodo: string; setor: string; onAbrirMapa: () => void;
}) {
  const [quem, setQuem] = useState("");
  const [emp, setEmp] = useState<any | null>(null);
  const [buscandoEmp, setBuscandoEmp] = useState(false);

  const pAvaliado = mapa.avaliado as string | undefined;
  const dims = useMemo(() => ((mapa.dimensoes ?? []) as string[]).map(id => pergs.find(p => p.id === id)).filter(Boolean) as Pergunta[], [mapa.dimensoes, pergs]);

  // De quem é cada resposta — o sujeito do histórico.
  //   1º a pergunta "colaborador avaliado", quando o formulário tem uma;
  //   2º a pergunta de "liderança": neste feedback guiado de liderança é o
  //      líder AVALIADO que a resposta discute (as ações "fulano deverá…" são
  //      para ele), então é ele quem recebe o feedback — sem essa queda ninguém
  //      era contado e todos apareciam com (0);
  //   3º o respondente, se algum dia vier preenchido.
  const nomeEm = useMemo(() => (r: Resp) =>
    (valorDe(r, pAvaliado) || valorDe(r, mapa.lider) || r.respondente_nome || "").trim(),
    [pAvaliado, mapa.lider]);

  // Recorte da barra de filtros (período/setor) — o resto da tela é por pessoa.
  const base = useMemo(() => {
    const corte = periodo === "todos" ? null : Date.now() - Number(periodo) * 864e5;
    return resps.filter(r => {
      if (corte && +new Date(r.enviado_em) < corte) return false;
      if (setor && (r.setor ?? "") !== setor) return false;
      return true;
    });
  }, [resps, periodo, setor]);

  // Todo mundo ligado ao feedback selecionado. O SUJEITO de cada resposta
  // (nomeEm) é contado como feedback recebido; os demais citados (o outro
  // papel + respondente) aparecem sem contagem, com (0), só para o perfil.
  const pessoas = useMemo(() => {
    const m = new Map<string, { nome: string; n: number }>();
    base.forEach(r => {
      const av = nomeEm(r);
      if (av) { const k = normNome(av); const g = m.get(k) ?? { nome: av, n: 0 }; g.n++; m.set(k, g); }
      [valorDe(r, mapa.avaliado), valorDe(r, mapa.lider), r.respondente_nome ?? ""].forEach(raw => {
        const nome = String(raw).trim(); if (!nome) return;
        const k = normNome(nome); if (!m.has(k)) m.set(k, { nome, n: 0 });
      });
    });
    return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [base, nomeEm, mapa.avaliado, mapa.lider]);

  // Seleciona alguém assim que houver lista (e reajusta se o filtro tirou a pessoa).
  useEffect(() => {
    if (!pessoas.length) { if (quem) setQuem(""); return; }
    if (!quem || !pessoas.some(p => normNome(p.nome) === normNome(quem))) setQuem(pessoas[0].nome);
  }, [pessoas, quem]);

  // Respostas da pessoa, da mais antiga para a mais nova.
  const minhas = useMemo(() => base
    .filter(r => normNome(nomeEm(r)) === normNome(quem) && quem)
    .sort((a, b) => a.enviado_em.localeCompare(b.enviado_em)), [base, quem, nomeEm]);

  // Média 1..5 de UMA resposta = média das dimensões mapeadas.
  const mediaDe = useMemo(() => (r: Resp): number | null => {
    const ns = dims.map(p => nota(p, valorDe(r, p.id))).filter((x): x is number => x != null);
    return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null;
  }, [dims]);

  const notas = useMemo(() => minhas.map(r => ({ r, v: mediaDe(r) })).filter(x => x.v != null) as { r: Resp; v: number }[], [minhas, mediaDe]);

  const k = useMemo(() => {
    const vs = notas.map(x => x.v);
    const media = vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
    // Evolução = última avaliação vs. a anterior. Com uma só não há evolução —
    // e mostrar "+0,00" sugeriria estabilidade que não foi medida.
    const evol = vs.length >= 2 ? vs[vs.length - 1] - vs[vs.length - 2] : null;
    const ultimo = minhas.length ? minhas[minhas.length - 1].enviado_em : null;
    // O plano pode estar ligado à pessoa como colaborador OU como liderança
    // (neste formulário o dono do plano é o líder avaliado).
    const meus = planos.filter(p => quem && (normNome(p.colaborador ?? "") === normNome(quem) || normNome(p.lideranca ?? "") === normNome(quem)));
    const concl = meus.filter(p => p.status === "Concluído");
    const and = meus.filter(p => situacaoDe(p) === "Em andamento" || situacaoDe(p) === "Sem prazo");
    const venc = meus.filter(p => situacaoDe(p) === "Vencido / Atrasado");
    return {
      media, evol, ultimo, feedbacks: minhas.length,
      planos: meus, concl, and, venc,
      pctConcl: meus.length ? concl.length / meus.length * 100 : 0,
      diasUltimo: ultimo ? diasEntre(ultimo, hojeISO()) : null,
    };
  }, [notas, minhas, planos, quem]);

  // Evolução das avaliações: um ponto por feedback, rotulado pelo mês.
  const evolucao = useMemo(() => notas.map(x => ({ rot: mesAno(x.r.enviado_em), Média: +x.v.toFixed(2) })), [notas]);

  // Distribuição: em quantas avaliações ficou acima de 4, entre 3 e 4, abaixo de 3.
  const distrib = useMemo(() => {
    const f = (t: (v: number) => boolean) => notas.filter(x => t(x.v)).length;
    return [
      { nome: "Acima de 4,0", n: f(v => v >= 4), cor: "#16a34a" },
      { nome: "Entre 3,0 e 4,0", n: f(v => v >= 3 && v < 4), cor: "#f59e0b" },
      { nome: "Abaixo de 3,0", n: f(v => v < 3), cor: "#dc2626" },
    ];
  }, [notas]);

  // Evolução por dimensão, por trimestre (últimos 3) + variação entre o
  // primeiro e o último trimestre em que houve nota.
  const porDim = useMemo(() => {
    const tris = [...new Set(minhas.map(r => trimestre(r.enviado_em)))].slice(-3);
    return dims.map(p => {
      const cels = tris.map(t => {
        const ns = minhas.filter(r => trimestre(r.enviado_em) === t)
          .map(r => nota(p, valorDe(r, p.id))).filter((x): x is number => x != null);
        return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null;
      });
      const comNota = cels.filter((c): c is number => c != null);
      return { nome: p.titulo || "(sem título)", cels, delta: comNota.length >= 2 ? comNota[comNota.length - 1] - comNota[0] : null };
    }).filter(d => d.cels.some(c => c != null));
  }, [dims, minhas]);
  const tris = useMemo(() => [...new Set(minhas.map(r => trimestre(r.enviado_em)))].slice(-3), [minhas]);

  // Pontos fortes / de melhoria que se REPETEM: conta quantos feedbacks
  // citaram cada item. 1 citação não é recorrência, mas é o que a pessoa tem
  // quando só houve um feedback — por isso mostra a contagem junto.
  const recorrentes = (pid?: string) => {
    const cont = new Map<string, number>();
    minhas.forEach(r => listaDe(r, pid).forEach(v => cont.set(v, (cont.get(v) ?? 0) + 1)));
    return [...cont.entries()].map(([texto, n]) => ({ texto, n })).sort((a, b) => b.n - a.n || a.texto.localeCompare(b.texto));
  };
  const fortes = useMemo(() => recorrentes(mapa.fortes), [minhas, mapa.fortes]);
  const melhorias = useMemo(() => recorrentes(mapa.melhoria), [minhas, mapa.melhoria]);

  // Comparativo: a pessoa contra setor e empresa (todas as respostas do
  // formulário no recorte). "Diretoria" não existe no cadastro — não invento.
  const comparativo = useMemo(() => {
    const mediaDe_ = (rs: Resp[]) => {
      const vs = rs.map(mediaDe).filter((x): x is number => x != null);
      return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
    };
    const meuSetor = (minhas[0]?.setor ?? "").trim();
    return [
      { rot: "Média da pessoa", v: k.media, cor: "#2563eb" },
      { rot: meuSetor ? `Média do setor (${meuSetor})` : "Média do setor", v: meuSetor ? mediaDe_(base.filter(r => (r.setor ?? "").trim() === meuSetor)) : null, cor: "#94a3b8" },
      { rot: "Média geral (formulário)", v: mediaDe_(base), cor: "#94a3b8" },
    ];
  }, [k.media, minhas, base, mediaDe]);

  // Linha do tempo: feedbacks + marcos dos planos, do mais novo para o mais velho.
  const timeline = useMemo(() => {
    const ev: { data: string; tipo: string; titulo: string; sub: string; chip: string; cor: string }[] = [];
    notas.forEach(x => ev.push({
      data: x.r.enviado_em.slice(0, 10), tipo: "feedback", titulo: "Feedback realizado",
      sub: `Avaliação referente ao ${trimestre(x.r.enviado_em)}`, chip: `Média: ${n2(x.v)}`, cor: "#2563eb",
    }));
    k.planos.forEach(p => {
      ev.push({
        data: p.created_at.slice(0, 10), tipo: "plano", titulo: "Plano de ação definido",
        sub: p.acao, chip: situacaoDe(p), cor: "#7c3aed",
      });
      if (p.concluido_em) ev.push({
        data: p.concluido_em, tipo: "plano", titulo: "Plano de ação concluído",
        sub: p.acao, chip: "Concluído", cor: "#16a34a",
      });
    });
    return ev.sort((a, b) => b.data.localeCompare(a.data));
  }, [notas, k.planos]);

  // Ficha do cadastro (cargo, admissão, situação). Degrada em silêncio: sem
  // vínculo com EMPREGADOS a tela continua útil, só sem esses campos.
  useEffect(() => {
    let cancel = false;
    if (!quem) { setEmp(null); return; }
    setBuscandoEmp(true);
    (async () => {
      try {
        let { data } = await (supabase as any).from("EMPREGADOS").select("*").ilike("Nome", quem).limit(20);
        if (!data?.length) ({ data } = await (supabase as any).from("EMPREGADOS").select("*").ilike("Nome", `%${quem}%`).limit(20));
        const arr: any[] = data ?? [];
        const exato = arr.find(e => normNome(e["Nome"]) === normNome(quem));
        if (!cancel) setEmp(exato ?? arr[0] ?? null);
      } catch { if (!cancel) setEmp(null); }
      if (!cancel) setBuscandoEmp(false);
    })();
    return () => { cancel = true; };
  }, [quem]);

  const exportar = () => {
    const esc = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const L: any[][] = [["Bloco", "Item", "Valor"]];
    L.push(["Resumo", "Colaborador", quem]);
    L.push(["Resumo", "Média geral", k.media != null ? n2(k.media) : "—"]);
    L.push(["Resumo", "Evolução (última vs anterior)", k.evol != null ? sinal(k.evol) : "—"]);
    L.push(["Resumo", "Feedbacks no período", k.feedbacks]);
    L.push(["Resumo", "Planos de ação", `${k.planos.length} (${k.concl.length} concluídos)`]);
    notas.forEach(x => L.push(["Avaliação", fmtD(x.r.enviado_em), n2(x.v)]));
    porDim.forEach(d => L.push(["Dimensão", d.nome, d.cels.map(c => c == null ? "—" : n2(c)).join(" | ")]));
    fortes.forEach(f => L.push(["Ponto forte", f.texto, `${f.n}x`]));
    melhorias.forEach(f => L.push(["Ponto de melhoria", f.texto, `${f.n}x`]));
    k.planos.forEach(p => L.push(["Plano de ação", p.acao, `${situacaoDe(p)} — prazo ${fmtD(p.prazo)}`]));
    const csv = "﻿" + L.map(l => l.map(esc).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `historico-${normNome(quem).replace(/\s+/g, "-") || "colaborador"}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  // ── Guardas ────────────────────────────────────────────────────────
  if (!pAvaliado && !pessoas.length) {
    return (
      <div style={{ ...cardBox, padding: 44, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>Aponte quem é o colaborador avaliado</div>
        <div style={{ fontSize: 12.5, color: "#64748b", maxWidth: 560, margin: "0 auto 14px", lineHeight: 1.5 }}>
          O histórico é a trajetória de uma pessoa. Diga qual pergunta do formulário guarda
          o <b>colaborador avaliado</b> — quem preenche o feedback é o líder, então o nome de quem
          foi avaliado está numa pergunta, não no respondente.
        </div>
        <button onClick={onAbrirMapa} style={btn("#0f3171")}>⚙ Mapear perguntas</button>
      </div>
    );
  }
  if (!dims.length) {
    return (
      <div style={{ ...cardBox, padding: 44, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>Faltam as dimensões avaliadas</div>
        <div style={{ fontSize: 12.5, color: "#64748b", maxWidth: 560, margin: "0 auto 14px", lineHeight: 1.5 }}>
          A média 1–5 sai das <b>dimensões</b> (escalas ou perguntas de opção) apontadas no mapeamento.
          Sem elas não há nota para acompanhar ao longo do tempo.
        </div>
        <button onClick={onAbrirMapa} style={btn("#0f3171")}>⚙ Mapear dimensões</button>
      </div>
    );
  }
  if (!pessoas.length) return <div style={{ ...cardBox, padding: 44, textAlign: "center", color: "#64748b", fontSize: 12.5 }}>Ninguém participou deste feedback no recorte atual.</div>;

  const semFeedback = minhas.length === 0;              // colaborador do cadastro, ainda sem feedback
  const semNota = !semFeedback && notas.length === 0;   // tem feedback, mas nenhuma dimensão respondida

  return (
    <>
      <style>{CSS_HI}</style>

      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 21, fontWeight: 800, color: "#0f172a" }}>HISTÓRICO INDIVIDUAL</div>
          <div style={{ fontSize: 12.5, color: "#64748b" }}>Acompanhe a evolução profissional do colaborador ao longo do tempo.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ minWidth: 210 }}>
            <label style={lbl}>Colaborador</label>
            <select value={quem} onChange={e => setQuem(e.target.value)} style={inp}>
              {pessoas.map(p => <option key={p.nome} value={p.nome}>{p.nome} ({p.n})</option>)}
            </select>
          </div>
          <div style={{ fontSize: 10.5, color: "#94a3b8", textAlign: "right", lineHeight: 1.4 }}>Última atualização<br /><b style={{ color: "#475569" }}>{ultima}</b></div>
          <button onClick={exportar} style={btn("#fff", "#0f3171", "1px solid #0f3171")}>⬇ Exportar relatório</button>
        </div>
      </div>

      {/* Ficha + KPIs */}
      <div className="hi-grid5" style={{ marginBottom: 14 }}>
        <div style={{ ...cardBox, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ width: 46, height: 46, borderRadius: "50%", background: "#0f3171", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, flexShrink: 0 }}>
            {quem.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join("").toUpperCase()}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis" }} title={quem}>{quem}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
              {buscandoEmp ? "Buscando no cadastro…" : (emp?.["Nome do Cargo"] || emp?.["Cargo"] || "Cargo não localizado")}
            </div>
            <div style={{ fontSize: 10.5, color: "#94a3b8", lineHeight: 1.6 }}>
              <div>Setor: <b style={{ color: "#475569" }}>{emp?.["Setor"] || minhas[0]?.setor || "—"}</b></div>
              {/* LIDER é o nível da própria pessoa (GERENTE, DIREÇÃO…), não o
                  nome do líder dela — rotular como "Liderança" dizia o oposto. */}
              {emp?.["LIDER"] && <div>Nível: <b style={{ color: "#475569" }}>{emp["LIDER"]}</b></div>}
              {emp?.["Admissão"] && <div>Admissão: <b style={{ color: "#475569" }}>{emp["Admissão"]}</b></div>}
              {emp?.["Situação"] && <div>Situação: <b style={{ color: "#475569" }}>{emp["Situação"]}</b></div>}
            </div>
          </div>
        </div>

        <Kpi titulo="Média geral" valor={k.media != null ? `${n2(k.media)} / 5` : "—"} cor="#2563eb" icone="⭐"
          sub={k.evol != null ? `${sinal(k.evol)} vs. avaliação anterior` : "Sem comparação ainda"}
          meta={`Meta: ${n2(META.media)}`} />
        <Kpi titulo="Evolução da média" valor={k.evol != null ? sinal(k.evol) : "—"} cor={k.evol == null ? "#94a3b8" : k.evol >= 0 ? "#16a34a" : "#dc2626"} icone="📈"
          sub={k.evol != null ? "Última vs. anterior" : "Precisa de 2 feedbacks"}
          meta={`Meta: ${sinal(META.evolucao)}`} />
        <Kpi titulo="Feedbacks recebidos" valor={nInt(k.feedbacks)} cor="#7c3aed" icone="🎯"
          sub="No período filtrado" meta={`Meta: ${META.feedbacks}`} />
        <Kpi titulo="Planos de ação" valor={nInt(k.planos.length)} cor="#f59e0b" icone="📋"
          sub={`${k.concl.length} concluídos · ${k.and.length} em andamento${k.venc.length ? ` · ${k.venc.length} vencidos` : ""}`}
          meta={`Meta: ${META.planosPct}% concluídos`} />
      </div>

      {semFeedback && (
        <div style={{ ...cardBox, borderColor: "#dbeafe", background: "#f0f7ff", marginBottom: 14, fontSize: 12, color: "#1e3a8a", lineHeight: 1.5 }}>
          <b style={{ color: "#0f172a" }}>Este colaborador ainda não recebeu feedbacks.</b> O perfil aparece acima;
          média, evolução, avaliações e planos preenchem assim que houver avaliações no formulário selecionado.
        </div>
      )}
      {semNota && (
        <div style={{ ...cardBox, borderColor: "#fed7aa", background: "#fffbeb", marginBottom: 14, fontSize: 12, color: "#78350f", lineHeight: 1.5 }}>
          <b style={{ color: "#0f172a" }}>Sem nota nas avaliações desta pessoa.</b> Os {nInt(minhas.length)} feedbacks existem, mas nenhuma
          das dimensões mapeadas foi respondida neles — por isso média, evolução e distribuição aparecem vazias.
        </div>
      )}

      {/* Evolução + linha do tempo + distribuição */}
      <div className="hi-grid3" style={{ marginBottom: 14 }}>
        <Painel titulo="Evolução das avaliações">
          {evolucao.length === 0 ? <Vazio /> : (
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={evolucao} margin={{ top: 18, right: 14, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="rot" tick={{ fontSize: 10 }} />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => [n2(Number(v)), "Média"]} />
                <Line type="monotone" dataKey="Média" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3.5 }}>
                  <LabelList dataKey="Média" position="top" formatter={(v: any) => n2(Number(v))} style={{ fontSize: 9.5, fill: "#475569" }} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          )}
        </Painel>

        <Painel titulo="Linha do tempo">
          {timeline.length === 0 ? <Vazio /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 232, overflowY: "auto" }}>
              {timeline.slice(0, 12).map((e, i) => (
                <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <span style={{ width: 22, height: 22, borderRadius: 7, background: e.cor + "18", color: e.cor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>
                    {e.tipo === "feedback" ? "★" : "◉"}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>{fmtD(e.data)}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: "#0f172a" }}>{e.titulo}</div>
                    <div style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.sub}>{e.sub}</div>
                  </div>
                  <span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 7px", borderRadius: 20, background: e.cor + "1a", color: e.cor, whiteSpace: "nowrap", flexShrink: 0 }}>{e.chip}</span>
                </div>
              ))}
            </div>
          )}
        </Painel>

        <Painel titulo="Distribuição das avaliações">
          {notas.length === 0 ? <Vazio /> : (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ position: "relative", width: 160, height: 160, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={distrib.filter(d => d.n > 0)} dataKey="n" nameKey="nome" innerRadius={48} outerRadius={74} paddingAngle={2} stroke="none">
                      {distrib.filter(d => d.n > 0).map(d => <Cell key={d.nome} fill={d.cor} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>{nInt(notas.length)}</div>
                  <div style={{ fontSize: 9.5, color: "#94a3b8", fontWeight: 700 }}>Avaliações</div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 120, display: "flex", flexDirection: "column", gap: 9 }}>
                {distrib.map(d => (
                  <div key={d.nome} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: d.cor, marginTop: 4, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 11.5, color: "#475569" }}>{d.nome}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>
                        {notas.length ? Math.round(d.n / notas.length * 100) : 0}% <span style={{ color: "#94a3b8", fontWeight: 700 }}>({d.n})</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Painel>
      </div>

      {/* Dimensões, fortes, melhorias, planos, comparativo */}
      <div className="hi-grid5" style={{ marginBottom: 14 }}>
        <Painel titulo="Evolução por dimensão">
          {porDim.length === 0 ? <Vazio /> : (
            <table className="hi-tab">
              <colgroup><col /><col style={{ width: 42 }} /><col style={{ width: 42 }} /><col style={{ width: 42 }} /><col style={{ width: 50 }} /></colgroup>
              <thead><tr>
                <th style={th}>Dimensão</th>
                {[0, 1, 2].map(i => <th key={i} style={{ ...th, textAlign: "center" }}>{tris[i] ?? "—"}</th>)}
                <th style={{ ...th, textAlign: "right" }}>Evol.</th>
              </tr></thead>
              <tbody>
                {porDim.map(d => (
                  <tr key={d.nome}>
                    <td style={td}><div title={d.nome}>{d.nome}</div></td>
                    {[0, 1, 2].map(i => <td key={i} style={{ ...td, textAlign: "center" }}>{d.cels[i] == null ? "—" : n2(d.cels[i]!)}</td>)}
                    <td style={{ ...td, textAlign: "right", fontSize: 10.5 }}><Delta v={d.delta} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Painel>

        <Painel titulo="Pontos fortes (recorrentes)">
          {fortes.length === 0 ? <Vazio msg={mapa.fortes ? "Nenhum ponto forte citado." : "Pergunta de pontos fortes não mapeada."} /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {fortes.slice(0, 6).map(f => (
                <Item key={f.texto} icone="✓" cor="#16a34a" texto={f.n > 1 ? `${f.texto} (${f.n}x)` : f.texto} />
              ))}
            </div>
          )}
        </Painel>

        <Painel titulo="Pontos de melhoria (recorrentes)">
          {melhorias.length === 0 ? <Vazio msg={mapa.melhoria ? "Nenhum ponto de melhoria citado." : "Pergunta de melhoria não mapeada."} /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {melhorias.slice(0, 6).map(f => (
                <Item key={f.texto} icone="⚠" cor="#f59e0b" texto={f.n > 1 ? `${f.texto} (${f.n}x)` : f.texto} />
              ))}
            </div>
          )}
        </Painel>

        <Painel titulo="Planos de ação">
          {k.planos.length === 0 ? <Vazio msg="Nenhum plano para esta pessoa." /> : (
            <table className="hi-tab">
              <colgroup><col /><col style={{ width: 74 }} /><col style={{ width: 66 }} /></colgroup>
              <thead><tr><th style={th}>Plano</th><th style={th}>Situação</th><th style={{ ...th, textAlign: "right" }}>Prazo</th></tr></thead>
              <tbody>
                {k.planos.slice(0, 6).map(p => {
                  const s = situacaoDe(p);
                  const cor = s.startsWith("Concluído") ? "#16a34a" : s === "Vencido / Atrasado" ? "#dc2626" : s === "Sem prazo" ? "#a855f7" : "#f59e0b";
                  return (
                    <tr key={p.id}>
                      <td style={td}><div title={p.acao}>{p.acao}</div></td>
                      <td style={td}><span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 6px", borderRadius: 20, background: cor + "1a", color: cor, whiteSpace: "nowrap" }}>{s.replace(" / Atrasado", "")}</span></td>
                      <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{fmtD(p.prazo)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Painel>

        <Painel titulo="Comparativo">
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {comparativo.map(c => (
              <div key={c.rot}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4, gap: 8 }}>
                  <span style={{ color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.rot}>{c.rot}</span>
                  <b style={{ color: "#0f172a", flexShrink: 0 }}>{c.v == null ? "—" : n2(c.v)}</b>
                </div>
                <div style={{ height: 9, background: "#eef2f7", borderRadius: 20, overflow: "hidden" }}>
                  <div style={{ width: `${((c.v ?? 0) / 5) * 100}%`, height: "100%", background: c.cor, borderRadius: 20 }} />
                </div>
              </div>
            ))}
            <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.4 }}>
              ⓘ Escala 1–5. “Diretoria” não existe no cadastro, então a comparação vai até o setor e o formulário todo.
            </div>
          </div>
        </Painel>
      </div>

      {/* Insights */}
      <div style={{ ...cardBox, padding: 16 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: "#0f3171", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 12 }}>Insights automáticos</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14 }}>
          {[
            k.evol != null && { i: "📈", c: k.evol >= 0 ? "#16a34a" : "#dc2626", t: `${quem.split(" ")[0]} ${k.evol >= 0 ? "evoluiu" : "recuou"} ${sinal(k.evol)} na média entre as duas últimas avaliações.` },
            notas.length > 0 && { i: "⭐", c: "#f59e0b", t: `${Math.round(distrib[0].n / notas.length * 100)}% das avaliações estão acima de 4,0.` },
            k.and.length > 0 && { i: "🎯", c: "#7c3aed", t: `${k.and.length} plano(s) de ação em andamento — acompanhar prazos para conclusão.` },
            k.venc.length > 0 && { i: "🔔", c: "#dc2626", t: `${k.venc.length} plano(s) de ação vencido(s) exigem atenção imediata.` },
            k.media != null && comparativo[1].v != null && { i: "👥", c: "#2563eb", t: `Comparada ao setor, está ${n2(Math.abs(k.media - comparativo[1].v!))} ponto(s) ${k.media >= comparativo[1].v! ? "acima" : "abaixo"} da média.` },
            melhorias[0] && { i: "📌", c: "#f59e0b", t: `Ponto de atenção: “${melhorias[0].texto}” é o tema mais recorrente de melhoria.` },
            k.diasUltimo != null && { i: "🗓", c: k.diasUltimo > META.diasUltimo ? "#dc2626" : "#16a34a", t: `Último feedback há ${k.diasUltimo} dia(s) — meta de no máximo ${META.diasUltimo}.` },
          ].filter(Boolean).slice(0, 5).map((x: any, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: x.c + "18", color: x.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{x.i}</span>
              <span style={{ fontSize: 11.5, color: "#475569", lineHeight: 1.45 }}>{x.t}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 12, lineHeight: 1.5 }}>
        ⓘ Os indicadores são baseados nas respostas dos feedbacks e têm caráter de apoio à gestão,
        não devendo ser usados isoladamente para decisões de promoção, punição ou desligamento.
      </div>
    </>
  );
}
