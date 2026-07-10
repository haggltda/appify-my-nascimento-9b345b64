import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// =====================================================================
// CENTRAL DE SERVIÇOS — Nascimento Formulários (gestão)
// Lista os formulários, mostra as URLs públicas ATIVAS no momento,
// vigência e nº de respostas. Ações: criar, editar (builder), publicar/
// encerrar/reabrir, copiar URL, duplicar, ver respostas e excluir.
// Página pública de resposta: /formularios/<slug> (sem login).
// =====================================================================

export interface Formulario {
  id: string; created_at: string; updated_at: string;
  titulo: string; descricao?: string | null; slug: string;
  status: "rascunho" | "publicado" | "encerrado";
  inicia_em?: string | null; encerra_em?: string | null;
  max_respostas?: number | null; coleta_identificacao: boolean;
  imagem_capa_url?: string | null; criado_por_nome?: string | null;
}

export const fmtDt = (s?: string | null) => { if (!s) return "—"; const d = new Date(s); return isNaN(+d) ? String(s) : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); };
export const urlPublica = (slug: string) => `${window.location.origin}/formularios/${slug}`;
export const slugify = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) +
  "-" + Math.random().toString(36).slice(2, 6);

/** Situação efetiva considerando status + janela de vigência. */
export function situacao(f: Formulario, respostas?: number) {
  if (f.status === "rascunho")  return { chave: "rascunho",  rotulo: "Rascunho",  bg: "#f1f5f9", c: "#475569" };
  if (f.status === "encerrado") return { chave: "encerrado", rotulo: "Encerrado", bg: "#fee2e2", c: "#b91c1c" };
  const now = Date.now();
  if (f.inicia_em && now < +new Date(f.inicia_em))  return { chave: "agendado", rotulo: `Agendado p/ ${fmtDt(f.inicia_em)}`, bg: "#e0f2fe", c: "#0369a1" };
  if (f.encerra_em && now > +new Date(f.encerra_em)) return { chave: "expirado", rotulo: "Prazo encerrado", bg: "#fef9c3", c: "#a16207" };
  if (f.max_respostas != null && respostas != null && respostas >= f.max_respostas)
    return { chave: "lotado", rotulo: "Limite de respostas atingido", bg: "#fef9c3", c: "#a16207" };
  return { chave: "ativo", rotulo: "Ativo — recebendo respostas", bg: "#dcfce7", c: "#15803d" };
}

const btn = (bg: string, c = "#fff", border = "none"): React.CSSProperties =>
  ({ padding: "6px 12px", borderRadius: 9, border, background: bg, color: c, fontSize: 12, fontWeight: 700, cursor: "pointer" });

