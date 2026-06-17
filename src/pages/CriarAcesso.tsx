import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, IdCard, Calendar, Lock, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2, HardHat, UserCog, FileText, Eye, EyeOff } from "lucide-react";
import logoGN from "@/assets/logo-grupo-nascimento.png";
import { supabase } from "@/integrations/supabase/client";

function maskCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length > 9) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4");
  if (d.length > 6) return d.replace(/(\d{3})(\d{3})(\d{0,3})/, "$1.$2.$3");
  if (d.length > 3) return d.replace(/(\d{3})(\d{0,3})/, "$1.$2");
  return d;
}

async function callFn(name: string, body: unknown): Promise<{ ok?: boolean; error?: string; [k: string]: unknown }> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let msg = error.message;
    try {
      const j = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.();
      if (j?.error) msg = j.error;
    } catch { /* mantém msg padrão */ }
    return { ok: false, error: msg };
  }
  return (data as { ok?: boolean }) ?? { ok: false, error: "Sem resposta do servidor." };
}

type Tipo = "ENCARREGADO" | "ADMINISTRATIVO";

export default function CriarAcesso() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [tipo, setTipo] = useState<Tipo | null>(null);

  const [cpf, setCpf] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [contratos, setContratos] = useState<{ id: number; nome: string }[]>([]);
  const [contratoId, setContratoId] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carrega contratos ativos (RPC pública) ao escolher Encarregado.
  useEffect(() => {
    if (tipo !== "ENCARREGADO" || contratos.length) return;
    (supabase as any).rpc("contratos_publicos").then(({ data }: { data: { id: number; nome: string }[] | null }) => {
      if (data) setContratos(data);
    });
  }, [tipo, contratos.length]);

  const escolherTipo = (t: Tipo) => { setTipo(t); setError(null); setStep(2); };

  const submit = async () => {
    setError(null);
    if (cpf.replace(/\D/g, "").length !== 11) return setError("Informe um CPF válido.");
    if (!nascimento) return setError("Informe sua data de nascimento.");
    if (tipo === "ENCARREGADO" && !contratoId) return setError("Selecione o contrato pelo qual você é responsável.");
    if (password.length < 6) return setError("A senha deve ter ao menos 6 caracteres.");
    if (password !== password2) return setError("As senhas não coincidem.");

    setLoading(true);
    const contrato = contratos.find(c => String(c.id) === contratoId);
    const r = await callFn("auth-criar-acesso", {
      cpf, nascimento, password, tipo,
      contrato_id: contratoId ? Number(contratoId) : undefined,
      contrato_nome: contrato?.nome,
    });
    setLoading(false);
    if (!r.ok) return setError(r.error ?? "Não foi possível criar o acesso.");
    setStep(3);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Painel institucional */}
      <aside className="relative hidden overflow-hidden bg-gradient-hero text-white lg:flex lg:flex-col lg:p-12">
        <div className="absolute inset-0 bg-gradient-mesh opacity-60" />
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 p-1.5 backdrop-blur ring-1 ring-white/20">
            <img src={logoGN} alt="Grupo Nascimento" className="h-full w-full object-contain" />
          </div>
          <div>
            <p className="font-display text-base font-bold leading-tight">Grupo Nascimento</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">ERP Corporativo</p>
          </div>
        </div>
        <div className="relative z-10 mt-auto max-w-lg">
          <h1 className="font-display text-4xl font-bold leading-tight">Crie seu acesso ao ERP.</h1>
          <p className="mt-4 text-base leading-relaxed text-white/75">
            Encarregados e administrativos criam o próprio login a partir do cadastro da empresa,
            confirmando a identidade com CPF e data de nascimento.
          </p>
        </div>
      </aside>

      {/* Conteúdo */}
      <section className="flex items-center justify-center bg-background p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-success" /> Criar acesso
          </div>

          {step === 1 && (
            <>
              <h2 className="font-display text-2xl font-bold">Como você vai acessar?</h2>
              <p className="mt-1 text-sm text-muted-foreground">Escolha o tipo de acesso que deseja criar.</p>

              <div className="mt-6 space-y-3">
                <button onClick={() => escolherTipo("ENCARREGADO")}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-accent/50 hover:bg-accent/5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent"><HardHat className="h-5 w-5" /></div>
                  <div>
                    <p className="font-semibold text-foreground">Encarregado</p>
                    <p className="text-xs text-muted-foreground">Responsável por um contrato de obra/serviço</p>
                  </div>
                  <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
                </button>

                <button onClick={() => escolherTipo("ADMINISTRATIVO")}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-accent/50 hover:bg-accent/5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><UserCog className="h-5 w-5" /></div>
                  <div>
                    <p className="font-semibold text-foreground">Administrativo</p>
                    <p className="text-xs text-muted-foreground">Perfil administrativo do sistema</p>
                  </div>
                  <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <div className="mt-6 text-center text-sm">
                <Link to="/login" className="text-muted-foreground hover:text-foreground underline underline-offset-2">Já tenho acesso — fazer login</Link>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="font-display text-2xl font-bold">
                {tipo === "ENCARREGADO" ? "Acesso de Encarregado" : "Acesso Administrativo"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Confirme sua identidade e crie sua senha. Seu login será o CPF.
              </p>

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>{error}</p>
                </div>
              )}

              <div className="mt-5 space-y-4">
                <Field label="CPF" icon={<IdCard className="h-4 w-4" />}>
                  <input value={cpf} onChange={e => setCpf(maskCpf(e.target.value))} inputMode="numeric" maxLength={14}
                    placeholder="000.000.000-00" autoFocus className={inputCls} />
                </Field>

                <Field label="Data de nascimento" icon={<Calendar className="h-4 w-4" />}>
                  <input value={nascimento} onChange={e => setNascimento(e.target.value)} type="date" className={inputCls} />
                </Field>

                {tipo === "ENCARREGADO" && (
                  <Field label="Contrato que você é responsável" icon={<FileText className="h-4 w-4" />}>
                    <select value={contratoId} onChange={e => setContratoId(e.target.value)} className={inputCls}>
                      <option value="">{contratos.length ? "Selecione o contrato..." : "Carregando..."}</option>
                      {contratos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </Field>
                )}

                <Field label="Criar senha" icon={<Lock className="h-4 w-4" />}>
                  <input value={password} onChange={e => setPassword(e.target.value)} type={showPwd ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres" className={inputCls} />
                  <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </Field>

                <Field label="Confirmar senha" icon={<Lock className="h-4 w-4" />}>
                  <input value={password2} onChange={e => setPassword2(e.target.value)} type={showPwd ? "text" : "password"}
                    placeholder="Repita a senha" className={inputCls}
                    onKeyDown={e => { if (e.key === "Enter") submit(); }} />
                </Field>
              </div>

              {tipo === "ENCARREGADO" && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  ⚠️ Selecione <strong>somente</strong> o contrato pelo qual você é responsável. A correção depende de um administrador.
                </p>
              )}

              <button onClick={submit} disabled={loading}
                className="btn-relief mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gradient-accent text-sm font-semibold text-accent-foreground disabled:opacity-60">
                {loading ? "Criando…" : <>Criar acesso <ArrowRight className="h-4 w-4" /></>}
              </button>
              <button onClick={() => { setStep(1); setError(null); }} className="mt-2 flex w-full items-center justify-center gap-1.5 text-center text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3 w-3" /> Voltar
              </button>
            </>
          )}

          {step === 3 && (
            <div className="py-6 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-14 w-14 text-success" />
              <h2 className="font-display text-2xl font-bold">Acesso criado!</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Você já pode entrar com seu <strong className="text-foreground">CPF</strong> e a senha que criou,
                na aba <strong className="text-foreground">CPF</strong> da tela de login.
              </p>
              <button onClick={() => navigate("/login")}
                className="btn-relief mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gradient-accent text-sm font-semibold text-accent-foreground">
                Ir para o login <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

const inputCls = "h-11 w-full rounded-lg border border-border bg-card pl-10 pr-10 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30";

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-foreground">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
        {children}
      </div>
    </div>
  );
}
