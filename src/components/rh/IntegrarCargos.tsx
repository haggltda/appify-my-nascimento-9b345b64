import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, FileSpreadsheet, CheckCircle2, AlertTriangle, X, RefreshCw } from "lucide-react";

// =========================================================================
// RH - Colaboradores: "Integrar Cargos". Lê uma planilha de referência com
// colunas "Cargo" (código) e "Nome do Cargo" (nome legível) e preenche
// EMPREGADOS."Nome do Cargo", casando por EMPREGADOS."Cargo" (bigint - o
// código real, confirmado no schema; NÃO é "Título do Cargo", que é outro
// campo texto).
//
// A planilha de referência tem código com e sem zero à esquerda (ex.: "225"
// e "0225") que, como "Cargo" no banco é bigint, colapsam pro MESMO número -
// e às vezes apontam pra nomes de cargo diferentes. Esses códigos ficam
// separados como "ambíguos" e NÃO são aplicados automaticamente.
// =========================================================================

const norm = (s: string) => s.trim().toLowerCase();

// "0225" / "225" / 225 → 225. NaN se não for um código numérico.
const normCod = (v: any): number => {
  const s = String(v ?? "").trim();
  if (!s) return NaN;
  return Number(s);
};

type Previa = {
  totalPlanilha: number;
  totalEmpregados: number;
  aAtualizar: { id: any; nome: string }[];
  jaOk: number;
  semCargo: number;
  semCorrespondencia: Record<string, number>; // código sem match na planilha → nº de empregados
  ambiguos: Record<string, { nomes: string[]; n: number }>; // código ambíguo na planilha → nomes possíveis + nº de empregados afetados
};

