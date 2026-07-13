import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Formulario, Pergunta, fmtDt, urlPublica, situacao, normalizaPerguntas, novoUuid } from "./Formularios";

// =====================================================================
// NASCIMENTO FORMULÁRIOS - Builder (editor de formulário)
// Monta o formulário: título/descrição/capa, configurações (vigência,
// limite de respostas, identificação do respondente) e as perguntas -
// vários tipos, com imagem por pergunta, opções e obrigatoriedade.
// Salvar = 1 update: perguntas vivem em CS_FORMULARIOS.perguntas (jsonb),
// com ids estáveis p/ não órfãr respostas.
// =====================================================================

export const TIPOS: { valor: string; rotulo: string; temOpcoes: boolean }[] = [
  { valor: "texto_curto",      rotulo: "Texto curto",              temOpcoes: false },
  { valor: "texto_longo",      rotulo: "Texto longo (parágrafo)",  temOpcoes: false },
  { valor: "colaborador",      rotulo: "Selecionar colaborador (cadastro)", temOpcoes: false },
  { valor: "escala_trabalho",  rotulo: "Escala de trabalho (turno)", temOpcoes: false },
  { valor: "multipla_escolha", rotulo: "Múltipla escolha (1 opção)", temOpcoes: true },
  { valor: "caixas_selecao",   rotulo: "Caixas de seleção (várias)", temOpcoes: true },
  { valor: "lista_suspensa",   rotulo: "Lista suspensa",           temOpcoes: true },
  { valor: "escala",           rotulo: "Escala (nota)",            temOpcoes: false },
  { valor: "data",             rotulo: "Data",                     temOpcoes: false },
  { valor: "numero",           rotulo: "Número",                   temOpcoes: false },
];

const btn = (bg: string, c = "#fff", border = "none"): React.CSSProperties =>
  ({ padding: "6px 12px", borderRadius: 9, border, background: bg, color: c, fontSize: 12, fontWeight: 700, cursor: "pointer" });
const inp: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 9, padding: "8px 10px", fontSize: 13, outline: "none", fontFamily: "inherit", background: "#fff" };
const lbl: React.CSSProperties = { display: "block", fontSize: 10.5, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 };

