import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { NIVEIS, rankNivel, ehNivel, normSetor, ehSetorReal, ehAtivoSit, carregaHierarquiaDados, msgErroGravacao } from "@/pages/central-servicos/LideresSetor";

// =====================================================================
// RH — HIERARQUIA
//
// Dois eixos, nenhum digitado à mão:
//   • Administrativo (por SETOR): ordem pelo nível em EMPREGADOS.LIDER
//     (GERENTE › COORDENADOR › SUPERVISOR …); staff sem nível entra por cargo.
//   • Operacional (por CONTRATO): "Descrição do Local" é o contrato a que o
//     colaborador pertence. Cada contrato tem um ENCARREGADO, e toda a equipe
//     daquele contrato fica sob ele. Quem é o encarregado de cada contrato é
//     configurado aqui (RH_CONTRATO_ENCARREGADO); sem config, sugere-se o
//     membro com nível ENCARREGADO.
// =====================================================================

interface EmpH { id: number; nome: string; setor: string; nivel: string; cargo: string; local: string; situacao: string }
interface Assign { encarregado_id: number; encarregado_nome: string; obs?: string | null }

const RANK_ENC = rankNivel("ENCARREGADO");
const semAcento = (s: string) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
const normLocal = (s: string | null | undefined) => normSetor(s);
const nInt = (n: number) => n.toLocaleString("pt-BR");
const dominante = (xs: string[]) => {
  const c = new Map<string, number>(); xs.forEach(x => c.set(x, (c.get(x) ?? 0) + 1));
  let melhor = "", n = 0; c.forEach((v, k) => { if (v > n) { n = v; melhor = k; } }); return melhor;
};

// Lê pela RPC paginada rh_hierarquia_dados (ver carregaHierarquiaDados): a
// EmpH é a própria linha da RPC. O HierRow já traz exatamente estes campos.
const carregaEmps = carregaHierarquiaDados;

// ── estilos ──────────────────────────────────────────────────────────
const btn = (bg: string, c = "#fff", border = "none"): React.CSSProperties =>
  ({ padding: "7px 13px", borderRadius: 9, border, background: bg, color: c, fontSize: 12.5, fontWeight: 700, cursor: "pointer" });