export default function IntegrarCargos({ rows, onImported }: { rows: any[]; onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fase, setFase] = useState<"idle" | "lendo" | "previa" | "aplicando" | "fim">("idle");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [prog, setProg] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const abrir = () => { setOpen(true); setFase("idle"); setPrevia(null); setErro(null); setProg(""); };
  const fechar = () => { if (fase === "aplicando" || fase === "lendo") return; setOpen(false); };
  const escolher = () => fileRef.current?.click();

  const lerArquivo = async (file: File) => {
    setErro(null); setFase("lendo");
    try {
      const XLSX: any = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: null });
      if (raw.length === 0) throw new Error("Planilha vazia.");

      const keys = Object.keys(raw[0]);
      const kCargo = keys.find(k => norm(k) === "cargo");
      const kNome = keys.find(k => norm(k) === "nome do cargo");
      if (!kCargo || !kNome) {
        throw new Error('A planilha precisa ter as colunas "Cargo" e "Nome do Cargo".');
      }

      // Código (número) → nome do cargo. Código que aparece com nomes
      // diferentes na planilha (colisão de "0225"/"225" etc.) vira ambíguo.
      const mapa = new Map<number, string>();
      const ambiguosMapa = new Map<number, Set<string>>();
      for (const r of raw) {
        const cod = normCod(r[kCargo]);
        const nome = String(r[kNome] ?? "").trim();
        if (!Number.isFinite(cod) || !nome) continue;
        if (mapa.has(cod) && mapa.get(cod) !== nome) {
          const s = ambiguosMapa.get(cod) || new Set([mapa.get(cod)!]);
          s.add(nome); ambiguosMapa.set(cod, s);
        }
        mapa.set(cod, nome);
      }
      for (const cod of ambiguosMapa.keys()) mapa.delete(cod); // ambíguo: não usa nenhum dos nomes

      const aAtualizar: { id: any; nome: string }[] = [];
      const semCorrespondencia: Record<string, number> = {};
      const ambiguos: Record<string, { nomes: string[]; n: number }> = {};
      let jaOk = 0, semCargo = 0;

      for (const e of rows) {
        const cod = normCod(e["Cargo"]);
        if (!Number.isFinite(cod)) {
          semCargo++;
          if (String(e["Nome do Cargo"] ?? "").trim() === "Vazio") jaOk++;
          else aAtualizar.push({ id: e["ID"], nome: "Vazio" });
          continue;
        }
        if (ambiguosMapa.has(cod)) {
          const k = String(cod);
          const nomes = Array.from(ambiguosMapa.get(cod)!);
          ambiguos[k] = { nomes, n: (ambiguos[k]?.n || 0) + 1 };
          continue;
        }
        const nome = mapa.get(cod);
        if (!nome) {
          const k = String(cod);
          semCorrespondencia[k] = (semCorrespondencia[k] || 0) + 1;
          continue;
        }
        if (String(e["Nome do Cargo"] ?? "").trim() === nome) { jaOk++; continue; }
        aAtualizar.push({ id: e["ID"], nome });
      }

      setPrevia({
        totalPlanilha: mapa.size,
        totalEmpregados: rows.length,
        aAtualizar,
        jaOk,
        semCargo,
        semCorrespondencia,
        ambiguos,
      });
      setFase("previa");
    } catch (e: any) {
      setErro(e?.message || String(e)); setFase("idle");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const aplicar = async () => {
    if (!previa) return;
    setFase("aplicando"); setErro(null);
    try {
      // Agrupa por nome do cargo alvo pra minimizar chamadas.
      const porNome = new Map<string, any[]>();
      for (const u of previa.aAtualizar) { const a = porNome.get(u.nome) || []; a.push(u.id); porNome.set(u.nome, a); }

      let ok = 0;
      const total = previa.aAtualizar.length;
      for (const [nome, ids] of porNome) {
        for (let i = 0; i < ids.length; i += 300) {
          const chunk = ids.slice(i, i + 300);
          const { error } = await (supabase as any).from("EMPREGADOS").update({ "Nome do Cargo": nome }).in("ID", chunk);
          if (error) throw new Error("Atualização de cargo: " + error.message);
          ok += chunk.length; setProg(`Atualizando cargos… ${ok}/${total}`);
        }
      }

      setProg(`${ok} colaborador(es) atualizado(s) com o nome do cargo.`);
      setFase("fim");
      onImported();
    } catch (e: any) {
      setErro(e?.message || String(e)); setFase("previa");
    }
  };

  const semCorrespondenciaList = previa ? Object.entries(previa.semCorrespondencia).sort((a, b) => b[1] - a[1]) : [];
  const ambiguosList = previa ? Object.entries(previa.ambiguos).sort((a, b) => b[1].n - a[1].n) : [];

  return (
    <>
      <button className="col-btn" onClick={abrir} style={{ background: "#0f3171", color: "#fff", borderColor: "#0f3171", display: "inline-flex", alignItems: "center", gap: 7 }}>
        <Briefcase size={15} /> Integrar Cargos
      </button>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) lerArquivo(f); }} />

      {open && (
        <div onClick={ev => { if (ev.target === ev.currentTarget) fechar(); }}
          style={{ position: "fixed", inset: 0, zIndex: 800, background: "rgba(15,23,42,.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 640, maxHeight: "90vh", display: "flex", flexDirection: "column", position: "relative" }}>
            {fase !== "aplicando" && fase !== "lendo" && (
              <button onClick={fechar} style={{ position: "absolute", top: 14, right: 16, border: "none", background: "none", color: "#94a3b8", cursor: "pointer", zIndex: 1 }}><X size={20} /></button>
            )}
            <div style={{ padding: "20px 22px 12px" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 9 }}>
                <Briefcase size={20} color="#0f3171" /> Integrar Cargos
              </div>
              <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>
                Lê uma planilha com as colunas <b>Cargo</b> (código) e <b>Nome do Cargo</b>, casa com o código gravado em <b>Cargo</b> de cada colaborador e preenche a coluna <b>Nome do Cargo</b>.
              </div>
            </div>

            <div style={{ padding: "0 22px 4px", overflowY: "auto", flex: 1 }}>
              {erro && (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, marginBottom: 12 }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{erro}</span>
                </div>
              )}

              {fase === "idle" && (
                <button onClick={escolher} style={{ width: "100%", border: "2px dashed #c7d2e5", background: "#f8fbff", borderRadius: 14, padding: "34px 16px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: "#0f3171" }}>
                  <FileSpreadsheet size={30} />
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Selecionar planilha de cargos (.xlsx)</div>
                  <div style={{ fontSize: 12, color: "#64748b", textAlign: "center", maxWidth: 400 }}>
                    Ex.: CARGOS.xlsx, com colunas "Cargo" (código) e "Nome do Cargo".
                  </div>
                </button>
              )}

              {fase === "lendo" && <div style={{ padding: "40px 0", textAlign: "center", color: "#64748b", fontSize: 13.5 }}>Lendo planilha…</div>}

              {(fase === "previa" || fase === "fim") && previa && (
                <>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                    <ResumoCard cor="#15803d" n={previa.aAtualizar.length} label="a atualizar" />
                    <ResumoCard cor="#64748b" n={previa.jaOk} label="já preenchidos" />
                    <ResumoCard cor="#b45309" n={Object.values(previa.semCorrespondencia).reduce((s, v) => s + v, 0)} label="sem correspondência" />
                    <ResumoCard cor="#dc2626" n={Object.values(previa.ambiguos).reduce((s, v) => s + v.n, 0)} label="código ambíguo" />
                  </div>
                  <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 12 }}>
                    {previa.totalPlanilha.toLocaleString("pt-BR")} cargo(s) únicos na planilha · {previa.totalEmpregados.toLocaleString("pt-BR")} colaborador(es) no total
                    {previa.semCargo > 0 && ` · ${previa.semCargo} sem código de cargo (marcados como "Vazio")`}
                  </div>

                  {ambiguosList.length > 0 && (
                    <div style={{ border: "1px solid #fecaca", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#dc2626", textTransform: "uppercase", letterSpacing: ".4px", padding: "9px 12px", background: "#fef2f2", borderBottom: "1px solid #fecaca" }}>
                        Códigos ambíguos na planilha (não aplicados - mesmo código com nomes diferentes)
                      </div>
                      <div style={{ maxHeight: 180, overflowY: "auto" }}>
                        {ambiguosList.map(([k, v]) => (
                          <div key={k} style={{ padding: "8px 12px", fontSize: 12.5, borderTop: "1px solid #f1f5f9", color: "#334155" }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span>Código <b>{k}</b></span><span style={{ fontWeight: 800, color: "#0f172a" }}>{v.n} colaborador(es)</span>
                            </div>
                            <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>{v.nomes.join(" · ")}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {semCorrespondenciaList.length > 0 && (
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#b45309", textTransform: "uppercase", letterSpacing: ".4px", padding: "9px 12px", background: "#fffbeb", borderBottom: "1px solid #fde68a" }}>
                        Códigos sem correspondência na planilha
                      </div>
                      <div style={{ maxHeight: 210, overflowY: "auto" }}>
                        {semCorrespondenciaList.map(([k, v]) => (
                          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 12px", fontSize: 12.5, borderTop: "1px solid #f1f5f9", color: "#334155" }}>
                            <span>{k || "(vazio)"}</span><span style={{ fontWeight: 800, color: "#0f172a" }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {fase === "fim" && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#ecfdf3", border: "1px solid #86efac", color: "#15803d", borderRadius: 10, padding: "12px 14px", fontSize: 13, fontWeight: 600, margin: "12px 0" }}>
                      <CheckCircle2 size={18} /> {prog || "Integração concluída."}
                    </div>
                  )}
                </>
              )}

              {fase === "aplicando" && (
                <div style={{ padding: "34px 0", textAlign: "center" }}>
                  <RefreshCw size={26} color="#0f3171" style={{ animation: "spin 1s linear infinite" }} />
                  <div style={{ fontSize: 13.5, color: "#334155", marginTop: 12, fontWeight: 600 }}>{prog || "Aplicando…"}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Não feche esta janela.</div>
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 22px", borderTop: "1px solid #e2e8f0" }}>
              {fase === "previa" && (
                <>
                  <button className="col-btn" onClick={fechar}>Cancelar</button>
                  <button className="col-btn" onClick={aplicar} disabled={previa != null && previa.aAtualizar.length === 0}
                    style={{ background: "#0f3171", color: "#fff", borderColor: "#0f3171", opacity: previa != null && previa.aAtualizar.length === 0 ? .5 : 1 }}>
                    Aplicar integração
                  </button>
                </>
              )}
              {fase === "idle" && <button className="col-btn" onClick={fechar}>Fechar</button>}
              {fase === "fim" && <button className="col-btn" onClick={fechar} style={{ background: "#0f3171", color: "#fff", borderColor: "#0f3171" }}>Fechar</button>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ResumoCard({ cor, n, label }: { cor: string; n: number; label: string }) {
  return (
    <div style={{ flex: 1, minWidth: 130, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: cor }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>{n.toLocaleString("pt-BR")}</div>
    </div>
  );
}
