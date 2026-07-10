import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Formulario, fmtDt, situacao } from "./Formularios";
import { Pergunta } from "./FormularioEditor";

// =====================================================================
// NASCIMENTO FORMULÁRIOS — Respostas
// Resumo agregado por pergunta (contagem/percentual em barras para
// escolhas/escala; média para número; lista para texto), tabela de
// respostas individuais e exportação CSV.
// =====================================================================

interface Resposta {
  id: string; enviado_em: string;
  respondente_nome?: string | null; respondente_email?: string | null;
  itens: Record<string, any>;
}

const btn = (bg: string, c = "#fff", border = "none"): React.CSSProperties =>
  ({ padding: "6px 12px", borderRadius: 9, border, background: bg, color: c, fontSize: 12, fontWeight: 700, cursor: "pointer" });
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "15px 17px", boxShadow: "0 8px 24px rgba(15,23,42,.06)" };
const valorTexto = (v: any) => v == null || v === "" ? "—" : Array.isArray(v) ? v.join("; ") : String(v);

export default function FormularioRespostas() {
  const { id } = useParams();
  const nav = useNavigate();
  const [form, setForm] = useState<Formulario | null>(null);
  const [pergs, setPergs] = useState<(Pergunta & { id: string })[]>([]);
  const [resps, setResps] = useState<Resposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<"resumo" | "individuais">("resumo");

  const load = useCallback(async () => {
    setLoading(true);
    const [fRes, pRes, rRes] = await Promise.all([
      (supabase as any).from("CS_FORMULARIOS").select("*").eq("id", id).single(),
      (supabase as any).from("CS_FORM_PERGUNTAS").select("*").eq("formulario_id", id).order("ordem"),
      (supabase as any).from("CS_FORM_RESPOSTAS").select("*").eq("formulario_id", id).order("enviado_em", { ascending: false }),
    ]);
    setLoading(false);
    if (fRes.error) { nav("/app/central-servicos/formularios"); return; }
    setForm(fRes.data);
    setPergs((pRes.data ?? []).map((p: any) => ({ ...p, opcoes: Array.isArray(p.opcoes) ? p.opcoes : [], config: p.config ?? {} })));
    setResps((rRes.data ?? []).map((r: any) => ({ ...r, itens: r.itens ?? {} })));
  }, [id, nav]);
  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    if (!form) return;
    const esc = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const cab = ["Enviado em", "Nome", "E-mail", ...pergs.map(p => p.titulo)];
    const linhas = resps.map(r => [
      fmtDt(r.enviado_em), r.respondente_nome ?? "", r.respondente_email ?? "",
      ...pergs.map(p => valorTexto(r.itens[p.id])),
    ]);
    const csv = "﻿" + [cab, ...linhas].map(l => l.map(esc).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `respostas-${form.slug}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const excluirResp = async (r: Resposta) => {
    if (!confirm("Excluir esta resposta?")) return;
    await (supabase as any).from("CS_FORM_RESPOSTAS").delete().eq("id", r.id);
    load();
  };

  if (loading || !form) return <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>Carregando...</div>;
  const sit = situacao(form, resps.length);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f7fb" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 22px", margin: "18px 24px 0", border: "1px solid #e2e8f0", borderRadius: 18, background: "#fff", boxShadow: "0 8px 24px rgba(15,23,42,.06)", flexShrink: 0, flexWrap: "wrap" }}>
        <button onClick={() => nav("/app/central-servicos/formularios")} style={btn("#fff", "#475569", "1px solid #e2e8f0")}>← Voltar</button>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0f3171" }}>📊 {form.titulo}</div>
          <div style={{ fontSize: 11.5, color: "#94a3b8" }}><b style={{ color: "#0f172a" }}>{resps.length}</b> resposta(s){form.max_respostas != null ? ` · limite ${form.max_respostas}` : ""} · <span style={{ color: sit.c, fontWeight: 700 }}>{sit.rotulo}</span></div>
        </div>
        <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 10, padding: 3 }}>
          {(["resumo", "individuais"] as const).map(a => (
            <button key={a} onClick={() => setAba(a)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: aba === a ? "#fff" : "transparent", color: aba === a ? "#0f3171" : "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: aba === a ? "0 2px 6px rgba(15,23,42,.08)" : "none" }}>
              {a === "resumo" ? "Resumo" : "Individuais"}
            </button>
          ))}
        </div>
        <button onClick={exportCsv} disabled={!resps.length} style={btn(resps.length ? "#16a34a" : "#94a3b8")}>⬇ Exportar CSV</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px 40px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {resps.length === 0 ? (
            <div style={{ ...card, textAlign: "center", color: "#94a3b8", padding: 50 }}>Nenhuma resposta ainda. Compartilhe a URL pública do formulário.</div>
          ) : aba === "resumo" ? (
            pergs.map((p, i) => <ResumoPergunta key={p.id} p={p} i={i} resps={resps} />)
          ) : (
            resps.map(r => (
              <div key={r.id} style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: "#0f172a" }}>{r.respondente_nome || "Anônimo"}</span>
                  {r.respondente_email && <span style={{ fontSize: 11.5, color: "#64748b" }}>{r.respondente_email}</span>}
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{fmtDt(r.enviado_em)}</span>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => excluirResp(r)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 11.5, fontWeight: 700 }}>Excluir</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {pergs.map(p => (
                    <div key={p.id} style={{ fontSize: 12.5 }}>
                      <span style={{ color: "#94a3b8", fontWeight: 700 }}>{p.titulo}: </span>
                      <span style={{ color: "#0f172a" }}>{valorTexto(r.itens[p.id])}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ResumoPergunta({ p, i, resps }: { p: Pergunta & { id: string }; i: number; resps: Resposta[] }) {
  const valores = useMemo(() => resps.map(r => r.itens[p.id]).filter(v => v != null && v !== "" && !(Array.isArray(v) && v.length === 0)), [resps, p.id]);

  const conteudo = useMemo(() => {
    if (["multipla_escolha", "caixas_selecao", "lista_suspensa", "escala"].includes(p.tipo)) {
      const cont: Record<string, number> = {};
      let total = 0;
      valores.forEach(v => (Array.isArray(v) ? v : [v]).forEach(x => { cont[String(x)] = (cont[String(x)] || 0) + 1; total++; }));
      let chaves: string[];
      if (p.tipo === "escala") {
        const min = p.config?.min ?? 1, max = p.config?.max ?? 5;
        chaves = []; for (let n = min; n <= max; n++) chaves.push(String(n));
      } else chaves = p.opcoes.length ? p.opcoes : Object.keys(cont);
      const media = p.tipo === "escala" && valores.length
        ? (valores.reduce((s, v) => s + Number(v), 0) / valores.length).toFixed(1) : null;
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {media && <div style={{ fontSize: 13, color: "#0f3171", fontWeight: 800 }}>Média: {media}</div>}
          {chaves.map(k => {
            const n = cont[k] || 0;
            const pct = total ? Math.round((n / total) * 100) : 0;
            return (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12.5, color: "#0f172a", width: 180, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={k}>{k}</span>
                <div style={{ flex: 1, height: 18, background: "#f1f5f9", borderRadius: 9, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: "#0f3171", borderRadius: 9, transition: "width .3s" }} />
                </div>
                <span style={{ fontSize: 12, color: "#64748b", width: 76, textAlign: "right", flexShrink: 0 }}>{n} ({pct}%)</span>
              </div>
            );
          })}
        </div>
      );
    }
    if (p.tipo === "numero") {
      const ns = valores.map(Number).filter(n => !isNaN(n));
      if (!ns.length) return <div style={{ fontSize: 12.5, color: "#94a3b8" }}>Sem respostas numéricas.</div>;
      const soma = ns.reduce((s, n) => s + n, 0);
      return <div style={{ fontSize: 13, color: "#0f172a" }}>Média <b>{(soma / ns.length).toFixed(2)}</b> · Mín <b>{Math.min(...ns)}</b> · Máx <b>{Math.max(...ns)}</b> · Soma <b>{soma}</b></div>;
    }
    // texto/data: lista
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 240, overflowY: "auto" }}>
        {valores.map((v, vi) => <div key={vi} style={{ fontSize: 12.5, color: "#0f172a", background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 8, padding: "6px 10px" }}>{valorTexto(v)}</div>)}
      </div>
    );
  }, [p, valores]);

  return (
    <div style={card}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{i + 1}. {p.titulo}</div>
      <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 10 }}>{valores.length} de {resps.length} responderam</div>
      {conteudo}
    </div>
  );
}
