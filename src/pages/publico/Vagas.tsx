import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoGN from "@/assets/logo-grupo-nascimento.png";

// =====================================================================
// PORTAL PÚBLICO DE VAGAS / CANDIDATURA  (rota /vagas — sem login)
// Landing de carreiras: hero + por que + vagas (cidade → vaga → currículo).
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
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const MAX_MB = 8;
const ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png";

// Arco laranja — motivo da marca (eco da logo).
const Arco = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 240 130" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M16 118 A 104 104 0 0 1 224 118" stroke="#f97316" strokeWidth="22" strokeLinecap="round" />
  </svg>
);

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

  const irPara = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

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

  const voltarInicio = () => { setStep("cidade"); setVaga(null); window.scrollTo({ top: 0 }); };

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
  const totalVagas = cidades.reduce((s, c) => s + (c.vagas || 0), 0);
  const stepNum = step === "cidade" ? 1 : step === "vagas" ? 2 : 3;
  const STEPS = [{ n: 1, l: "Cidade" }, { n: 2, l: "Vaga" }, { n: 3, l: "Currículo" }];
  const naLanding = step === "cidade";

  return (
    <div className="pv">
      <style>{`
        *{box-sizing:border-box}
        .pv{min-height:100vh;background:#fff;font-family:Inter,system-ui,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased;display:flex;flex-direction:column}
        .pv-main{flex:1 0 auto}
        .pv h1,.pv h2,.pv h3{font-family:'Plus Jakarta Sans',Inter,sans-serif;letter-spacing:-.02em}
        .pv-wrap{max-width:1100px;margin:0 auto;padding:0 22px}

        /* NAV */
        .pv-nav{position:sticky;top:0;z-index:30;background:rgba(255,255,255,.85);backdrop-filter:blur(12px);border-bottom:1px solid #eef2f7}
        .pv-nav-in{max-width:1100px;margin:0 auto;padding:13px 22px;display:flex;align-items:center;justify-content:space-between;gap:12px}
        .pv-brand{display:flex;align-items:center;gap:11px;cursor:pointer}
        .pv-logo{height:42px;width:42px;border-radius:11px;background:#0f3171;display:grid;place-items:center;padding:7px;flex-shrink:0}
        .pv-logo img{height:100%;width:100%;object-fit:contain}
        .pv-brand .nm{font-weight:800;font-size:15px;line-height:1.1}
        .pv-brand .sb{font-size:10px;text-transform:uppercase;letter-spacing:.18em;color:#94a3b8}
        .pv-navcta{display:inline-flex;align-items:center;gap:7px;background:#0f3171;color:#fff;border:none;border-radius:10px;padding:9px 16px;font-size:13px;font-weight:700;cursor:pointer}
        .pv-navcta:hover{background:#0b2350}

        /* HERO */
        .pv-hero{position:relative;overflow:hidden}
        .pv-hero-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:40px;align-items:center;padding:64px 0 56px}
        .pv-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:#ea580c;background:#fff4ec;border:1px solid #ffe0cc;border-radius:30px;padding:6px 14px}
        .pv-hero h1{font-size:clamp(34px,5.2vw,58px);font-weight:800;line-height:1.04;margin:20px 0 0;color:#0b1f44}
        .pv-hero h1 .hl{color:#f97316}
        .pv-hero-sub{font-size:clamp(15px,1.7vw,19px);color:#475569;line-height:1.55;margin:18px 0 0;max-width:520px}
        .pv-hero-cta{display:flex;align-items:center;gap:16px;margin-top:30px;flex-wrap:wrap}
        .pv-stat-inline{display:flex;align-items:center;gap:7px;font-size:14px;color:#475569;font-weight:600}
        .pv-stat-inline b{color:#0f3171;font-weight:800}
        /* painel visual do hero */
        .pv-hero-art{position:relative;border-radius:26px;background:linear-gradient(150deg,#0b2350,#0f3171 60%,#16407f);padding:34px 30px;color:#fff;overflow:hidden;box-shadow:0 30px 70px rgba(11,35,80,.3)}
        .pv-hero-art .arco{position:absolute;top:-18px;right:-20px;width:230px;opacity:.9}
        .pv-hero-art .glow{position:absolute;bottom:-90px;left:-60px;width:240px;height:240px;border-radius:50%;background:#3b82f6;filter:blur(80px);opacity:.45}
        .pv-hero-art .lbl{position:relative;font-size:12px;text-transform:uppercase;letter-spacing:.18em;color:rgba(255,255,255,.7);font-weight:700}
        .pv-hero-art .big{position:relative;font-size:56px;font-weight:800;line-height:1;margin-top:6px;font-family:'Plus Jakarta Sans',sans-serif}
        .pv-hero-art .big small{font-size:18px;font-weight:700;color:rgba(255,255,255,.8);margin-left:6px}
        .pv-hero-art .mini{position:relative;display:flex;gap:10px;margin-top:26px;flex-wrap:wrap}
        .pv-hero-art .chip{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:11px 14px;font-size:13px;font-weight:600;flex:1;min-width:120px}
        .pv-hero-art .chip span{display:block;font-size:11px;color:rgba(255,255,255,.6);font-weight:600;margin-top:2px}

        /* SEÇÕES */
        .pv-sec{padding:54px 0}
        .pv-sec.tint{background:#f7f9fc;border-top:1px solid #eef2f7;border-bottom:1px solid #eef2f7}
        .pv-sec-h{text-align:center;max-width:560px;margin:0 auto 36px}
        .pv-sec-h .kick{font-size:12px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#f97316}
        .pv-sec-h h2{font-size:clamp(24px,3vw,34px);font-weight:800;margin:8px 0 0;color:#0b1f44}
        .pv-sec-h p{font-size:15px;color:#64748b;margin:10px 0 0;line-height:1.55}
        .pv-pillars{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
        .pv-pillar{background:#fff;border:1px solid #e7ecf3;border-radius:18px;padding:26px 22px;box-shadow:0 10px 30px rgba(15,23,42,.05)}
        .pv-pillar .ic{width:48px;height:48px;border-radius:13px;background:#fff4ec;display:grid;place-items:center;font-size:22px}
        .pv-pillar h3{font-size:17px;font-weight:800;margin:16px 0 6px}
        .pv-pillar p{font-size:14px;color:#64748b;line-height:1.55;margin:0}

        /* CARD / FLUXO */
        .pv-card{background:#fff;border:1px solid #e7ecf3;border-radius:22px;box-shadow:0 24px 60px rgba(15,23,42,.1);overflow:hidden;max-width:760px;margin:0 auto}
        .pv-card-hd{padding:20px 26px;border-bottom:1px solid #eef2f7;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:#fbfcfe}
        .pv-card-hd h2{font-size:19px;font-weight:800;margin:0}
        .pv-card-hd .crumb{font-size:12.5px;color:#94a3b8;font-weight:600;margin-top:3px}
        .pv-steps{display:flex;gap:8px;flex-wrap:wrap}
        .pv-stp{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:#94a3b8;background:#fff;border:1px solid #e7ecf3;border-radius:30px;padding:5px 12px 5px 5px}
        .pv-stp .num{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:10px;font-weight:800;background:#eef2f7;color:#64748b}
        .pv-stp.on{color:#0b1f44;border-color:#ffd9bf;background:#fff7f1}.pv-stp.on .num{background:#f97316;color:#fff}
        .pv-stp.done .num{background:#22c55e;color:#fff}
        .pv-back{display:inline-flex;align-items:center;gap:5px;background:#fff;border:1px solid #e2e8f0;color:#0f3171;font-size:12.5px;font-weight:700;cursor:pointer;padding:8px 13px;border-radius:9px}
        .pv-back:hover{background:#f1f5f9}
        .pv-body{padding:26px}

        .pv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:13px}
        .pv-tile{text-align:left;border:1px solid #e7ecf3;border-radius:15px;padding:16px 18px;background:#fff;cursor:pointer;transition:.16s;display:flex;align-items:center;gap:13px}
        .pv-tile:hover{border-color:#f97316;box-shadow:0 14px 30px rgba(249,115,22,.14);transform:translateY(-2px)}
        .pv-tile .pin{width:42px;height:42px;border-radius:12px;background:#eef4ff;display:grid;place-items:center;font-size:18px;flex-shrink:0}
        .pv-tile .city{font-size:15px;font-weight:800;color:#0f172a}
        .pv-tile .n{font-size:12.5px;color:#64748b;margin-top:2px}
        .pv-tile .arrow{margin-left:auto;color:#cbd5e1;font-size:20px;font-weight:800}
        .pv-vaga{border:1px solid #e7ecf3;border-radius:16px;padding:18px 20px;margin-bottom:14px;transition:.16s}
        .pv-vaga:hover{box-shadow:0 14px 30px rgba(15,23,42,.08);border-color:#dbe4f0}
        .pv-vaga .cargo{font-size:18px;font-weight:800;color:#0b1f44}
        .pv-vaga .meta{font-size:13px;color:#64748b;margin-top:7px;display:flex;flex-wrap:wrap;gap:6px 18px}
        .pv-vaga .meta b{color:#334155;font-weight:700}
        .pv-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:13px}
        .pv-tag{font-size:11.5px;font-weight:600;color:#0f3171;background:#eef4ff;border:1px solid #dbe4f0;border-radius:7px;padding:3px 10px}
        .pv-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:12px;font-weight:800;cursor:pointer;font-size:14.5px;transition:.16s}
        .pv-btn-pri{background:linear-gradient(135deg,#fb8c3b,#f97316);color:#fff;padding:13px 22px;box-shadow:0 14px 28px rgba(249,115,22,.3)}
        .pv-btn-pri:hover{filter:brightness(1.05);transform:translateY(-1px)}
        .pv-btn-pri:disabled{opacity:.6;cursor:not-allowed;transform:none}
        .pv-fg{margin-bottom:16px}
        .pv-fg label{display:block;font-size:12.5px;font-weight:700;color:#334155;margin-bottom:7px}
        .pv-fi{width:100%;height:46px;border:1px solid #cbd5e1;border-radius:12px;padding:0 14px;font-size:15px;background:#fff}
        textarea.pv-fi{height:auto;padding:12px 14px;resize:vertical}
        .pv-fi:focus{outline:none;border-color:#f97316;box-shadow:0 0 0 4px rgba(249,115,22,.12)}
        .pv-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        .pv-file{border:1.5px dashed #cbd5e1;border-radius:14px;padding:22px;text-align:center;font-size:14px;color:#64748b;cursor:pointer;display:block;transition:.16s}
        .pv-file:hover{border-color:#f97316;background:#fff7f1}.pv-file b{color:#0f3171}
        .pv-search{width:100%;height:48px;border:1px solid #cbd5e1;border-radius:12px;padding:0 15px;font-size:15px;background:#fff;margin-bottom:18px}
        .pv-search:focus{outline:none;border-color:#f97316;box-shadow:0 0 0 4px rgba(249,115,22,.12)}
        .pv-err{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:12px;padding:12px 15px;font-size:14px;margin-bottom:16px}
        .pv-empty{text-align:center;color:#64748b;padding:48px 20px}.pv-empty .ico{font-size:40px;margin-bottom:10px}
        .pv-ok{text-align:center;padding:58px 24px}.pv-ok .ico{font-size:60px}
        .pv-ok h2{font-size:24px;font-weight:800;margin:16px 0 8px}
        .pv-ok p{font-size:15px;color:#64748b;max-width:450px;margin:0 auto 22px;line-height:1.6}

        .pv-foot{background:#0b1f44;color:#fff;margin-top:8px}
        .pv-foot-in{max-width:1100px;margin:0 auto;padding:40px 22px;display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap}
        .pv-foot .nm{font-weight:800}
        .pv-foot .cp{font-size:12.5px;color:rgba(255,255,255,.55)}

        @media(max-width:860px){
          .pv-hero-grid{grid-template-columns:1fr;gap:28px;padding:40px 0 36px}
          .pv-hero-art{order:-1}
          .pv-pillars{grid-template-columns:1fr}
        }
        @media(max-width:600px){
          .pv-wrap,.pv-nav-in,.pv-foot-in{padding-left:16px;padding-right:16px}
          .pv-sec{padding:40px 0}
          .pv-card-hd{padding:16px}.pv-body{padding:17px}
          .pv-grid{grid-template-columns:1fr;gap:10px}
          .pv-row{grid-template-columns:1fr}
          .pv-fi,.pv-search{font-size:16px}
          .pv-hero-art .big{font-size:46px}
          .pv-navcta{padding:8px 13px;font-size:12px}
        }
      `}</style>

      {/* NAV */}
      <nav className="pv-nav">
        <div className="pv-nav-in">
          <div className="pv-brand" onClick={voltarInicio}>
            <div className="pv-logo"><img src={logoGN} alt="Grupo Nascimento" /></div>
            <div><div className="nm">Grupo Nascimento</div><div className="sb">Trabalhe Conosco</div></div>
          </div>
          {naLanding
            ? <button className="pv-navcta" onClick={() => irPara("vagas")}>Ver vagas →</button>
            : <button className="pv-navcta" onClick={voltarInicio}>↑ Início</button>}
        </div>
      </nav>

      <div className="pv-main">
      {/* ===== LANDING (passo cidade) ===== */}
      {naLanding && (<>
        <section className="pv-hero">
          <div className="pv-wrap pv-hero-grid">
            <div>
              <span className="pv-eyebrow">🧡 Trabalhe Conosco</span>
              <h1>Seu próximo passo de carreira começa <span className="hl">aqui.</span></h1>
              <p className="pv-hero-sub">Encontre vagas abertas na sua cidade e candidate-se em poucos minutos — simples, rápido e sem precisar de cadastro.</p>
              <div className="pv-hero-cta">
                <button className="pv-btn pv-btn-pri" onClick={() => irPara("vagas")}>Ver vagas abertas →</button>
                {!loadingCid && totalVagas > 0 && (
                  <span className="pv-stat-inline">🟢 <b>{totalVagas}</b> vaga{totalVagas > 1 ? "s" : ""} em <b>{cidades.length}</b> cidade{cidades.length > 1 ? "s" : ""}</span>
                )}
              </div>
            </div>
            <div className="pv-hero-art">
              <Arco className="arco" /><div className="glow" />
              <div className="lbl">Vagas abertas agora</div>
              <div className="big">{loadingCid ? "—" : totalVagas}<small>oportunidade{totalVagas !== 1 ? "s" : ""}</small></div>
              <div className="mini">
                <div className="chip">{loadingCid ? "—" : cidades.length}<span>cidades</span></div>
                <div className="chip">100%<span>online</span></div>
                <div className="chip">Sem<span>cadastro</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="pv-sec tint">
          <div className="pv-wrap">
            <div className="pv-sec-h">
              <div className="kick">Por que a Nascimento</div>
              <h2>Um lugar pra crescer de verdade</h2>
              <p>Mais do que uma vaga, um time que valoriza as pessoas no dia a dia.</p>
            </div>
            <div className="pv-pillars">
              <div className="pv-pillar"><div className="ic">🚀</div><h3>Crescimento</h3><p>Oportunidades reais de evolução, novos desafios e reconhecimento pelo seu trabalho.</p></div>
              <div className="pv-pillar"><div className="ic">🤝</div><h3>Time que cuida</h3><p>Um ambiente próximo, com respeito e apoio para você fazer o seu melhor.</p></div>
              <div className="pv-pillar"><div className="ic">📍</div><h3>Perto de você</h3><p>Vagas em diversas cidades onde atuamos — trabalhe perto de casa.</p></div>
            </div>
          </div>
        </section>

        <section id="vagas" className="pv-sec">
          <div className="pv-wrap">
            <div className="pv-sec-h">
              <div className="kick">Passo 1 de 3</div>
              <h2>Selecione a sua cidade</h2>
              <p>Escolha a cidade para ver as vagas disponíveis e enviar seu currículo.</p>
            </div>
            <div className="pv-card">
              <div className="pv-body">
                {loadingCid ? (
                  <div className="pv-empty">Carregando cidades…</div>
                ) : cidades.length === 0 ? (
                  <div className="pv-empty"><div className="ico">📭</div>Nenhuma vaga aberta no momento. Volte em breve!</div>
                ) : (<>
                  <input className="pv-search" value={buscaCidade} onChange={e => setBuscaCidade(e.target.value)} placeholder="🔎 Buscar cidade…" inputMode="search" />
                  {cidadesFiltradas.length === 0 ? (
                    <div className="pv-empty">Nenhuma cidade encontrada para “{buscaCidade}”.</div>
                  ) : (
                    <div className="pv-grid">
                      {cidadesFiltradas.map(c => (
                        <button key={c.cidade} className="pv-tile" onClick={() => escolherCidade(c.cidade)}>
                          <span className="pin">📍</span>
                          <span><div className="city">{c.cidade}</div><div className="n">{c.vagas} vaga{c.vagas > 1 ? "s" : ""} disponível{c.vagas > 1 ? "is" : ""}</div></span>
                          <span className="arrow">›</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>)}
              </div>
            </div>
          </div>
        </section>
      </>)}

      {/* ===== FLUXO (vagas / form / ok) ===== */}
      {!naLanding && (
        <section className="pv-sec">
          <div className="pv-wrap">
            <div className="pv-card">
              {/* Vagas da cidade */}
              {step === "vagas" && (<>
                <div className="pv-card-hd">
                  <div><h2>Vagas em {cidade}</h2><div className="crumb">{vagas.length} vaga{vagas.length !== 1 ? "s" : ""} disponíve{vagas.length !== 1 ? "is" : "l"}</div></div>
                  <button className="pv-back" onClick={voltarInicio}>← trocar cidade</button>
                </div>
                <div className="pv-body">
                  <div style={{ marginBottom: 16 }}><Steps stepNum={stepNum} STEPS={STEPS} /></div>
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
                      <div style={{ marginTop: 16 }}><button className="pv-btn pv-btn-pri" onClick={() => abrirForm(v)}>Candidatar-se →</button></div>
                    </div>
                  ))}
                </div>
              </>)}

              {/* Formulário */}
              {step === "form" && vaga && (<>
                <div className="pv-card-hd">
                  <div><h2>Enviar currículo</h2><div className="crumb">{vaga.cargo} · {vaga.cidade}</div></div>
                  <button className="pv-back" onClick={() => setStep("vagas")}>← voltar</button>
                </div>
                <div className="pv-body">
                  <div style={{ marginBottom: 16 }}><Steps stepNum={stepNum} STEPS={STEPS} /></div>
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
                  <button className="pv-btn pv-btn-pri" style={{ width: "100%" }} onClick={enviar} disabled={enviando}>{enviando ? "Enviando…" : "Enviar candidatura"}</button>
                </div>
              </>)}

              {/* Sucesso */}
              {step === "ok" && vaga && (
                <div className="pv-ok">
                  <div className="ico">✅</div>
                  <h2>Candidatura enviada!</h2>
                  <p>Recebemos seu currículo para a vaga de <b>{vaga.cargo}</b> em {vaga.cidade}. Nossa equipe de recrutamento entrará em contato caso seu perfil seja selecionado. Boa sorte!</p>
                  <button className="pv-btn pv-btn-pri" onClick={voltarInicio}>Ver outras vagas</button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      </div>

      {/* FOOTER */}
      <footer className="pv-foot">
        <div className="pv-foot-in">
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div className="pv-logo" style={{ background: "rgba(255,255,255,.1)" }}><img src={logoGN} alt="" /></div>
            <div className="nm">Grupo Nascimento</div>
          </div>
          <div className="cp">© {new Date().getFullYear()} Grupo Nascimento — Todos os direitos reservados</div>
        </div>
      </footer>
    </div>
  );
}

function Steps({ stepNum, STEPS }: { stepNum: number; STEPS: { n: number; l: string }[] }) {
  return (
    <div className="pv-steps">
      {STEPS.map(s => (
        <span key={s.n} className={`pv-stp${s.n === stepNum ? " on" : ""}${s.n < stepNum ? " done" : ""}`}>
          <span className="num">{s.n < stepNum ? "✓" : s.n}</span>{s.l}
        </span>
      ))}
    </div>
  );
}