/** datetime-local <-> ISO */
const paraLocal = (iso?: string | null) => { if (!iso) return ""; const d = new Date(iso); if (isNaN(+d)) return ""; const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const paraIso = (local: string) => (local ? new Date(local).toISOString() : null);

export default function FormularioEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const [form, setForm] = useState<Formulario | null>(null);
  const [pergs, setPergs] = useState<Pergunta[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sujo, setSujo] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string; t: string }[]>([]);
  const capaRef = useRef<HTMLInputElement>(null);
  const [setoresErp, setSetoresErp] = useState<string[]>([]);   // setores distintos de EMPREGADOS
  const [mostrarEncerra, setMostrarEncerra] = useState(false);
  const [maisOpcoes, setMaisOpcoes] = useState(false);
  const toast = (msg: string, t = "info") => { const tid = Date.now() + Math.random(); setToasts(x => [...x, { id: tid, msg, t }]); setTimeout(() => setToasts(x => x.filter(i => i.id !== tid)), 4200); };

  const load = useCallback(async () => {
    setLoading(true);
    const fRes = await (supabase as any).from("CS_FORMULARIOS").select("*").eq("id", id).single();
    setLoading(false);
    if (fRes.error) { toast("Formulário não encontrado.", "err"); nav("/app/central-servicos/formularios"); return; }
    setForm(fRes.data);
    setPergs(normalizaPerguntas(fRes.data.perguntas));
    if (fRes.data.encerra_em) setMostrarEncerra(true);
    setSujo(false);
  }, [id, nav]);
  useEffect(() => { load(); }, [load]);

  // Setores do cadastro (EMPREGADOS.Setor_ERP) - para "Acesso" e visibilidade por setor.
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("EMPREGADOS").select('"Setor_ERP"').limit(20000);
      setSetoresErp([...new Set((data ?? []).map((r: any) => String(r["Setor_ERP"] ?? "").trim()).filter(Boolean))].sort() as string[]);
    })();
  }, []);

  const mudaForm = (patch: Partial<Formulario>) => { setForm(f => f ? { ...f, ...patch } : f); setSujo(true); };
  const mudaPerg = (i: number, patch: Partial<Pergunta>) => { setPergs(ps => ps.map((p, j) => j === i ? { ...p, ...patch } : p)); setSujo(true); };

  const addPergunta = () => { setPergs(ps => [...ps, { id: novoUuid(), tipo: "texto_curto", titulo: "", obrigatoria: false, opcoes: [], config: {} }]); setSujo(true); };
  const removePergunta = (i: number) => { setPergs(ps => ps.filter((_, j) => j !== i)); setSujo(true); };
  const move = (i: number, dir: -1 | 1) => {
    setPergs(ps => { const a = [...ps]; const j = i + dir; if (j < 0 || j >= a.length) return ps; [a[i], a[j]] = [a[j], a[i]]; return a; });
    setSujo(true);
  };

  const upload = async (file: File, prefixo: string): Promise<string | null> => {
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${form?.id ?? "geral"}/${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const { error } = await supabase.storage.from("cs-formularios").upload(path, file, { upsert: false });
    if (error) { toast("Erro no upload: " + error.message, "err"); return null; }
    return supabase.storage.from("cs-formularios").getPublicUrl(path).data.publicUrl;
  };

  const salvar = async (novoStatus?: Formulario["status"]) => {
    if (!form) return;
    if (!form.titulo.trim()) { toast("O formulário precisa de um título.", "err"); return; }
    if (novoStatus === "publicado" && pergs.filter(p => p.titulo.trim()).length === 0) { toast("Adicione ao menos 1 pergunta antes de publicar.", "err"); return; }
    setSalvando(true);
    // Colunas garantidas (base) x colunas novas de setor/acesso (extra). Se o
    // banco ainda não tem as novas, reenvia só a base - o save não trava.
    const base: any = {
      titulo: form.titulo.trim(), descricao: form.descricao || null,
      inicia_em: form.inicia_em || null, encerra_em: form.encerra_em || null,
      max_respostas: form.max_respostas || null, coleta_identificacao: form.coleta_identificacao,
      imagem_capa_url: form.imagem_capa_url || null,
      perguntas: pergs.filter(p => p.titulo.trim()).map(p => ({
        id: p.id, tipo: p.tipo, titulo: p.titulo.trim(), descricao: p.descricao || null,
        obrigatoria: p.obrigatoria, imagem_url: p.imagem_url || null,
        opcoes: p.opcoes.filter(o => o.trim()), config: p.config,
      })),
      ...(novoStatus ? { status: novoStatus } : {}),
    };
    const extra = { pergunta_setor_id: form.pergunta_setor_id || null, setores_acesso: form.setores_acesso ?? null };
    let { error: e1 } = await (supabase as any).from("CS_FORMULARIOS").update({ ...base, ...extra }).eq("id", form.id);
    if (e1 && /column|schema cache/i.test(e1.message)) ({ error: e1 } = await (supabase as any).from("CS_FORMULARIOS").update(base).eq("id", form.id));
    if (e1) { setSalvando(false); toast("Erro ao salvar: " + e1.message, "err"); return; }
    setSalvando(false);
    toast(novoStatus === "publicado" ? "Publicado! URL ativa - copie na lista." : "Salvo.", "ok");
    load();
  };

  if (loading || !form) return <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>Carregando...</div>;
  const sit = situacao(form);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f7fb" }}>
      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 22px", margin: "18px 24px 0", border: "1px solid #e2e8f0", borderRadius: 18, background: "#fff", boxShadow: "0 8px 24px rgba(15,23,42,.06)", flexShrink: 0, flexWrap: "wrap" }}>
        <button onClick={() => nav("/app/central-servicos/formularios")} style={btn("#fff", "#475569", "1px solid #e2e8f0")}>← Voltar</button>
        <div style={{ flex: 1, minWidth: 220, fontSize: 16, fontWeight: 800, color: form.titulo ? "#0f3171" : "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{form.titulo || "Sem título"}</div>
        <span style={{ fontSize: 10.5, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: sit.bg, color: sit.c }}>{sit.rotulo}</span>
        {form.status === "publicado" && <a href={urlPublica(form.slug)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#0369a1", fontWeight: 700 }}>Abrir URL ↗</a>}
        <button onClick={() => salvar()} disabled={salvando} style={btn(sujo ? "#0f3171" : "#94a3b8")}>{salvando ? "Salvando..." : "💾 Salvar"}</button>
        {form.status !== "publicado"
          ? <button onClick={() => salvar("publicado")} disabled={salvando} style={btn("#16a34a")}>🚀 Publicar</button>
          : <button onClick={() => salvar("encerrado")} disabled={salvando} style={btn("rgba(220,38,38,.08)", "#dc2626", "1px solid rgba(220,38,38,.25)")}>Encerrar</button>}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px 40px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Criar Formulário */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 18px", boxShadow: "0 8px 24px rgba(15,23,42,.06)" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#0f3171", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 12 }}>🗂 Criar Formulário</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>Título do formulário</label>
                <input value={form.titulo} onChange={e => mudaForm({ titulo: e.target.value })} style={{ ...inp, width: "100%", fontSize: 14, fontWeight: 700, color: "#0f172a" }} placeholder="Ex.: Feedback Guiado 2026" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>Descrição do formulário (aparece no topo)</label>
                <textarea value={form.descricao ?? ""} onChange={e => mudaForm({ descricao: e.target.value })} rows={2} style={{ ...inp, width: "100%", resize: "vertical" }} placeholder="Explique o objetivo do formulário..." />
              </div>
              <div>
                <label style={lbl}>Data de criação</label>
                <div style={{ ...inp, width: "100%", background: "#f8fafc", color: "#475569", fontWeight: 600 }}>{fmtDt(form.created_at)}</div>
              </div>
              <div>
                <label style={lbl}>Encerramento automático</label>
                {form.encerra_em || mostrarEncerra ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="datetime-local" value={paraLocal(form.encerra_em)} onChange={e => mudaForm({ encerra_em: paraIso(e.target.value) })} style={{ ...inp, flex: 1 }} />
                    <button onClick={() => { mudaForm({ encerra_em: null }); setMostrarEncerra(false); }} style={btn("#fff", "#dc2626", "1px solid rgba(220,38,38,.25)")}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => setMostrarEncerra(true)} style={{ ...btn("#fff", "#0f3171", "1px dashed #cbd5e1"), width: "100%", padding: "8px" }}>+ Adicionar encerramento automático</button>
                )}
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>Acesso - quais setores podem ver/responder (vazio = todos)</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {setoresErp.length === 0 && <span style={{ fontSize: 12, color: "#94a3b8" }}>Carregando setores…</span>}
                  {setoresErp.map(s => {
                    const on = (form.setores_acesso ?? []).includes(s);
                    return (
                      <span key={s} onClick={() => { const set = new Set(form.setores_acesso ?? []); on ? set.delete(s) : set.add(s); mudaForm({ setores_acesso: set.size ? [...set] : null }); }}
                        style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700, cursor: "pointer", border: on ? "1px solid #0f3171" : "1px solid #e2e8f0", background: on ? "#0f3171" : "#fff", color: on ? "#fff" : "#64748b" }}>{s}</span>
                    );
                  })}
                </div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={lbl}>Imagem de capa (opcional)</label>
                {form.imagem_capa_url
                  ? <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <img src={form.imagem_capa_url} alt="capa" style={{ height: 64, borderRadius: 10, border: "1px solid #e2e8f0" }} />
                      <button onClick={() => mudaForm({ imagem_capa_url: null })} style={btn("#fff", "#dc2626", "1px solid rgba(220,38,38,.25)")}>Remover</button>
                    </div>
                  : <>
                      <button onClick={() => capaRef.current?.click()} style={btn("#fff", "#0f3171", "1px dashed #cbd5e1")}>🖼 Enviar imagem de capa</button>
                      <input ref={capaRef} type="file" accept="image/*" style={{ display: "none" }}
                        onChange={async e => { const f = e.target.files?.[0]; if (!f) return; const url = await upload(f, "capa"); if (url) mudaForm({ imagem_capa_url: url }); e.target.value = ""; }} />
                    </>}
              </div>

              {/* Mais opções - abre em, limite, identificação, pergunta de setor */}
              <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
                <button onClick={() => setMaisOpcoes(v => !v)} style={{ background: "none", border: "none", color: "#0f3171", fontSize: 12, fontWeight: 800, cursor: "pointer", padding: 0 }}>Mais opções {maisOpcoes ? "▴" : "▾"}</button>
              </div>
              {maisOpcoes && <>
                <div>
                  <label style={lbl}>Abre em (opcional)</label>
                  <input type="datetime-local" value={paraLocal(form.inicia_em)} onChange={e => mudaForm({ inicia_em: paraIso(e.target.value) })} style={{ ...inp, width: "100%" }} />
                </div>
                <div>
                  <label style={lbl}>Limite de respostas (opcional)</label>
                  <input type="number" min={1} value={form.max_respostas ?? ""} onChange={e => mudaForm({ max_respostas: e.target.value ? Number(e.target.value) : null })} style={{ ...inp, width: "100%" }} placeholder="Sem limite" />
                </div>
                <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center" }}>
                  <label style={{ fontSize: 12.5, color: "#0f172a", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 600 }}>
                    <input type="checkbox" checked={form.coleta_identificacao} onChange={e => mudaForm({ coleta_identificacao: e.target.checked })} style={{ width: 15, height: 15 }} />
                    Pedir nome e e-mail (quando o respondente não está logado)
                  </label>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={lbl}>Pergunta que define o setor (fallback do cadastro, p/ Admin × Operacional)</label>
                  <select value={form.pergunta_setor_id ?? ""} onChange={e => mudaForm({ pergunta_setor_id: e.target.value || null })} style={{ ...inp, width: "100%", maxWidth: 420, textOverflow: "ellipsis" }}>
                    <option value="">- Nenhuma (usa o setor do cadastro do respondente) -</option>
                    {pergs.filter(p => p.titulo.trim()).map(p => <option key={p.id} value={p.id}>{p.titulo.length > 60 ? p.titulo.slice(0, 60) + "…" : p.titulo}</option>)}
                  </select>
                </div>
              </>}
            </div>
            {form.status === "publicado" && (
              <div style={{ marginTop: 12, fontSize: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", borderRadius: 9, padding: "8px 10px", wordBreak: "break-all" }}>
                🔗 URL pública: <b>{urlPublica(form.slug)}</b>{form.encerra_em ? ` · encerra ${fmtDt(form.encerra_em)}` : ""}
              </div>
            )}
          </div>

          {/* Perguntas */}
          {pergs.map((p, i) => <PerguntaCard key={p.id} p={p} i={i} total={pergs.length} muda={mudaPerg} move={move} remove={removePergunta} upload={upload} setores={setoresErp} />)}

          <button onClick={addPergunta} style={{ ...btn("#fff", "#0f3171", "2px dashed #cbd5e1"), padding: "14px", fontSize: 13.5, borderRadius: 14 }}>+ Adicionar pergunta</button>
        </div>
      </div>

      <div style={{ position: "fixed", bottom: 18, right: 18, display: "flex", flexDirection: "column", gap: 8, zIndex: 999 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background: t.t === "err" ? "#fee2e2" : t.t === "ok" ? "#dcfce7" : "#e0f2fe", color: t.t === "err" ? "#b91c1c" : t.t === "ok" ? "#15803d" : "#0369a1", padding: "10px 16px", borderRadius: 12, fontSize: 12.5, fontWeight: 700, boxShadow: "0 8px 24px rgba(15,23,42,.15)", maxWidth: 380 }}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}

function PerguntaCard({ p, i, total, muda, move, remove, upload, setores }: {
  p: Pergunta; i: number; total: number;
  muda: (i: number, patch: Partial<Pergunta>) => void;
  move: (i: number, dir: -1 | 1) => void;
  remove: (i: number) => void;
  upload: (f: File, prefixo: string) => Promise<string | null>;
  setores: string[];
}) {
  const imgRef = useRef<HTMLInputElement>(null);
  const [mostrarSetor, setMostrarSetor] = useState(false);
  const tipo = TIPOS.find(t => t.valor === p.tipo);
  const setoresVis: string[] = Array.isArray(p.config.setores) ? p.config.setores : [];
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", boxShadow: "0 8px 24px rgba(15,23,42,.06)" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", flexShrink: 0 }}>#{i + 1}</span>
        <input value={p.titulo} onChange={e => muda(i, { titulo: e.target.value })} placeholder="Escreva a pergunta..."
          style={{ border: "none", borderBottom: "2px solid #e2e8f0", padding: "6px 2px", fontSize: 14.5, fontWeight: 700, color: "#0f172a", outline: "none", flex: 1, background: "transparent" }} />
        <select value={p.tipo} onChange={e => muda(i, { tipo: e.target.value, opcoes: TIPOS.find(t => t.valor === e.target.value)?.temOpcoes && p.opcoes.length === 0 ? ["Opção 1"] : p.opcoes })}
          style={{ border: "1px solid #e2e8f0", borderRadius: 9, padding: "7px 8px", fontSize: 12, outline: "none", background: "#fff", fontWeight: 600 }}>
          {TIPOS.map(t => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
        </select>
      </div>

      <input value={p.descricao ?? ""} onChange={e => muda(i, { descricao: e.target.value })} placeholder="Descrição / ajuda - aparece abaixo do título (opcional)"
        style={{ border: "1px solid #f1f5f9", borderRadius: 8, padding: "6px 9px", fontSize: 12, color: "#64748b", outline: "none", width: "100%", marginBottom: 10, background: "#fafbfc" }} />

      {p.imagem_url && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <img src={p.imagem_url} alt="" style={{ maxHeight: 110, borderRadius: 10, border: "1px solid #e2e8f0" }} />
          <button onClick={() => muda(i, { imagem_url: null })} style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(220,38,38,.25)", background: "#fff", color: "#dc2626", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Remover imagem</button>
        </div>
      )}

      {tipo?.temOpcoes && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {p.opcoes.map((o, oi) => (
            <div key={oi} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ color: "#cbd5e1", fontSize: 13 }}>{p.tipo === "caixas_selecao" ? "☐" : p.tipo === "lista_suspensa" ? `${oi + 1}.` : "◯"}</span>
              <input value={o} onChange={e => muda(i, { opcoes: p.opcoes.map((x, xi) => xi === oi ? e.target.value : x) })}
                style={{ border: "none", borderBottom: "1px solid #e2e8f0", padding: "4px 2px", fontSize: 13, outline: "none", flex: 1, maxWidth: 420 }} />
              <button onClick={() => muda(i, { opcoes: p.opcoes.filter((_, xi) => xi !== oi) })} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 13 }}>✕</button>
            </div>
          ))}
          <button onClick={() => muda(i, { opcoes: [...p.opcoes, `Opção ${p.opcoes.length + 1}`] })}
            style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#0369a1", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: "2px 0" }}>+ Adicionar opção</button>
          <label style={{ fontSize: 11.5, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: 600, color: "#0f172a", marginTop: 4 }}>
            <input type="checkbox" checked={!!p.config.outro} onChange={e => muda(i, { config: { ...p.config, outro: e.target.checked } })} style={{ width: 14, height: 14 }} />
            Permitir opção “Outro” - o respondente descreve
          </label>
        </div>
      )}

      {p.tipo === "escala" && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 10, flexWrap: "wrap" }}>
          <div><label style={lbl}>De</label>
            <select value={p.config.min ?? 1} onChange={e => muda(i, { config: { ...p.config, min: Number(e.target.value) } })} style={{ ...inp, padding: "6px 8px" }}>{[0, 1].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
          <div><label style={lbl}>Até</label>
            <select value={p.config.max ?? 5} onChange={e => muda(i, { config: { ...p.config, max: Number(e.target.value) } })} style={{ ...inp, padding: "6px 8px" }}>{[3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
          <div style={{ flex: 1, minWidth: 140 }}><label style={lbl}>Rótulo inicial (opcional)</label>
            <input value={p.config.rotulo_min ?? ""} onChange={e => muda(i, { config: { ...p.config, rotulo_min: e.target.value } })} style={{ ...inp, width: "100%", padding: "6px 8px" }} placeholder="Ex.: Péssimo" /></div>
          <div style={{ flex: 1, minWidth: 140 }}><label style={lbl}>Rótulo final (opcional)</label>
            <input value={p.config.rotulo_max ?? ""} onChange={e => muda(i, { config: { ...p.config, rotulo_max: e.target.value } })} style={{ ...inp, width: "100%", padding: "6px 8px" }} placeholder="Ex.: Excelente" /></div>
        </div>
      )}

      {setores.length > 0 && (
        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 8, marginBottom: 4 }}>
          <button onClick={() => setMostrarSetor(v => !v)} style={{ background: "none", border: "none", color: setoresVis.length ? "#0f3171" : "#94a3b8", fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>
            👁 {setoresVis.length ? `Só ${setoresVis.length} setor(es) responde(m)` : "Todos os setores respondem"} {mostrarSetor ? "▴" : "▾"}
          </button>
          {mostrarSetor && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {setores.map(s => {
                const on = setoresVis.includes(s);
                return <span key={s} onClick={() => { const set = new Set(setoresVis); on ? set.delete(s) : set.add(s); muda(i, { config: { ...p.config, setores: set.size ? [...set] : undefined } }); }}
                  style={{ padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer", border: on ? "1px solid #0f3171" : "1px solid #e2e8f0", background: on ? "#0f3171" : "#fff", color: on ? "#fff" : "#64748b" }}>{s}</span>;
              })}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: 10, flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, color: "#0f172a", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: 600 }}>
          <input type="checkbox" checked={p.obrigatoria} onChange={e => muda(i, { obrigatoria: e.target.checked })} style={{ width: 14, height: 14, accentColor: "#dc2626" }} />
          Obrigatória
        </label>
        <button onClick={() => imgRef.current?.click()} style={{ background: "none", border: "none", color: "#0369a1", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🖼 {p.imagem_url ? "Trocar" : "Adicionar"} imagem</button>
        <input ref={imgRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={async e => { const f = e.target.files?.[0]; if (!f) return; const url = await upload(f, `perg-${i + 1}`); if (url) muda(i, { imagem_url: url }); e.target.value = ""; }} />
        <div style={{ flex: 1 }} />
        <button onClick={() => move(i, -1)} disabled={i === 0} style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 7, width: 26, height: 26, cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "#e2e8f0" : "#475569" }}>↑</button>
        <button onClick={() => move(i, 1)} disabled={i === total - 1} style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 7, width: 26, height: 26, cursor: i === total - 1 ? "default" : "pointer", color: i === total - 1 ? "#e2e8f0" : "#475569" }}>↓</button>
        <button onClick={() => remove(i)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 12.5, fontWeight: 700 }}>🗑 Excluir</button>
      </div>
    </div>
  );
}
