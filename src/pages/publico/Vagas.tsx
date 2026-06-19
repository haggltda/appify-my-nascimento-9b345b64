import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoGN from "@/assets/logo-grupo-nascimento.png";

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
    window.scrollTo({ top: 0, behavior: "smooth" });
    const { data, error } = await (supabase as any).rpc("portal_vagas_por_cidade", { p_cidade: c });
    setLoadingVagas(false);
    if (!error && Array.isArray(data)) setVagas(data as Vaga[]);
  }, []);

  const abrirForm = (v: Vaga) => {
    setVaga(v); setErro(null); setFile(null);
    setForm({ nome: "", telefone: "", email: "", cpf: "", mensagem: "" });
    setStep("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    const safe = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${vaga.id}/${Date.now()}_${safe}`;
    const { error: upErr } = await supabase.storage.from("curriculos").upload(path, file, { upsert: false });
    if (upErr) { setEnviando(false); return setErro("Falha ao enviar o arquivo. Tente novamente."); }

    const { data, error } = await (supabase as any).rpc("portal_candidatar", {
      p_vaga_id: vaga.id, p_nome: form.nome, p_telefone: form.telefone,
      p_email: form.email, p_cpf: form.cpf, p_mensagem: form.mensagem,
      p_arquivo_nome: file.name, p_storage_path: path,
    });
    setEnviando(false);
    if (error) return setErro(error.message || "Não foi possível registrar sua candidatura.");
    if (!data?.ok) return setErro(data?.error || "Não foi possível registrar sua candidatura.");
    setStep("ok");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cidadesFiltradas = cidades.filter(c => norm(c.cidade).includes(norm(buscaCidade)));
  const stepNum = step === "cidade" ? 1 : step === "vagas" ? 2 : 3;
  const STEPS = [{ n: 1, l: "Cidade" }, { n: 2, l: "Vaga" }, { n: 3, l: "Currículo" }];

  return (
    <div className="pv-wrap">
      <style>{`
        *{box-sizing:border-box}
        .pv-wrap{min-height:100vh;background:#eef2f7;font-family:Inter,system-ui,sans-serif;color:#0f172a}
        .pv-hero{position:relative;overflow:hidden;color:#fff;background:linear-gradient(135deg,#0b2350 0%,#0f3171 55%,#16407f 100%);padding:0 0 96px}
        .pv-glow{position:absolute;border-radius:50%;filter:blur(80px);opacity:.5;pointer-events:none}
        .pv-glow.a{top:-120px;right:-80px;width:340px;height:340px;background:#f97316}
        .pv-glow.b{bottom:-140px;left:-100px;width:340px;height:340px;background:#3b82f6}
        .pv-hero-in{position:relative;z-index:2;max-width:900px;margin:0 auto;padding:26px 22px 0}
        .pv-brand{display:flex;align-items:center;gap:12px}
        .pv-logo{height:48px;width:48px;border-radius:13px;background:rgba(255,255,255,.12);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.22);display:grid;place-items:center;padding:7px;flex-shrink:0}
        .pv-logo img{height:100%;width:100%;object-fit:contain}
        .pv-brand .nm{font-weight:800;font-size:15px;line-height:1.15}
        .pv-brand .sb{font-size:10px;text-transform:uppercase;letter-spacing:.2em;color:rgba(255,255,255,.6);margin-top:1px}
        .pv-badge{display:inline-flex;align-items:center;gap:7px;margin-top:30px;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);border-radius:30px;padding:5px 13px}
        .pv-badge .dot{width:7px;height:7px;border-radius:50%;background:#f97316}
        .pv-h1{font-size:34px;font-weight:800;line-height:1.1;margin:14px 0 10px;max-width:640px;letter-spacing:-.5px}
        .pv-sub{font-size:15px;color:rgba(255,255,255,.82);max-width:540px;line-height:1.55}
        .pv-steps{display:flex;gap:8px;margin-top:24px;flex-wrap:wrap}
        .pv-step{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;color:rgba(255,255,255,.6);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.13);border-radius:30px;padding:6px 14px 6px 6px}
        .pv-step .num{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:800;background:rgba(255,255,255,.12);color:#fff}
        .pv-step.on{color:#fff;background:rgba(249,115,22,.16);border-color:rgba(249,115,22,.55)}
        .pv-step.on .num{background:#f97316;color:#fff}
        .pv-step.done .num{background:#22c55e;color:#fff}
        .pv-stage{max-width:900px;margin:-68px auto 0;padding:0 22px 24px;position:relative;z-index:3}
        .pv-card{background:#fff;border:1px solid #e7ecf3;border-radius:20px;box-shadow:0 24px 60px rgba(15,23,42,.13);overflow:hidden}
        .pv-card-hd{padding:18px 24px;border-bottom:1px solid #eef2f7;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:#fbfcfe}
        .pv-card-hd h2{font-size:17px;font-weight:800;margin:0;color:#0f172a}
        .pv-card-hd .crumb{font-size:12px;color:#94a3b8;font-weight:600;margin-top:2px}
        .pv-back{display:inline-flex;align-items:center;gap:5px;background:#fff;border:1px solid #e2e8f0;color:#0f3171;font-size:12.5px;font-weight:700;cursor:pointer;padding:7px 12px;border-radius:9px}
        .pv-back:hover{background:#f1f5f9}
        .pv-body{padding:24px}
        .pv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
        .pv-tile{text-align:left;border:1px solid #e7ecf3;border-radius:14px;padding:16px 18px;background:#fff;cursor:pointer;transition:.15s;display:flex;align-items:center;gap:13px}
        .pv-tile:hover{border-color:#0f3171;box-shadow:0 12px 28px rgba(15,49,113,.13);transform:translateY(-2px)}
        .pv-tile .pin{width:40px;height:40px;border-radius:11px;background:#eef4ff;display:grid;place-items:center;font-size:18px;flex-shrink:0}
        .pv-tile .city{font-size:15px;font-weight:800;color:#0f172a}
        .pv-tile .n{font-size:12px;color:#64748b;margin-top:2px}
        .pv-tile .arrow{margin-left:auto;color:#cbd5e1;font-size:18px;font-weight:800}
        .pv-vaga{border:1px solid #e7ecf3;border-radius:16px;padding:18px 20px;margin-bottom:14px;background:#fff;transition:.15s}
        .pv-vaga:hover{box-shadow:0 12px 28px rgba(15,23,42,.08)}
        .pv-vaga .cargo{font-size:17px;font-weight:800;color:#0f172a}
        .pv-vaga .meta{font-size:12.5px;color:#64748b;margin-top:6px;display:flex;flex-wrap:wrap;gap:6px 16px}
        .pv-vaga .meta b{color:#334155;font-weight:700}
        .pv-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
        .pv-tag{font-size:11px;font-weight:600;color:#0f3171;background:#eef4ff;border:1px solid #dbe4f0;border-radius:7px;padding:3px 9px}
        .pv-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:none;border-radius:11px;font-weight:700;cursor:pointer;font-size:14px;transition:.15s}
        .pv-btn-pri{background:linear-gradient(135deg,#fb8c3b,#f97316);color:#fff;padding:12px 20px;box-shadow:0 12px 24px rgba(249,115,22,.28)}
        .pv-btn-pri:hover{filter:brightness(1.04)}
        .pv-btn-pri:disabled{opacity:.6;cursor:not-allowed}
        .pv-fg{margin-bottom:15px}
        .pv-fg label{display:block;font-size:12.5px;font-weight:700;color:#334155;margin-bottom:6px}
        .pv-fi{width:100%;height:44px;border:1px solid #cbd5e1;border-radius:11px;padding:0 13px;font-size:15px;background:#fff}
        textarea.pv-fi{height:auto;padding:11px 13px;resize:vertical}
        .pv-fi:focus{outline:none;border-color:#0f3171;box-shadow:0 0 0 4px rgba(15,49,113,.09)}
        .pv-row{display:grid;grid-template-columns:1fr 1fr;gap:13px}
        .pv-file{border:1.5px dashed #cbd5e1;border-radius:13px;padding:20px;text-align:center;font-size:13.5px;color:#64748b;cursor:pointer;display:block;transition:.15s}
        .pv-file:hover{border-color:#0f3171;background:#f8fbff}
        .pv-file b{color:#0f3171}
        .pv-search{width:100%;height:46px;border:1px solid #cbd5e1;border-radius:11px;padding:0 14px;font-size:15px;background:#fff;margin-bottom:16px}
        .pv-search:focus{outline:none;border-color:#0f3171;box-shadow:0 0 0 4px rgba(15,49,113,.09)}
        .pv-err{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:11px;padding:11px 15px;font-size:13.5px;margin-bottom:15px}
        .pv-empty{text-align:center;color:#64748b;padding:46px 20px}
        .pv-empty .ico{font-size:38px;margin-bottom:10px}
        .pv-ok{text-align:center;padding:54px 24px}
        .pv-ok .ico{font-size:56px}
        .pv-ok h2{font-size:22px;font-weight:800;color:#0f172a;margin:14px 0 8px}
        .pv-ok p{font-size:14.5px;color:#64748b;max-width:440px;margin:0 auto 20px;line-height:1.6}
        .pv-foot{text-align:center;font-size:12px;color:#94a3b8;padding:8px 20px 36px}
        @media(max-width:600px){
          .pv-hero{padding-bottom:84px}
          .pv-hero-in{padding:22px 16px 0}
          .pv-h1{font-size:25px}
          .pv-sub{font-size:14px}
          .pv-stage{margin-top:-60px;padding:0 12px 16px}
          .pv-card-hd{padding:16px}
          .pv-body{padding:16px}
          .pv-grid{grid-template-columns:1fr;gap:10px}
          .pv-row{grid-template-columns:1fr}
          .pv-fi,.pv-search{font-size:16px}
          .pv-steps{gap:6px}
          .pv-step{font-size:11.5px;padding:5px 11px 5px 5px}
        }
      `}</style>

      {/* HERO */}
      <header className="pv-hero">
        <div className="pv-glow a" /><div className="pv-glow b" />
        <div className="pv-hero-in">
          <div className="pv-brand">
            <div className="pv-logo"><img src={logoGN} alt="Grupo Nascimento" /></div>
            <div>
              <div className="nm">Grupo Nascimento</div>
              <div className="sb">Trabalhe Conosco</div>
            </div>
          </div>

          <span className="pv-badge"><span className="dot" /> Vagas abertas</span>
          <h1 className="pv-h1">Faça parte do nosso time.</h1>
          <p className="pv-sub">Escolha a cidade, encontre a vaga ideal e envie seu currículo. Leva menos de 2 minutos.</p>

          <div className="pv-steps">
            {STEPS.map(s => (
              <span key={s.n} className={`pv-step${s.n === stepNum ? " on" : ""}${s.n < stepNum ? " done" : ""}`}>
                <span className="num">{s.n < stepNum ? "✓" : s.n}</span>{s.l}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* CONTEÚDO */}
      <main className="pv-stage">
        <div className="pv-card">

          {/* Passo 1 — Cidade */}
          {step === "cidade" && (<>
            <div className="pv-card-hd"><div><h2>Selecione a cidade</h2><div className="crumb">Passo 1 de 3</div></div></div>
            <div className="pv-body">
              {loadingCid ? (
                <div className="pv-empty">Carregando cidades…</div>
              ) : cidades.length === 0 ? (
                <div className="pv-empty"><div className="ico">📭</div>Nenhuma vaga aberta no momento. Volte em breve!</div>
              ) : (<>
                <input className="pv-search" value={buscaCidade} onChange={e => setBuscaCidade(e.target.value)}
                  placeholder="🔎 Buscar cidade…" inputMode="search" />
                {cidadesFiltradas.length === 0 ? (
                  <div className="pv-empty">Nenhuma cidade encontrada para “{buscaCidade}”.</div>
                ) : (
                  <div className="pv-grid">
                    {cidadesFiltradas.map(c => (
                      <button key={c.cidade} className="pv-tile" onClick={() => escolherCidade(c.cidade)}>
                        <span className="pin">📍</span>
                        <span>
                          <div className="city">{c.cidade}</div>
                          <div className="n">{c.vagas} vaga{c.vagas > 1 ? "s" : ""} disponível{c.vagas > 1 ? "is" : ""}</div>
                        </span>
                        <span className="arrow">›</span>
                      </button>
                    ))}
                  </div>
                )}
              </>)}
            </div>
          </>)}

          {/* Passo 2 — Vagas da cidade */}
          {step === "vagas" && (<>
            <div className="pv-card-hd">
              <div><h2>Vagas em {cidade}</h2><div className="crumb">Passo 2 de 3 · {vagas.length} vaga{vagas.length !== 1 ? "s" : ""}</div></div>
              <button className="pv-back" onClick={() => setStep("cidade")}>← trocar cidade</button>
            </div>
            <div className="pv-body">
              {loadingVagas ? (
                <div className="pv-empty">Carregando vagas…</div>
              ) : vagas.length === 0 ? (
                <div className="pv-empty"><div className="ico">🔍</div>Nenhuma vaga aberta nesta cidade agora.</div>
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
                  <div style={{ marginTop: 16 }}>
                    <button className="pv-btn pv-btn-pri" onClick={() => abrirForm(v)}>Candidatar-se →</button>
                  </div>
                </div>
              ))}
            </div>
          </>)}

          {/* Passo 3 — Formulário */}
          {step === "form" && vaga && (<>
            <div className="pv-card-hd">
              <div><h2>Enviar currículo</h2><div className="crumb">{vaga.cargo} · {vaga.cidade}</div></div>
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
          </>)}

          {/* Passo 4 — Sucesso */}
          {step === "ok" && vaga && (
            <div className="pv-ok">
              <div className="ico">✅</div>
              <h2>Candidatura enviada!</h2>
              <p>Recebemos seu currículo para a vaga de <b>{vaga.cargo}</b> em {vaga.cidade}. Nossa equipe de recrutamento entrará em contato caso seu perfil seja selecionado. Boa sorte!</p>
              <button className="pv-btn pv-btn-pri" onClick={() => { setVaga(null); setBuscaCidade(""); setStep("cidade"); }}>Ver outras vagas</button>
            </div>
          )}

        </div>
        <div className="pv-foot">© {new Date().getFullYear()} Grupo Nascimento — Todos os direitos reservados</div>
      </main>
    </div>
  );
}