export default function Formularios() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [forms, setForms] = useState<Formulario[]>([]);
  const [contagens, setContagens] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [toasts, setToasts] = useState<{ id: number; msg: string; t: string }[]>([]);
  const toast = (msg: string, t = "info") => { const id = Date.now() + Math.random(); setToasts(x => [...x, { id, msg, t }]); setTimeout(() => setToasts(x => x.filter(i => i.id !== id)), 4200); };

  const load = useCallback(async () => {
    setLoading(true);
    const [fRes, rRes] = await Promise.all([
      (supabase as any).from("CS_FORMULARIOS").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("CS_FORM_RESPOSTAS").select("formulario_id"),
    ]);
    setLoading(false);
    if (fRes.error) { toast("Erro ao carregar: " + fRes.error.message, "err"); return; }
    setForms(fRes.data ?? []);
    const cont: Record<string, number> = {};
    (rRes.data ?? []).forEach((r: any) => { cont[r.formulario_id] = (cont[r.formulario_id] || 0) + 1; });
    setContagens(cont);
  }, []);
  useEffect(() => { load(); }, [load]);

  const criar = async () => {
    const titulo = novoTitulo.trim();
    if (!titulo) { toast("Dê um título ao formulário.", "err"); return; }
    const nome = user?.user_metadata?.nome ?? user?.email ?? "";
    const { data, error } = await (supabase as any).from("CS_FORMULARIOS")
      .insert({ titulo, slug: slugify(titulo), criado_por_nome: nome }).select("id").single();
    if (error) { toast("Erro ao criar: " + error.message, "err"); return; }
    nav(`/app/central-servicos/formularios/${data.id}`);
  };

  const mudarStatus = async (f: Formulario, status: Formulario["status"]) => {
    const { error } = await (supabase as any).from("CS_FORMULARIOS").update({ status }).eq("id", f.id);
    if (error) { toast("Erro: " + error.message, "err"); return; }
    toast(status === "publicado" ? "Formulário publicado — URL ativa." : status === "encerrado" ? "Formulário encerrado." : "Voltou para rascunho.", "ok");
    load();
  };

  const copiarUrl = async (f: Formulario) => {
    try { await navigator.clipboard.writeText(urlPublica(f.slug)); toast("URL copiada!", "ok"); }
    catch { toast(urlPublica(f.slug), "info"); }
  };

  const duplicar = async (f: Formulario) => {
    const nome = user?.user_metadata?.nome ?? user?.email ?? "";
    const { data: novo, error } = await (supabase as any).from("CS_FORMULARIOS").insert({
      titulo: f.titulo + " (cópia)", descricao: f.descricao, slug: slugify(f.titulo),
      inicia_em: f.inicia_em, encerra_em: f.encerra_em, max_respostas: f.max_respostas,
      coleta_identificacao: f.coleta_identificacao, imagem_capa_url: f.imagem_capa_url, criado_por_nome: nome,
    }).select("id").single();
    if (error) { toast("Erro ao duplicar: " + error.message, "err"); return; }
    const { data: pergs } = await (supabase as any).from("CS_FORM_PERGUNTAS").select("*").eq("formulario_id", f.id).order("ordem");
    if (pergs?.length) {
      await (supabase as any).from("CS_FORM_PERGUNTAS").insert(pergs.map((p: any) => ({
        formulario_id: novo.id, ordem: p.ordem, tipo: p.tipo, titulo: p.titulo, descricao: p.descricao,
        obrigatoria: p.obrigatoria, imagem_url: p.imagem_url, opcoes: p.opcoes, config: p.config,
      })));
    }
    toast("Formulário duplicado (como rascunho).", "ok");
    load();
  };

  const excluir = async (f: Formulario) => {
    const n = contagens[f.id] || 0;
    if (!confirm(`Excluir "${f.titulo}"?${n ? ` As ${n} resposta(s) também serão excluídas.` : ""} Essa ação não tem volta.`)) return;
    const { error } = await (supabase as any).from("CS_FORMULARIOS").delete().eq("id", f.id);
    if (error) { toast("Erro ao excluir: " + error.message, "err"); return; }
    toast("Formulário excluído.", "ok");
    load();
  };

  const termo = busca.trim().toLowerCase();
  const filtrados = !termo ? forms : forms.filter(f => [f.titulo, f.descricao, f.slug].some(v => String(v ?? "").toLowerCase().includes(termo)));
  const ativos = forms.filter(f => situacao(f, contagens[f.id] || 0).chave === "ativo");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f7fb" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", margin: "18px 24px 0", border: "1px solid #e2e8f0", borderRadius: 18, background: "linear-gradient(135deg,#fff 0%,#f8fbff 100%)", boxShadow: "0 8px 24px rgba(15,23,42,.06)", flexShrink: 0, gap: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, color: "#0f3171" }}>📋 Nascimento Formulários</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Crie formulários e pesquisas, publique numa URL e acompanhe as respostas.</div>
        </div>
        <button onClick={() => { setNovoTitulo(""); setCriando(true); }} style={btn("#0f3171")}>+ Novo formulário</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 24px" }}>
        {/* URLs ativas no momento */}
        {ativos.length > 0 && (
          <div style={{ marginBottom: 18, border: "1px solid #bbf7d0", borderRadius: 14, background: "#f0fdf4", padding: "12px 16px" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#15803d", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>🔗 URLs ativas no momento ({ativos.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ativos.map(f => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{f.titulo}</span>
                  <a href={urlPublica(f.slug)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: "#0369a1", wordBreak: "break-all" }}>{urlPublica(f.slug)}</a>
                  <button onClick={() => copiarUrl(f)} style={btn("#fff", "#15803d", "1px solid #86efac")}>Copiar</button>
                  {f.encerra_em && <span style={{ fontSize: 11, color: "#a16207" }}>até {fmtDt(f.encerra_em)}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <input placeholder="Buscar formulário..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, color: "#0f172a", fontSize: 12, padding: "9px 12px", outline: "none", width: "100%", maxWidth: 420, marginBottom: 14, boxShadow: "0 8px 24px rgba(15,23,42,.06)" }} />

        {loading ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#94a3b8" }}>Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#94a3b8" }}>Nenhum formulário ainda. Clique em <b>+ Novo formulário</b> para começar.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 14, alignItems: "start" }}>
            {filtrados.map(f => {
              const sit = situacao(f, contagens[f.id] || 0);
              const n = contagens[f.id] || 0;
              return (
                <div key={f.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 24px rgba(15,23,42,.06)" }}>
                  {f.imagem_capa_url && <div style={{ height: 84, background: `url(${f.imagem_capa_url}) center/cover` }} />}
                  <div style={{ height: 3, background: sit.chave === "ativo" ? "#16a34a" : sit.chave === "rascunho" ? "#94a3b8" : "#f59e0b" }} />
                  <div style={{ padding: "13px 15px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{f.titulo}</div>
                      <span style={{ fontSize: 10.5, fontWeight: 800, padding: "3px 9px", borderRadius: 20, background: sit.bg, color: sit.c, whiteSpace: "nowrap" }}>{sit.rotulo}</span>
                    </div>
                    {f.descricao && <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{f.descricao}</div>}
                    <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
                      <span>📬 <b style={{ color: "#0f172a" }}>{n}</b> resposta(s){f.max_respostas != null ? ` · limite ${f.max_respostas}` : ""}</span>
                      <span>🗓 {f.inicia_em || f.encerra_em ? `${f.inicia_em ? "de " + fmtDt(f.inicia_em) : ""} ${f.encerra_em ? "até " + fmtDt(f.encerra_em) : ""}` : "sem prazo definido"}</span>
                      <span>por {f.criado_por_nome || "—"} · criado em {fmtDt(f.created_at)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 11 }}>
                      <button onClick={() => nav(`/app/central-servicos/formularios/${f.id}`)} style={btn("#0f3171")}>✏️ Editar</button>
                      <button onClick={() => nav(`/app/central-servicos/formularios/${f.id}/respostas`)} style={btn("rgba(59,130,246,.1)", "#2563eb", "1px solid rgba(59,130,246,.3)")}>📊 Respostas</button>
                      {f.status !== "publicado" && <button onClick={() => mudarStatus(f, "publicado")} style={btn("#16a34a")}>Publicar</button>}
                      {f.status === "publicado" && <>
                        <button onClick={() => copiarUrl(f)} style={btn("#fff", "#475569", "1px solid #e2e8f0")}>🔗 Copiar URL</button>
                        <button onClick={() => mudarStatus(f, "encerrado")} style={btn("rgba(220,38,38,.08)", "#dc2626", "1px solid rgba(220,38,38,.25)")}>Encerrar</button>
                      </>}
                      {f.status === "encerrado" && <button onClick={() => mudarStatus(f, "publicado")} style={btn("#16a34a")}>Reabrir</button>}
                      <button onClick={() => duplicar(f)} style={btn("#fff", "#475569", "1px solid #e2e8f0")}>Duplicar</button>
                      <button onClick={() => excluir(f)} style={btn("transparent", "#94a3b8")}>Excluir</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: novo formulário */}
      {criando && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 900 }} onClick={() => setCriando(false)}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 22, width: 440, maxWidth: "92vw", position: "relative" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Novo formulário</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>Dê um título — você monta as perguntas na próxima tela.</div>
            <input autoFocus placeholder="Ex.: Pesquisa de Clima 2026" value={novoTitulo} onChange={e => setNovoTitulo(e.target.value)}
              onKeyDown={e => e.key === "Enter" && criar()}
              style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", fontSize: 13.5, outline: "none" }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setCriando(false)} style={btn("#fff", "#475569", "1px solid #e2e8f0")}>Cancelar</button>
              <button onClick={criar} style={btn("#0f3171")}>Criar e montar →</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ position: "fixed", bottom: 18, right: 18, display: "flex", flexDirection: "column", gap: 8, zIndex: 999 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background: t.t === "err" ? "#fee2e2" : t.t === "ok" ? "#dcfce7" : "#e0f2fe", color: t.t === "err" ? "#b91c1c" : t.t === "ok" ? "#15803d" : "#0369a1", padding: "10px 16px", borderRadius: 12, fontSize: 12.5, fontWeight: 700, boxShadow: "0 8px 24px rgba(15,23,42,.15)", maxWidth: 380 }}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}