const inp: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 9, padding: "8px 10px", fontSize: 13, outline: "none", background: "#fff", width: "100%", color: "#0f172a", boxSizing: "border-box" };
const cardBox: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", boxShadow: "0 8px 24px rgba(15,23,42,.05)" };
const th: React.CSSProperties = { padding: "8px 8px", fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".4px", color: "#94a3b8", textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid #eef2f7" };
const td: React.CSSProperties = { padding: "9px 8px", fontSize: 12, color: "#475569", borderTop: "1px solid #f5f7fb", verticalAlign: "middle" };

function Chip({ texto, cor }: { texto: string; cor: string }) {
  return <span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: cor + "1a", color: cor, whiteSpace: "nowrap" }}>{texto}</span>;
}
function Kpi({ titulo, valor, cor, sub }: { titulo: string; valor: string; cor: string; sub: string }) {
  return (
    <div style={cardBox}>
      <div style={{ fontSize: 9.5, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px" }}>{titulo}</div>
      <div style={{ fontSize: 25, fontWeight: 800, color: "#0f172a", lineHeight: 1.2 }}>{valor}</div>
      <div style={{ fontSize: 10.5, color: cor, fontWeight: 700 }}>{sub}</div>
    </div>
  );
}
const corNivel = (nivel: string) => rankNivel(nivel) <= rankNivel("DIRETOR") && ehNivel(nivel) ? "#7c3aed"
  : rankNivel(nivel) === rankNivel("GERENTE") ? "#2563eb"
  : rankNivel(nivel) === RANK_ENC ? "#0891b2" : "#0f3171";

// ── Modal: designar o encarregado de um contrato ─────────────────────
function ModalEncarregado({ contrato, emps, onFechar, onSalvo }: {
  contrato: Contrato; emps: EmpH[]; onFechar: () => void; onSalvo: () => void | Promise<void>;
}) {
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<number | null>(contrato.encarregado?.id ?? null);
  const [obs, setObs] = useState(contrato.obs ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // A equipe do contrato vem primeiro; a busca alcança o resto (encarregado de
  // fora acontece). Dentro da equipe, quem tem nível ENCARREGADO no topo.
  const lista = useMemo(() => {
    const q = semAcento(busca);
    const daEquipe = new Set(contrato.membros.map(m => m.id));
    const base = q ? emps.filter(e => semAcento(e.nome).includes(q)) : contrato.membros;
    return [...base].sort((a, b) =>
      (daEquipe.has(a.id) ? 0 : 1) - (daEquipe.has(b.id) ? 0 : 1) ||
      (rankNivel(a.nivel) < 0 ? 99 : rankNivel(a.nivel)) - (rankNivel(b.nivel) < 0 ? 99 : rankNivel(b.nivel)) ||
      a.nome.localeCompare(b.nome, "pt-BR")
    ).slice(0, 60);
  }, [busca, emps, contrato]);

  const salvar = async () => {
    if (sel == null) { setErro("Escolha uma pessoa."); return; }
    setSalvando(true); setErro(null);
    try {
      const p = emps.find(e => e.id === sel);
      const { error } = await (supabase as any).from("RH_CONTRATO_ENCARREGADO")
        .upsert({ contrato: contrato.display, encarregado_id: sel, encarregado_nome: p?.nome ?? null, setor: contrato.setor || null, observacao: obs.trim() || null }, { onConflict: "contrato" });
      if (error) throw error;
      await onSalvo();
      onFechar();
    } catch (e: any) {
      console.error("Designar encarregado falhou:", e);
      setErro(msgErroGravacao(e, "RH_CONTRATO_ENCARREGADO", "20260722000001"));
    } finally { setSalvando(false); }
  };
  const limpar = async () => {
    if (!confirm("Voltar este contrato para o encarregado automático (nível do cadastro)?")) return;
    setSalvando(true);
    try {
      const { error } = await (supabase as any).from("RH_CONTRATO_ENCARREGADO").delete().eq("contrato", contrato.display);
      if (error) throw error;
      await onSalvo();
      onFechar();
    } catch (e: any) {
      console.error("Limpar designação falhou:", e);
      setErro(msgErroGravacao(e, "RH_CONTRATO_ENCARREGADO", "20260722000001"));
    } finally { setSalvando(false); }
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onFechar(); }}
      style={{ position: "fixed", inset: 0, zIndex: 950, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: 580, maxWidth: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px 12px", borderBottom: "1px solid #eef2f7" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0f3171" }}>Encarregado de {contrato.display}</div>
          <div style={{ fontSize: 11.5, color: "#94a3b8" }}>
            {nInt(contrato.ativos.length)} colaborador(es) ativos neste contrato ficam sob o encarregado escolhido.
          </div>
        </div>
        <div style={{ padding: "12px 22px 0" }}>
          {erro && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 9, padding: "8px 11px", fontSize: 12, marginBottom: 10 }}>{erro}</div>}
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome…" style={inp} autoFocus />
        </div>
        <div style={{ padding: "10px 22px", overflowY: "auto", flex: 1 }}>
          {lista.length === 0 ? <div style={{ fontSize: 12, color: "#94a3b8", padding: "16px 0", textAlign: "center" }}>Ninguém encontrado.</div> : lista.map(e => (
            <div key={e.id} onClick={() => setSel(e.id)}
              style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 9, cursor: "pointer", marginBottom: 4, background: sel === e.id ? "#eef4ff" : "transparent", border: sel === e.id ? "1px solid #c7d2fe" : "1px solid transparent" }}>
              <span style={{ width: 15, height: 15, borderRadius: "50%", border: sel === e.id ? "5px solid #0f3171" : "2px solid #cbd5e1", flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.nome}</div>
                <div style={{ fontSize: 10.5, color: "#94a3b8" }}>{e.cargo || "—"} · {e.setor || "sem setor"}{!ehAtivoSit(e.situacao) && " · inativo"}</div>
              </div>
              {ehNivel(e.nivel) && <Chip texto={e.nivel} cor={corNivel(e.nivel)} />}
            </div>
          ))}
        </div>
        <div style={{ padding: "10px 22px 0" }}>
          <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Observação (opcional)" style={inp} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "12px 22px" }}>
          {contrato.encarregado?.origem === "manual"
            ? <button onClick={limpar} disabled={salvando} style={{ background: "none", border: "none", color: "#dc2626", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Limpar designação</button>
            : <span />}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onFechar} style={btn("#fff", "#475569", "1px solid #e2e8f0")}>Cancelar</button>
            <button onClick={salvar} disabled={salvando} style={btn("#0f3171")}>{salvando ? "Salvando…" : "Designar encarregado"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface Encarregado { id: number; nome: string; origem: "manual" | "auto" }
interface Contrato {
  norm: string; display: string; membros: EmpH[]; ativos: EmpH[]; setor: string;
  encarregado: Encarregado | null; encAutoCount: number; obs?: string | null;
}

// ── Tela ─────────────────────────────────────────────────────────────
export default function Hierarquia() {
  const nav = useNavigate();
  const [emps, setEmps] = useState<EmpH[]>([]);
  const [assigns, setAssigns] = useState<Map<string, Assign>>(new Map());
  const [setorDiretor, setSetorDiretor] = useState<Map<string, { id: number; nome: string }>>(new Map()); // setor(norm) → diretor
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<"contratos" | "setores">("contratos");
  const [busca, setBusca] = useState("");
  const [soPendentes, setSoPendentes] = useState(false);
  const [editando, setEditando] = useState<Contrato | null>(null);
  const [aberto, setAberto] = useState<Set<string>>(new Set());

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try {
      const [lista, aRes, dRes] = await Promise.all([
        carregaEmps(),
        (supabase as any).from("RH_CONTRATO_ENCARREGADO").select("*"),
        (supabase as any).from("RH_SETOR_DIRETOR").select("*"),
      ]);
      setEmps(lista);
      const m = new Map<string, Assign>();
      (aRes.data ?? []).forEach((r: any) => m.set(normLocal(r.contrato), { encarregado_id: Number(r.encarregado_id), encarregado_nome: r.encarregado_nome, obs: r.observacao }));
      setAssigns(m);
      const d = new Map<string, { id: number; nome: string }>();
      (dRes.data ?? []).forEach((r: any) => d.set(normSetor(r.setor), { id: Number(r.diretor_id), nome: r.diretor_nome ?? "" }));
      setSetorDiretor(d);
    } catch (e: any) { setErro(e?.message ?? String(e)); }
    setCarregando(false);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  // Recarrega SÓ as designações (tabela pequena). Designar um encarregado não
  // muda o cadastro; re-ler todos os EMPREGADOS (paginado, lento) a cada salvar
  // travaria a tela em "Carregando".
  const recarregarAssigns = useCallback(async () => {
    const { data } = await (supabase as any).from("RH_CONTRATO_ENCARREGADO").select("*");
    const m = new Map<string, Assign>();
    (data ?? []).forEach((r: any) => m.set(normLocal(r.contrato), { encarregado_id: Number(r.encarregado_id), encarregado_nome: r.encarregado_nome, obs: r.observacao }));
    setAssigns(m);
  }, []);

  const recarregarDiretores = useCallback(async () => {
    const { data } = await (supabase as any).from("RH_SETOR_DIRETOR").select("*");
    const d = new Map<string, { id: number; nome: string }>();
    (data ?? []).forEach((r: any) => d.set(normSetor(r.setor), { id: Number(r.diretor_id), nome: r.diretor_nome ?? "" }));
    setSetorDiretor(d);
  }, []);

  // Diretores elegíveis: nível DIREÇÃO … DIRETOR (acima ficam CEO/ADMIN, que
  // veem tudo; abaixo ficam gerentes, que lideram setor).
  const R_DIR_TOP = rankNivel("DIREÇÃO"), R_DIR_BOT = rankNivel("DIRETOR");
  const diretores = useMemo(() => emps
    .filter(e => ehAtivoSit(e.situacao) && rankNivel(e.nivel) >= R_DIR_TOP && rankNivel(e.nivel) <= R_DIR_BOT)
    .sort((a, b) => rankNivel(a.nivel) - rankNivel(b.nivel) || a.nome.localeCompare(b.nome, "pt-BR")), [emps]);

  // Grava/limpa o diretor de um setor.
  const definirDiretor = async (setor: string, diretorId: number | null) => {
    try {
      if (!diretorId) {
        const { error } = await (supabase as any).from("RH_SETOR_DIRETOR").delete().eq("setor", setor);
        if (error) throw error;
      } else {
        const d = diretores.find(x => x.id === diretorId);
        const { error } = await (supabase as any).from("RH_SETOR_DIRETOR")
          .upsert({ setor, diretor_id: diretorId, diretor_nome: d?.nome ?? null }, { onConflict: "setor" });
        if (error) throw error;
      }
      await recarregarDiretores();
    } catch (e: any) { alert(msgErroGravacao(e, "RH_SETOR_DIRETOR", "20260723000001")); }
  };

  // Contratos = valores distintos de "Descrição do Local", com equipe e encarregado.
  const contratos = useMemo<Contrato[]>(() => {
    const byLocal = new Map<string, EmpH[]>();
    emps.forEach(e => { if (!e.local) return; const k = normLocal(e.local); const arr = byLocal.get(k); if (arr) arr.push(e); else byLocal.set(k, [e]); });
    return [...byLocal.entries()].map(([norm, membros]) => {
      const ativos = membros.filter(m => ehAtivoSit(m.situacao));
      const setor = dominante(membros.map(m => m.setor).filter(Boolean));
      const encAuto = ativos.filter(m => rankNivel(m.nivel) === RANK_ENC);
      const assign = assigns.get(norm);
      const encarregado: Encarregado | null = assign
        ? { id: assign.encarregado_id, nome: assign.encarregado_nome || (emps.find(e => e.id === assign.encarregado_id)?.nome ?? "—"), origem: "manual" }
        : encAuto.length === 1 ? { id: encAuto[0].id, nome: encAuto[0].nome, origem: "auto" } : null;
      return { norm, display: membros[0].local, membros, ativos, setor, encarregado, encAutoCount: encAuto.length, obs: assign?.obs };
    }).sort((a, b) => a.display.localeCompare(b.display, "pt-BR"));
  }, [emps, assigns]);

  // Setores = árvore por nível.
  const setores = useMemo(() => {
    const bySetor = new Map<string, EmpH[]>();
    emps.forEach(e => { if (!ehSetorReal(e.setor)) return; const arr = bySetor.get(e.setor); if (arr) arr.push(e); else bySetor.set(e.setor, [e]); });
    return [...bySetor.entries()].map(([setor, membros]) => {
      const ativos = membros.filter(m => ehAtivoSit(m.situacao));
      const lideres = ativos.filter(m => ehNivel(m.nivel)).sort((a, b) => rankNivel(a.nivel) - rankNivel(b.nivel) || a.nome.localeCompare(b.nome, "pt-BR"));
      const staff = ativos.filter(m => !ehNivel(m.nivel));
      const contratosDoSetor = [...new Set(ativos.map(m => m.local).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
      return { setor, ativos, lideres, staff, contratos: contratosDoSetor };
    }).sort((a, b) => b.ativos.length - a.ativos.length || a.setor.localeCompare(b.setor, "pt-BR"));
  }, [emps]);

  // Quantos setores cada diretor cuida (+ quantos sem diretor).
  const resumoDiretores = useMemo(() => {
    const cont = new Map<number, { nome: string; n: number }>();
    let sem = 0;
    setores.forEach(s => {
      const d = setorDiretor.get(normSetor(s.setor));
      if (!d) { sem++; return; }
      const g = cont.get(d.id) ?? { nome: d.nome, n: 0 }; g.n++; cont.set(d.id, g);
    });
    return { porDiretor: [...cont.values()].sort((a, b) => b.n - a.n), sem };
  }, [setores, setorDiretor]);

  const kpi = useMemo(() => {
    const total = contratos.length;
    const com = contratos.filter(c => c.encarregado).length;
    const cobertos = contratos.filter(c => c.encarregado).reduce((s, c) => s + c.ativos.length, 0);
    const semEnc = contratos.filter(c => !c.encarregado);
    return { total, com, sem: total - com, cobertos, pendentesEmpate: semEnc.filter(c => c.encAutoCount > 1).length };
  }, [contratos]);

  const vis = useMemo(() => {
    const q = semAcento(busca);
    return contratos.filter(c =>
      (!q || semAcento(c.display).includes(q) || semAcento(c.encarregado?.nome ?? "").includes(q) || semAcento(c.setor).includes(q)) &&
      (!soPendentes || !c.encarregado));
  }, [contratos, busca, soPendentes]);

  const toggle = (k: string) => setAberto(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const exportar = () => {
    const esc = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const L = [["Contrato", "Setor", "Encarregado", "Origem", "Equipe (ativos)", "Observação"]];
    contratos.forEach(c => L.push([c.display, c.setor, c.encarregado?.nome ?? "", c.encarregado ? (c.encarregado.origem === "manual" ? "Designado" : "Automático") : (c.encAutoCount > 1 ? "Empate" : "Sem encarregado"), String(c.ativos.length), c.obs ?? ""]));
    const csv = "﻿" + L.map(l => l.map(esc).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "hierarquia-contratos.csv"; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f7fb" }}>
      <div style={{ margin: "18px 24px 0", padding: "16px 22px", border: "1px solid #e2e8f0", borderRadius: 18, background: "linear-gradient(135deg,#fff 0%,#f8fbff 100%)", boxShadow: "0 8px 24px rgba(15,23,42,.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => nav("/app/rh/colaboradores")} style={btn("#fff", "#475569", "1px solid #e2e8f0")}>← Voltar</button>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: "#0f3171" }}>🏢 Hierarquia</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
              Estrutura da empresa por setor (nível) e por contrato (encarregado + equipe).
            </div>
          </div>
        </div>
        <button onClick={exportar} style={btn("#fff", "#0f3171", "1px solid #0f3171")}>⬇ Exportar</button>
      </div>

      <div style={{ display: "flex", gap: 4, padding: "10px 24px 0", flexShrink: 0 }}>
        {([["contratos", "Contratos & Encarregados"], ["setores", "Setores"]] as const).map(([k, lab]) => (
          <button key={k} onClick={() => setAba(k)} style={{ padding: "9px 16px", border: "none", background: "none", cursor: "pointer", fontSize: 12.5, fontWeight: aba === k ? 800 : 600, color: aba === k ? "#0f3171" : "#94a3b8", borderBottom: aba === k ? "3px solid #0f3171" : "3px solid transparent" }}>{lab}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 40px" }}>
        {carregando ? <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>Carregando cadastro…</div>
        : erro ? (
          <div style={{ ...cardBox, padding: 36, textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>Não deu para carregar</div>
            <div style={{ fontSize: 12.5, color: "#64748b", maxWidth: 560, margin: "0 auto" }}>
              {/RH_CONTRATO_ENCARREGADO|does not exist|schema cache/i.test(erro)
                ? <>Falta aplicar a migration <code>20260722000001_rh_hierarquia.sql</code> no banco do app.</>
                : erro}
            </div>
          </div>
        ) : aba === "contratos" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 16 }}>
              <Kpi titulo="Contratos" valor={nInt(kpi.total)} cor="#2563eb" sub="Locais distintos no cadastro" />
              <Kpi titulo="Com encarregado" valor={nInt(kpi.com)} cor="#16a34a" sub={`${kpi.total ? Math.round(kpi.com / kpi.total * 100) : 0}% dos contratos`} />
              <Kpi titulo="Sem encarregado" valor={nInt(kpi.sem)} cor="#dc2626" sub="Precisam de designação" />
              <Kpi titulo="Colaboradores cobertos" valor={nInt(kpi.cobertos)} cor="#7c3aed" sub="Sob um encarregado definido" />
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar contrato, encarregado ou setor…" style={inp} />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569", cursor: "pointer" }}>
                <input type="checkbox" checked={soPendentes} onChange={e => setSoPendentes(e.target.checked)} />
                Só contratos sem encarregado
              </label>
            </div>

            <div style={{ ...cardBox, padding: 0, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    <th style={{ ...th, paddingLeft: 16, width: 26 }}></th>
                    <th style={th}>Contrato</th><th style={th}>Setor</th><th style={th}>Encarregado</th>
                    <th style={{ ...th, textAlign: "center" }}>Equipe</th>
                    <th style={{ ...th, textAlign: "right", paddingRight: 16 }}>Ação</th>
                  </tr></thead>
                  <tbody>
                    {vis.length === 0 ? (
                      <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 24 }}>Nenhum contrato no filtro.</td></tr>
                    ) : vis.map(c => (
                      <Fragment key={c.norm}>
                        <tr onClick={() => toggle(c.norm)} style={{ cursor: "pointer" }}>
                          <td style={{ ...td, paddingLeft: 16, color: "#94a3b8" }}>{aberto.has(c.norm) ? "▾" : "▸"}</td>
                          <td style={{ ...td, fontWeight: 700, color: "#0f172a" }}>{c.display}</td>
                          <td style={td}>{c.setor || "—"}</td>
                          <td style={td}>
                            {c.encarregado
                              ? <span style={{ fontWeight: 600, color: "#0f172a" }}>{c.encarregado.nome}</span>
                              : c.encAutoCount > 1
                                ? <span style={{ color: "#b45309" }}>{c.encAutoCount} encarregados na equipe</span>
                                : <span style={{ color: "#dc2626" }}>Sem encarregado</span>}
                            {c.obs && <div style={{ fontSize: 10.5, color: "#94a3b8" }}>{c.obs}</div>}
                          </td>
                          <td style={{ ...td, textAlign: "center", fontWeight: 800 }}>{nInt(c.ativos.length)}</td>
                          <td style={{ ...td, textAlign: "right", paddingRight: 16, whiteSpace: "nowrap" }}>
                            {c.encarregado && <Chip texto={c.encarregado.origem === "manual" ? "Designado" : "Automático"} cor={c.encarregado.origem === "manual" ? "#7c3aed" : "#16a34a"} />}
                            <button onClick={ev => { ev.stopPropagation(); setEditando(c); }} style={{ ...btn("#fff", "#0f3171", "1px solid #0f3171"), marginLeft: 6 }}>
                              {c.encarregado ? "Trocar" : "Definir"}
                            </button>
                          </td>
                        </tr>
                        {aberto.has(c.norm) && (
                          <tr>
                            <td />
                            <td colSpan={5} style={{ ...td, background: "#f8fafc" }}>
                              <div style={{ fontSize: 10.5, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>
                                Equipe do contrato ({nInt(c.ativos.length)} ativos{c.membros.length !== c.ativos.length ? ` · ${nInt(c.membros.length - c.ativos.length)} inativos ocultos` : ""})
                              </div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {c.ativos.slice().sort((a, b) => (rankNivel(a.nivel) < 0 ? 99 : rankNivel(a.nivel)) - (rankNivel(b.nivel) < 0 ? 99 : rankNivel(b.nivel)) || a.nome.localeCompare(b.nome, "pt-BR")).slice(0, 60).map(m => (
                                  <span key={m.id} title={`${m.cargo || "—"}${m.nivel ? " · " + m.nivel : ""}`}
                                    style={{ fontSize: 11, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 20, padding: "3px 9px", color: "#475569", display: "inline-flex", alignItems: "center", gap: 6 }}>
                                    {c.encarregado?.id === m.id && "⭐ "}{m.nome}
                                    {ehNivel(m.nivel) && <Chip texto={m.nivel} cor={corNivel(m.nivel)} />}
                                  </span>
                                ))}
                                {c.ativos.length > 60 && <span style={{ fontSize: 10.5, color: "#94a3b8", alignSelf: "center" }}>+{nInt(c.ativos.length - 60)}… (veja o CSV)</span>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 10, lineHeight: 1.5 }}>
              ⓘ O contrato vem da coluna <b>Descrição do Local</b>. Sem designação, sugere-se o membro com nível <b>ENCARREGADO</b>;
              quando há mais de um, fica para você decidir. Toda a equipe ativa do contrato passa a responder ao encarregado escolhido.
            </div>
          </>
        ) : (
          // ── SETORES ──────────────────────────────────────────────────
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Resumo diretor → nº de setores */}
            <div style={{ ...cardBox, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px" }}>Diretores</span>
              {resumoDiretores.porDiretor.length === 0 && resumoDiretores.sem === setores.length
                ? <span style={{ fontSize: 12, color: "#94a3b8" }}>Nenhum setor com diretor ainda — defina abaixo.</span>
                : resumoDiretores.porDiretor.map(d => (
                  <span key={d.nome} style={{ fontSize: 12, background: "#eef4ff", border: "1px solid #c7d2fe", borderRadius: 20, padding: "4px 11px", color: "#0f3171" }}>
                    {d.nome} <b>· {d.n} setor(es)</b>
                  </span>
                ))}
              {resumoDiretores.sem > 0 && <span style={{ fontSize: 12, color: "#dc2626" }}>{resumoDiretores.sem} sem diretor</span>}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
              Ordem por nível hierárquico: {NIVEIS.join(" › ")}. O staff sem nível entra por cargo.
            </div>
            {setores.map(s => {
              const dir = setorDiretor.get(normSetor(s.setor));
              return (
              <div key={s.setor} style={cardBox}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{s.setor}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <label style={{ fontSize: 11, color: "#64748b", display: "flex", alignItems: "center", gap: 6 }}>
                      Diretor:
                      <select value={dir?.id ?? ""} onChange={e => definirDiretor(s.setor, e.target.value ? Number(e.target.value) : null)}
                        style={{ ...inp, width: "auto", minWidth: 180, padding: "5px 8px", fontSize: 12 }}>
                        <option value="">— nenhum —</option>
                        {diretores.map(d => <option key={d.id} value={d.id}>{d.nome} ({d.nivel})</option>)}
                      </select>
                    </label>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{nInt(s.ativos.length)} ativos · {nInt(s.lideres.length)} com nível · {nInt(s.contratos.length)} contrato(s)</div>
                  </div>
                </div>
                {s.lideres.length === 0 ? <div style={{ fontSize: 12, color: "#94a3b8" }}>Ninguém com nível hierárquico neste setor.</div> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {s.lideres.map(l => (
                      <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: Math.max(0, rankNivel(l.nivel) - rankNivel("GERENTE")) * 18 }}>
                        <Chip texto={l.nivel} cor={corNivel(l.nivel)} />
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>{l.nome}</span>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>{l.cargo}</span>
                      </div>
                    ))}
                  </div>
                )}
                {s.contratos.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #e2e8f0" }}>
                    <div style={{ fontSize: 10.5, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>Contratos deste setor</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {s.contratos.map(ct => {
                        const c = contratos.find(x => x.norm === normLocal(ct));
                        return (
                          <span key={ct} onClick={() => c && (setAba("contratos"), setBusca(ct))} title="Ver na aba Contratos"
                            style={{ fontSize: 11, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 20, padding: "3px 10px", color: "#475569", cursor: "pointer" }}>
                            {ct} {c?.encarregado ? <b style={{ color: "#16a34a" }}>· {c.encarregado.nome.split(" ")[0]}</b> : <b style={{ color: "#dc2626" }}>· sem enc.</b>}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>+ {nInt(s.staff.length)} colaborador(es) sem nível (staff/operacional)</div>
              </div>
            ); })}
          </div>
        )}
      </div>

      {editando && <ModalEncarregado contrato={editando} emps={emps} onFechar={() => setEditando(null)} onSalvo={recarregarAssigns} />}
    </div>
  );
}
