import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// =====================================================================
// NASCIMENTO FORMULÁRIOS - Ficha do empregado (a partir de um nome citado
// numa resposta). Puxa os dados AO VIVO da tabela EMPREGADOS (cadastro,
// líder) e cruza TODOS os formulários em que a pessoa participou - como
// respondente ou citada numa resposta (colaborador/líder).
// Read-only: nenhuma alteração de dados.
// =====================================================================

// Normaliza nome p/ casar respostas (texto livre) com o cadastro:
// sem acento, espaços colapsados, maiúsculas.
export const normNome = (s: any) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

const parseData = (v: any): Date | null => {
  if (!v) return null;
  const s = String(v).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return new Date(+br[3], +br[2] - 1, +br[1]);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};
const fmtData = (v: any) => { const d = parseData(v); return d ? d.toLocaleDateString("pt-BR") : "—"; };
const tempoDeCasa = (v: any): string | null => {
  const d = parseData(v); if (!d) return null;
  let meses = (Date.now() - d.getTime()) / (365.25 / 12 * 864e5);
  if (meses < 0) meses = 0;
  const anos = Math.floor(meses / 12), m = Math.floor(meses % 12);
  const pa = anos ? `${anos} ano${anos > 1 ? "s" : ""}` : "";
  const pm = m ? `${m} ${m > 1 ? "meses" : "mês"}` : "";
  return [pa, pm].filter(Boolean).join(" e ") || "menos de 1 mês";
};
const nomeCargoDe = (e: any): string =>
  String(e?.["Nome do Cargo"] ?? "").trim() || String(e?.["Título do Cargo"] ?? "").trim() || String(e?.["Cargo"] ?? "").trim() || "—";
const val = (v: any) => { const s = v == null ? "" : String(v).trim(); return s || "—"; };

// Busca 1 empregado pelo nome (ilike exato pega diferença de caixa; fallback por trecho).
const buscaEmpregado = async (n: string) => {
  let { data } = await (supabase as any).from("EMPREGADOS").select("*").ilike("Nome", n).limit(8);
  if (!data?.length) ({ data } = await (supabase as any).from("EMPREGADOS").select("*").ilike("Nome", "%" + n + "%").limit(20));
  const arr = data ?? [];
  return arr.find((e: any) => normNome(e["Nome"]) === normNome(n)) ?? arr[0] ?? null;
};

interface Participacao {
  formId: string; titulo: string;
  comoRespondente: boolean; perguntas: string[]; total: number;
}

const btn = (bg: string, c = "#fff", border = "none"): React.CSSProperties =>
  ({ padding: "6px 12px", borderRadius: 9, border, background: bg, color: c, fontSize: 12, fontWeight: 700, cursor: "pointer" });

function Campo({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div style={{ background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 10, padding: "8px 11px" }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".4px" }}>{rotulo}</div>
      <div style={{ fontSize: 12.5, color: cor || "#0f172a", fontWeight: 600, marginTop: 2, wordBreak: "break-word" }}>{valor}</div>
    </div>
  );
}

