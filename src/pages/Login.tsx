import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Mail, ShieldCheck, AlertCircle, ArrowRight, Eye, EyeOff } from "lucide-react";
import logoGN from "@/assets/logo-grupo-nascimento.png";

export default function Login() {
  const [showPwd, setShowPwd] = useState(false);
  const [error] = useState<string | null>(null);
  const navigate = useNavigate();

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Painel institucional */}
      <aside className="relative hidden overflow-hidden bg-gradient-hero text-white lg:flex lg:flex-col lg:p-12">
        <div className="absolute inset-0 bg-gradient-mesh opacity-60" />
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary-glow/20 blur-3xl" />

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
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wider text-white/80 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Módulo de Licitações
          </p>
          <h1 className="font-display text-4xl font-bold leading-tight">
            Inteligência operacional para o ciclo completo de licitações.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/75">
            Pipeline de oportunidades, análise de risco com IA, pareceres, controladoria
            e workflow de aprovações em uma única plataforma multi-CNPJ.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              { v: "11", l: "Empresas" },
              { v: "248", l: "Editais ativos" },
              { v: "R$ 1,2B", l: "Em pipeline" },
            ].map((s) => (
              <div key={s.l} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                <p className="font-display text-2xl font-bold">{s.v}</p>
                <p className="text-[11px] uppercase tracking-wider text-white/60">{s.l}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 mt-10 text-[11px] text-white/50">
          © 2025 Grupo Nascimento — Todos os direitos reservados · v3.4.0
        </p>
      </aside>

      {/* Formulário */}
      <section className="flex items-center justify-center bg-background p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <img src={logoGN} alt="Grupo Nascimento" className="h-10 w-10 object-contain" />
              <p className="font-display font-bold">Grupo Nascimento</p>
            </div>
          </div>

          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-success" /> Acesso restrito
          </div>
          <h2 className="font-display text-2xl font-bold">Acessar plataforma</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use suas credenciais corporativas para entrar no ERP.
          </p>

          {error && (
            <div className="mt-5 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <form
            onSubmit={(e) => { e.preventDefault(); navigate("/app"); }}
            className="mt-6 space-y-4"
          >
            <Field label="E-mail corporativo" icon={<Mail className="h-4 w-4" />}>
              <input
                type="email"
                required
                placeholder="nome.sobrenome@gruponascimento.com.br"
                className="h-11 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </Field>

            <Field
              label="Senha"
              icon={<Lock className="h-4 w-4" />}
              right={
                <Link to="#" className="text-xs font-medium text-primary hover:underline">
                  Recuperar senha
                </Link>
              }
            >
              <input
                type={showPwd ? "text" : "password"}
                required
                placeholder="••••••••••••"
                className="h-11 w-full rounded-lg border border-border bg-card pl-10 pr-10 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </Field>

            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" className="h-3.5 w-3.5 rounded border-border accent-primary" />
              Manter sessão ativa neste dispositivo confiável
            </label>

            <button
              type="submit"
              className="btn-relief group flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gradient-accent text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.01] active:scale-[0.99]"
            >
              Entrar na plataforma
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </form>

          <div className="my-6 divider-soft" />

          <div className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Acesso monitorado</p>
            <p className="mt-1 leading-relaxed">
              Toda autenticação é registrada com data, hora, IP e dispositivo. Atividades suspeitas
              acionam bloqueio automático e auditoria.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({
  label, icon, right, children,
}: { label: string; icon: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground">{label}</label>
        {right}
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
        {children}
      </div>
    </div>
  );
}
