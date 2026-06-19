import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// =====================================================================
// PORTAL PÚBLICO DE VAGAS / CANDIDATURA  (rota /vagas — sem login)
// Fluxo: escolher cidade → ver vagas da cidade → enviar currículo.
// Tudo via RPCs SECURITY DEFINER (portal_*) + upload no bucket 'curriculos'.
// =====================================================================

interface Cidade { cidade: string; vagas: number; }
interface Vaga {
  id: number; cargo: string; contrato: string; cidade: string;
  escala: string; salario: string; beneficios: string; quantidade_vagas: number;
}

const maskCpf = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};
const maskFone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
};
// Normaliza para busca (ignora acento e caixa): "são" casa com "Sao".
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const MAX_MB = 8;
const ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png";

export default function Vagas() {
  const [step, setStep] = useState<"cidade" | "vagas" | "form" | "ok">("cidade");
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [loadingCid, setLoadingCid] = useState(true);
  const [cidade, setCidade] = useState("");
  const [buscaCidade, setBuscaCidade] = useState("");
  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [loadingVagas, setLoadingVagas] = useState(false);
  const [vaga, setVaga] = useState<Vaga | null>(null);

  const [form, setForm] = useState({ nome: "", telefone: "", email: "", cpf: "", mensagem: "" });
  const [file, setFile] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // ── Carregar cidades com vaga ───────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoadingCid(true);
      const { data, error } = await (supabase as any).rpc("portal_cidades_com_vagas");
      setLoadingCid(false);
      if (!error && Array.isArray(data)) setCidades(data as Cidade[]);
    })();
  }, []);

  const escolherCidade = useCallback(async (c: string) => {
    setCidade(c); setStep("vagas"); setLoadingVagas(true); setVagas([]);
    const { data, error } = await (supabase as any).rpc("portal_vagas_por_cidade", { p_cidade: c });
    setLoadingVagas(false);
    if (!error && Array.isArray(data)) setVagas(data as Vaga[]);
  }, []);

  const abrirForm = (v: Vaga) => {
    setVaga(v); setErro(null); setFile(null);
    setForm({ nome: "", telefone: "", email: "", cpf: "", mensagem: "" });
    setStep("form");
  };

  const enviar = async () => {
    setErro(null);
    if (!vaga) return;
    if (!form.nome.trim()) return setErro("Informe seu nome completo.");
    if (form.telefone.replace(/\D/g, "").length < 10) return setErro("Informe um telefone válido com DDD.");
    if (form.cpf.replace(/\D/g, "").length !== 11) return setErro("Informe um CPF válido.");
    if (!file) return setErro("Anexe o seu currículo (PDF, DOC, DOCX, JPG ou PNG).");
    if (file.size > MAX_MB * 1024 * 1024) return setErro(`Arquivo muito grande. Máximo ${MAX_MB} MB.`);

    setEnviando(true);
    // 1) Upload do arquivo no bucket privado 'curriculos'.
    const safe = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${vaga.id}/${Date.now()}_${safe}`;
    const { error: upErr } = await supabase.storage.from("curriculos").upload(path, file, { upsert: false });
    if (upErr) { setEnviando(false); return setErro("Falha ao enviar o arquivo. Tente novamente."); }

    // 2) Registra a candidatura (valida a vaga e grava em WA_CURRICULOS).
    const { data, error } = await (supabase as any).rpc("portal_candidatar", {
      p_vaga_id: vaga.id, p_nome: form.nome, p_telefone: form.telefone,
      p_email: form.email, p_cpf: form.cpf, p_mensagem: form.mensagem,
      p_arquivo_nome: file.name, p_storage_path: path,
    });
    setEnviando(false);
    if (error) return setErro(error.message || "Não foi possível registrar sua candidatura.");
    if (!data?.ok) return setErro(data?.error || "Não foi possível registrar sua candidatura.");
    setStep("ok");
  };

  const cidadesFiltradas = cidades.filter(c => norm(c.cidade).includes(norm(buscaCidade)));

  return (
    <div className="pv-wrap">
      <style>{`
        .pv-wrap{min-height:100vh;background:linear-gradient(180deg,#0f3171 0%,#0f3171 230px,#f1f5f9 230px,#f1f5f9 100%);font-family:Inter,system-ui,sans-serif;padding:0 0 60px}
        .pv-top{max-width:760px;margin:0 auto;padding:34px 20px 0;color:#fff}
        .pv-badge{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);border-radius:30px;padding:4px 12px}
        .pv-h1{font-size:26px;font-weight:800;margin:14px 0 6px}
        .pv-sub{font-size:14px;opacity:.85;max-width:520px;line-height:1.5}
        .pv-card{max-width:760px;margin:22px auto 0;background:#fff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 16px 40px rgba(15,23,42,.12);overflow:hidden}
        .pv-card-hd{padding:16px 22px;border-bottom:1px solid #eef2f7;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
        .pv-card-hd h2{font-size:16px;font-weight:800;color:#0f172a;margin:0}
        .pv-back{background:none;border:none;color:#0f3171;font-size:13px;font-weight:700;cursor:pointer;padding:0}
        .pv-body{padding:22px}
        .pv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
        .pv-tile{text-align:left;border:1px solid #e2e8f0;border-radius:14px;padding:16px;background:#fff;cursor:pointer;transition:.15s;box-shadow:0 6px 18px rgba(15,23,42,.04)}
        .pv-tile:hover{border-color:#0f3171;box-shadow:0 10px 26px rgba(15,49,113,.12);transform:translateY(-1px)}
        .pv-tile .city{font-size:15px;font-weight:800;color:#0f172a}
        .pv-tile .n{font-size:12px;color:#64748b;margin-top:3px}
        .pv-vaga{border:1px solid #e2e8f0;border-radius:14px;padding:16px 18px;margin-bottom:12px;background:#fff;box-shadow:0 6px 18px rgba(15,23,42,.04)}
        .pv-vaga .cargo{font-size:16px;font-weight:800;color:#0f172a}
        .pv-vaga .meta{font-size:12px;color:#64748b;margin-top:4px;display:flex;flex-wrap:wrap;gap:10px}
        .pv-vaga .meta b{color:#334155;font-weight:700}
        .pv-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
        .pv-tag{font-size:11px;font-weight:600;color:#0f3171;background:#eef4ff;border:1px solid #dbe4f0;border-radius:7px;padding:3px 9px}
        .pv-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:13px}
        .pv-btn-pri{background:#f97316;color:#fff;padding:10px 18px;box-shadow:0 10px 22px rgba(249,115,22,.25)}
        .pv-btn-pri:disabled{opacity:.6;cursor:not-allowed}
        .pv-fg{margin-bottom:14px}
        .pv-fg label{display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:6px}
        .pv-fi{width:100%;height:42px;border:1px solid #cbd5e1;border-radius:10px;padding:0 12px;font-size:14px;background:#fff;box-sizing:border-box}
        textarea.pv-fi{height:auto;padding:10px 12px;resize:vertical}
        .pv-fi:focus{outline:none;border-color:#0f3171;box-shadow:0 0 0 4px rgba(15,49,113,.08)}
        .pv-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .pv-file{border:1.5px dashed #cbd5e1;border-radius:12px;padding:16px;text-align:center;font-size:13px;color:#64748b;cursor:pointer;display:block}
        .pv-file b{color:#0f3171}
        .pv-err{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:10px;padding:10px 14px;font-size:13px;margin-bottom:14px}
        .pv-empty{text-align:center;color:#64748b;padding:40px 20px}
        .pv-ok{text-align:center;padding:46px 24px}
        .pv-ok .ico{font-size:52px}
        .pv-ok h2{font-size:20px;font-weight:800;color:#0f172a;margin:12px 0 6px}
        .pv-ok p{font-size:14px;color:#64748b;max-width:420px;margin:0 auto 18px;line-height:1.6}
        .pv-search{width:100%;height:46px;border:1px solid #cbd5e1;border-radius:10px;padding:0 14px;font-size:15px;background:#fff;box-sizing:border-box;margin-bottom:14px}
        .pv-search:focus{outline:none;border-color:#0f3171;box-shadow:0 0 0 4px rgba(15,49,113,.08)}
        @media(max-width:600px){
          .pv-top{padding:22px 16px 0}
          .pv-h1{font-size:21px}
          .pv-sub{font-size:13px}
          .pv-card{margin:16px 12px 0;border-radius:14px}
          .pv-card-hd{padding:14px 16px}
          .pv-body{padding:16px}
          .pv-grid{grid-template-columns:1fr;gap:10px}
          .pv-row{grid-template-columns:1fr}
          .pv-fi,.pv-search{font-size:16px}
          .pv-vaga .meta{gap:4px 12px}
        }
      `}</style>

      <div className="pv-top">
        <span className="pv-badge">Trabalhe conosco</span>
        <div className="pv-h1">Vagas abertas</div>
        <div className="pv-sub">Escolha a cidade, veja as vagas disponíveis e envie seu currículo. Leva menos de 2 minutos.</div>
      </div>

      {/* Passo 1 — Cidade */}
      {step === "cidade" && (
        <div className="pv-card">
          <div className="pv-card-hd"><h2>1. Selecione a cidade</h2></div>
          <div className="pv-body">
            {loadingCid ? (
              <div className="pv-empty">Carregando cidades…</div>
            ) : cidades.length === 0 ? (
              <div className="pv-empty">Nenhuma vaga aberta no momento. Volte em breve! 🙂</div>
            ) : (
              <>
                <input className="pv-search" value={buscaCidade} onChange={e => setBuscaCidade(e.target.value)}
                  placeholder="🔎 Buscar cidade…" inputMode="search" />
                {cidadesFiltradas.length === 0 ? (
                  <div className="pv-empty">Nenhuma cidade encontrada para “{buscaCidade}”.</div>
                ) : (
                  <div className="pv-grid">
                    {cidadesFiltradas.map(c => (
                      <button key={c.cidade} className="pv-tile" onClick={() => escolherCidade(c.cidade)}>
                        <div className="city">📍 {c.cidade}</div>
                        <div className="n">{c.vagas} vaga{c.vagas > 1 ? "s" : ""} disponível{c.vagas > 1 ? "is" : ""}</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Passo 2 — Vagas da cidade */}
      {step === "vagas" && (
        <div className="pv-card">
          <div className="pv-card-hd">
            <h2>2. Vagas em {cidade}</h2>
            <button className="pv-back" onClick={() => setStep("cidade")}>← trocar cidade</button>
          </div>
          <div className="pv-body">
            {loadingVagas ? (
              <div className="pv-empty">Carregando vagas…</div>
            ) : vagas.length === 0 ? (
              <div className="pv-empty">Nenhuma vaga aberta nesta cidade agora.</div>
            ) : vagas.map(v => (
              <div key={v.id} className="pv-vaga">
                <div className="cargo">{v.cargo}</div>
                <div className="meta">
                  {v.contrato && <span><b>Contrato:</b> {v.contrato}</span>}
                  {v.escala && <span><b>Escala:</b> {v.escala}</span>}
                  {v.salario && <span><b>Salário:</b> {v.salario}</span>}
                  {v.quantidade_vagas > 1 && <span><b>Vagas:</b> {v.quantidade_vagas}</span>}
                </div>
                {v.beneficios && <div className="pv-tags">{v.beneficios.split(/[;,]/).map((b, i) => b.trim() && <span key={i} className="pv-tag">{b.trim()}</span>)}</div>}
                <div style={{ marginTop: 14 }}>
                  <button className="pv-btn pv-btn-pri" onClick={() => abrirForm(v)}>Candidatar-se →</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Passo 3 — Formulário */}
      {step === "form" && vaga && (
        <div className="pv-card">
          <div className="pv-card-hd">
            <h2>3. Enviar currículo — {vaga.cargo}</h2>
            <button className="pv-back" onClick={() => setStep("vagas")}>← voltar</button>
          </div>
          <div className="pv-body">
            {erro && <div className="pv-err">{erro}</div>}
            <div className="pv-fg"><label>Nome completo *</label>
              <input className="pv-fi" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Seu nome" /></div>
            <div className="pv-row">
              <div className="pv-fg"><label>Telefone (WhatsApp) *</label>
                <input className="pv-fi" inputMode="numeric" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: maskFone(e.target.value) }))} placeholder="(51) 99999-9999" /></div>
              <div className="pv-fg"><label>CPF *</label>
                <input className="pv-fi" inputMode="numeric" value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: maskCpf(e.target.value) }))} placeholder="000.000.000-00" /></div>
            </div>
            <div className="pv-fg"><label>E-mail</label>
              <input className="pv-fi" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="seu@email.com (opcional)" /></div>
            <div className="pv-fg"><label>Mensagem</label>
              <textarea className="pv-fi" rows={3} value={form.mensagem} onChange={e => setForm(f => ({ ...f, mensagem: e.target.value }))} placeholder="Conte um pouco sobre você (opcional)" /></div>
            <div className="pv-fg"><label>Currículo * (PDF, DOC, DOCX, JPG ou PNG — até {MAX_MB} MB)</label>
              <label className="pv-file">
                <input type="file" accept={ACCEPT} style={{ display: "none" }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
                {file ? <span>📎 <b>{file.name}</b> ({(file.size / 1024 / 1024).toFixed(1)} MB)</span> : <span>Clique para <b>anexar seu currículo</b></span>}
              </label>
            </div>
            <button className="pv-btn pv-btn-pri" style={{ width: "100%" }} onClick={enviar} disabled={enviando}>
              {enviando ? "Enviando…" : "Enviar candidatura"}
            </button>
          </div>
        </div>
      )}

      {/* Passo 4 — Sucesso */}
      {step === "ok" && vaga && (
        <div className="pv-card">
          <div className="pv-ok">
            <div className="ico">✅</div>
            <h2>Candidatura enviada!</h2>
            <p>Recebemos seu currículo para a vaga de <b>{vaga.cargo}</b> em {vaga.cidade}. Nossa equipe de recrutamento entrará em contato caso seu perfil seja selecionado. Boa sorte!</p>
            <button className="pv-btn pv-btn-pri" onClick={() => { setVaga(null); setStep("cidade"); }}>Ver outras vagas</button>
          </div>
        </div>
      )}
    </div>
  );
}
