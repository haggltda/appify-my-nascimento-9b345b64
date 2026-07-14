import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Formulario, Pergunta, fmtDt, situacao, normalizaPerguntas } from "./Formularios";
import EmpregadoDetalheModal, { normNome } from "./EmpregadoDetalheModal";

// =====================================================================
// NASCIMENTO FORMULÁRIOS - Respostas
// Resumo agregado por pergunta (contagem/percentual em barras para
// escolhas/escala; média para número; lista para texto), tabela de
// respostas individuais e exportação CSV.
// =====================================================================

interface Resposta {
  id: string; enviado_em: string;
  respondente_nome?: string | null; respondente_email?: string | null;
  setor?: string | null; respondente_cadastro?: Record<string, any> | null;
  duracao_seg?: number | null;
  itens: Record<string, any>;
}

const fmtDur = (s?: number | null) => { if (s == null) return "-"; const m = Math.floor(s / 60), ss = s % 60; return m ? `${m}m ${ss}s` : `${ss}s`; };

// Rótulos amigáveis do snapshot de cadastro (respondente_cadastro).
const CADASTRO_CAMPOS: { k: string; rotulo: string }[] = [
  { k: "nome", rotulo: "Nome" }, { k: "cpf", rotulo: "CPF" }, { k: "cargo", rotulo: "Cargo" },
  { k: "setor", rotulo: "Setor" }, { k: "perfil", rotulo: "Perfil" }, { k: "lider", rotulo: "Líder" },
  { k: "situacao", rotulo: "Situação" }, { k: "admissao", rotulo: "Admissão" },
  { k: "empresa", rotulo: "Empresa" }, { k: "filial", rotulo: "Filial" }, { k: "email", rotulo: "E-mail" },
];

const btn = (bg: string, c = "#fff", border = "none"): React.CSSProperties =>
  ({ padding: "6px 12px", borderRadius: 9, border, background: bg, color: c, fontSize: 12, fontWeight: 700, cursor: "pointer" });
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "15px 17px", boxShadow: "0 8px 24px rgba(15,23,42,.06)" };
const valorTexto = (v: any) => v == null || v === "" ? "-" : Array.isArray(v) ? v.join("; ") : String(v);

// Nome de empregado citado numa resposta: vira link p/ a ficha (👤). Se não
// bater com o cadastro, renderiza texto normal.
function NomeLink({ texto, ehPessoa, onPessoa }: { texto: string; ehPessoa: (v: any) => boolean; onPessoa: (n: string) => void }) {
  if (!ehPessoa(texto)) return <>{texto}</>;
  return (
    <button onClick={() => onPessoa(texto)} title="Ver ficha do colaborador"
      style={{ background: "none", border: "none", padding: 0, font: "inherit", color: "#0f3171", fontWeight: 700, cursor: "pointer", textAlign: "left", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 2 }}>
      👤 {texto}
    </button>
  );
}