export default function EmpregadoDetalheModal({ nome, onClose }: { nome: string; onClose: () => void }) {
  const nav = useNavigate();
  const [alvoNome, setAlvoNome] = useState(nome);           // pessoa exibida (troca ao clicar no líder)
  const [aba, setAba] = useState<"cadastro" | "formularios">("cadastro");
  const [emp, setEmp] = useState<any | null>(null);
  const [lider, setLider] = useState<any | null>(null);
  const [parts, setParts] = useState<Participacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setAlvoNome(nome); setAba("cadastro"); }, [nome]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const alvo = normNome(alvoNome);

      // 1. Empregado + 2. líder dele (coluna LIDER guarda o nome)
      let empRow: any = null, liderRow: any = null;
      try { empRow = await buscaEmpregado(alvoNome); } catch { /* RLS/coluna ausente: degrada */ }
      const liderNome = empRow?.["LIDER"];
      if (liderNome && normNome(liderNome) !== alvo) {
        try { liderRow = await buscaEmpregado(String(liderNome)); } catch { /* ignore */ }
      }

      // 3. Participação em formulários (respondente OU citado numa resposta)
      let participacoes: Participacao[] = [];
      try {
        const [fRes, rRes] = await Promise.all([
          (supabase as any).from("CS_FORMULARIOS").select("id,titulo,perguntas"),
          (supabase as any).from("CS_FORM_RESPOSTAS").select("id,formulario_id,respondente_nome,respondente_cadastro,itens"),
        ]);
        const forms = fRes.data ?? [];
        const titPorId: Record<string, string> = {};
        const pergsPorForm: Record<string, Record<string, string>> = {};
        forms.forEach((f: any) => {
          titPorId[f.id] = f.titulo;
          const m: Record<string, string> = {};
          (Array.isArray(f.perguntas) ? f.perguntas : []).forEach((p: any) => { if (p?.id) m[p.id] = p.titulo; });
          pergsPorForm[f.id] = m;
        });
        const acc: Record<string, Participacao> = {};
        (rRes.data ?? []).forEach((r: any) => {
          const fid = r.formulario_id;
          let hit = false, comoResp = false;
          const perguntas = new Set<string>();
          if (normNome(r.respondente_nome) === alvo || normNome(r.respondente_cadastro?.nome) === alvo) { hit = true; comoResp = true; }
          Object.entries(r.itens ?? {}).forEach(([pid, v]) => {
            const arr = Array.isArray(v) ? v : [v];
            if (arr.some(x => normNome(x) === alvo)) { hit = true; perguntas.add(pergsPorForm[fid]?.[pid] ?? "Resposta"); }
          });
          if (!hit) return;
          const p = acc[fid] ?? (acc[fid] = { formId: fid, titulo: titPorId[fid] ?? "Formulário", comoRespondente: false, perguntas: [], total: 0 });
          p.total++;
          if (comoResp) p.comoRespondente = true;
          perguntas.forEach(q => { if (!p.perguntas.includes(q)) p.perguntas.push(q); });
        });
        participacoes = Object.values(acc).sort((a, b) => b.total - a.total);
      } catch { /* ignore */ }

      if (cancel) return;
      setEmp(empRow); setLider(liderRow); setParts(participacoes); setLoading(false);
    })();
    return () => { cancel = true; };
  }, [alvoNome]);

  const irParaForm = (formId: string) => { onClose(); nav(`/app/central-servicos/formularios/${formId}/respostas`); };

  const sit = String(emp?.["Situação"] ?? "").trim();
  const sitTrab = sit.toUpperCase().startsWith("TRABALH");

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 950, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: 640, maxWidth: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 14, border: "none", background: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8", zIndex: 2 }}>×</button>

        {/* Cabeçalho */}
        <div style={{ padding: "18px 22px 0" }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#0f3171" }}>👤 {emp?.["Nome"] || alvoNome}</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
            {loading ? "Carregando ficha…" : emp ? `${nomeCargoDe(emp)}${emp["Setor_ERP"] ? " · " + emp["Setor_ERP"] : ""}` : "Não localizado no cadastro de empregados"}
          </div>
          <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 10, padding: 3, marginTop: 12, width: "fit-content" }}>
            {(["cadastro", "formularios"] as const).map(a => (
              <button key={a} onClick={() => setAba(a)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: aba === a ? "#fff" : "transparent", color: aba === a ? "#0f3171" : "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: aba === a ? "0 2px 6px rgba(15,23,42,.08)" : "none" }}>
                {a === "cadastro" ? "Cadastro" : `Formulários${parts.length ? ` (${parts.length})` : ""}`}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "14px 22px 22px" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Carregando…</div>
          ) : aba === "cadastro" ? (
            !emp ? (
              <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: "14px 16px", fontSize: 12.5, color: "#9a3412" }}>
                Não encontramos <b>{alvoNome}</b> no cadastro de empregados (EMPREGADOS). O nome pode não corresponder exatamente a um colaborador (ex.: setor, gerência ou grafia diferente).
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: sitTrab ? "#dcfce7" : "#fee2e2", color: sitTrab ? "#15803d" : "#b91c1c" }}>{sit || "—"}</span>
                  {emp["Nome da Empresa"] && <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: "#eef2ff", color: "#4338ca" }}>{emp["Nome da Empresa"]}</span>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <Campo rotulo="CPF" valor={val(emp["CPF"])} />
                  <Campo rotulo="Admissão" valor={fmtData(emp["Admissão"])} />
                  <Campo rotulo="Tempo de casa" valor={tempoDeCasa(emp["Admissão"]) ?? "—"} cor="#0f3171" />
                  <Campo rotulo="Cargo" valor={nomeCargoDe(emp)} />
                  <Campo rotulo="Setor" valor={val(emp["Setor_ERP"])} />
                  <Campo rotulo="Perfil" valor={val(emp["Perfil_ERP"])} />
                  <Campo rotulo="Filial" valor={val(emp["Nome Filial"])} />
                  <Campo rotulo="Centro de custo" valor={[emp["C.Custo"], emp["Titulo C.Custo"]].filter(Boolean).join(" — ") || "—"} />
                  {emp["Data Afastamento"] && <Campo rotulo="Afastamento" valor={fmtData(emp["Data Afastamento"])} />}
                  <Campo rotulo="E-mail" valor={val(emp["email"])} />
                </div>

                {/* Líder */}
                <div style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", margin: "16px 0 8px" }}>Líder</div>
                {emp["LIDER"] ? (
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "11px 13px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#0f3171", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, flexShrink: 0 }}>
                      {String(emp["LIDER"]).trim().charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{emp["LIDER"]}</div>
                      <div style={{ fontSize: 11.5, color: "#64748b" }}>
                        {lider ? `${nomeCargoDe(lider)}${lider["Setor_ERP"] ? " · " + lider["Setor_ERP"] : ""}` : "Não localizado no cadastro"}
                      </div>
                    </div>
                    {lider && <button onClick={() => setAlvoNome(lider["Nome"])} style={btn("rgba(15,49,113,.08)", "#0f3171", "1px solid rgba(15,49,113,.2)")}>Ver ficha</button>}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>Sem líder no cadastro.</div>
                )}
              </>
            )
          ) : (
            // Aba Formulários
            parts.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "#94a3b8", fontSize: 12.5 }}>
                Nenhum formulário encontrado com <b>{alvoNome}</b> (como respondente ou citado numa resposta).
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 12, color: "#64748b" }}>Participou de <b style={{ color: "#0f172a" }}>{parts.length}</b> formulário(s):</div>
                {parts.map(p => (
                  <div key={p.formId} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "11px 13px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{p.titulo}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5 }}>
                        {p.comoRespondente && <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: "#dcfce7", color: "#15803d" }}>Respondeu</span>}
                        {p.perguntas.map((q, i) => (
                          <span key={i} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#eef2ff", color: "#4338ca" }}>Citado em: {q}</span>
                        ))}
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#f1f5f9", color: "#64748b" }}>{p.total} resposta(s)</span>
                      </div>
                    </div>
                    <button onClick={() => irParaForm(p.formId)} style={btn("rgba(59,130,246,.1)", "#2563eb", "1px solid rgba(59,130,246,.3)")}>📊 Ver respostas</button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