export default function FormularioRespostas() {
  const { id } = useParams();
  const nav = useNavigate();
  const [form, setForm] = useState<Formulario | null>(null);
  const [pergs, setPergs] = useState<Pergunta[]>([]);
  const [resps, setResps] = useState<Resposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<"resumo" | "individuais">("resumo");
  const [detalhe, setDetalhe] = useState<Resposta | null>(null);  // modal "Detalhes" do cadastro
  const [pessoa, setPessoa] = useState<string | null>(null);      // modal ficha do empregado (nome citado)
  const [nomesEmp, setNomesEmp] = useState<Set<string>>(new Set()); // nomes do cadastro (normalizados) p/ tornar clicável

  const load = useCallback(async () => {
    setLoading(true);
    const [fRes, rRes] = await Promise.all([
      (supabase as any).from("CS_FORMULARIOS").select("*").eq("id", id).single(),
      (supabase as any).from("CS_FORM_RESPOSTAS").select("*").eq("formulario_id", id).order("enviado_em", { ascending: false }),
    ]);
    setLoading(false);
    if (fRes.error) { nav("/app/central-servicos/formularios"); return; }
    setForm(fRes.data);
    setPergs(normalizaPerguntas(fRes.data.perguntas).filter(p => p.tipo !== "texto_info"));  // blocos de texto não são perguntas
    setResps((rRes.data ?? []).map((r: any) => ({ ...r, itens: r.itens ?? {} })));
  }, [id, nav]);
  useEffect(() => { load(); }, [load]);

  // Nomes do cadastro (EMPREGADOS) só para saber quais valores de resposta são
  // pessoas de verdade (viram link p/ a ficha). Best-effort: se falhar, ninguém
  // fica clicável. Só a coluna "Nome" p/ não pesar.
  useEffect(() => {
    (async () => {
      try {
        const { data } = await (supabase as any).from("EMPREGADOS").select('"Nome"');
        setNomesEmp(new Set((data ?? []).map((e: any) => normNome(e["Nome"])).filter(Boolean)));
      } catch { /* ignore */ }
    })();
  }, []);
  const ehPessoa = useCallback((v: any) => { const n = normNome(v); return !!n && nomesEmp.has(n); }, [nomesEmp]);

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
            pergs.map((p, i) => <ResumoPergunta key={p.id} p={p} i={i} resps={resps} ehPessoa={ehPessoa} onPessoa={setPessoa} />)
          ) : (
            resps.map(r => (
              <div key={r.id} style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: "#0f172a" }}>
                    {r.respondente_nome && ehPessoa(r.respondente_nome)
                      ? <NomeLink texto={r.respondente_nome} ehPessoa={ehPessoa} onPessoa={setPessoa} />
                      : (r.respondente_nome || "Anônimo")}
                  </span>
                  {r.respondente_email && <span style={{ fontSize: 11.5, color: "#64748b" }}>{r.respondente_email}</span>}
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{fmtDt(r.enviado_em)}</span>
                  {r.setor && <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: "#eef2ff", color: "#4338ca" }}>{r.setor}</span>}
                  {r.duracao_seg != null && <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#f1f5f9", color: "#64748b" }}>⏱ {fmtDur(r.duracao_seg)}</span>}
                  <div style={{ flex: 1 }} />
                  {r.respondente_cadastro && <button onClick={() => setDetalhe(r)} style={btn("rgba(15,49,113,.08)", "#0f3171", "1px solid rgba(15,49,113,.2)")}>👤 Detalhes</button>}
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

      {/* Modal Detalhes - cadastro do respondente (snapshot no momento da resposta) */}
      {detalhe && detalhe.respondente_cadastro && (
        <div onClick={() => setDetalhe(null)} style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 22, width: 520, maxWidth: "94vw", maxHeight: "88vh", overflowY: "auto", position: "relative" }}>
            <button onClick={() => setDetalhe(null)} style={{ position: "absolute", top: 14, right: 16, border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>×</button>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f3171", marginBottom: 2 }}>👤 {detalhe.respondente_cadastro.nome || detalhe.respondente_nome || "Respondente"}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>Dados completos do cadastro no momento da resposta</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ background: "#eef6ff", border: "1px solid #dbeafe", borderRadius: 10, padding: "6px 11px", fontSize: 12 }}><span style={{ color: "#94a3b8", fontWeight: 700 }}>🕒 Respondido em: </span><span style={{ color: "#0f172a", fontWeight: 700 }}>{fmtDt(detalhe.enviado_em)}</span></div>
              <div style={{ background: "#eef6ff", border: "1px solid #dbeafe", borderRadius: 10, padding: "6px 11px", fontSize: 12 }}><span style={{ color: "#94a3b8", fontWeight: 700 }}>⏱ Tempo de resposta: </span><span style={{ color: "#0f172a", fontWeight: 700 }}>{fmtDur(detalhe.duracao_seg)}</span></div>
              {detalhe.setor && <div style={{ background: "#eef2ff", border: "1px solid #e0e7ff", borderRadius: 10, padding: "6px 11px", fontSize: 12 }}><span style={{ color: "#94a3b8", fontWeight: 700 }}>Setor: </span><span style={{ color: "#4338ca", fontWeight: 700 }}>{detalhe.setor}</span></div>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {CADASTRO_CAMPOS.map(({ k, rotulo }) => {
                const v = detalhe.respondente_cadastro?.[k];
                return v ? (
                  <div key={k} style={{ background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 10, padding: "8px 11px" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".4px" }}>{rotulo}</div>
                    <div style={{ fontSize: 12.5, color: "#0f172a", fontWeight: 600, marginTop: 2, wordBreak: "break-word" }}>{String(v)}</div>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal Ficha do empregado - dados AO VIVO da EMPREGADOS + formulários que participou */}
      {pessoa && <EmpregadoDetalheModal nome={pessoa} onClose={() => setPessoa(null)} />}
    </div>
  );
}

function ResumoPergunta({ p, i, resps, ehPessoa, onPessoa }: { p: Pergunta; i: number; resps: Resposta[]; ehPessoa: (v: any) => boolean; onPessoa: (n: string) => void }) {
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
                <span style={{ fontSize: 12.5, color: "#0f172a", width: 180, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={k}>
                  <NomeLink texto={k} ehPessoa={ehPessoa} onPessoa={onPessoa} />
                </span>
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
        {valores.map((v, vi) => {
          const txt = valorTexto(v);
          return (
            <div key={vi} style={{ fontSize: 12.5, color: "#0f172a", background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 8, padding: "6px 10px" }}>
              <NomeLink texto={txt} ehPessoa={ehPessoa} onPessoa={onPessoa} />
            </div>
          );
        })}
      </div>
    );
  }, [p, valores, ehPessoa, onPessoa]);

  return (
    <div style={card}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{i + 1}. {p.titulo}</div>
      <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 10 }}>{valores.length} de {resps.length} responderam</div>
      {conteudo}
    </div>
  );
}
