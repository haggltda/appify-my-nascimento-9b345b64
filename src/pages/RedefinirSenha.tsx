import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, ShieldCheck, AlertCircle, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type PageState = "loading" | "form" | "success" | "invalid";

export default function RedefinirSenha() {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let resolved = false;

    const resolve = (state: PageState) => {
      if (!resolved) {
        resolved = true;
        setPageState(state);
      }
    };

    // 1) Listener para o evento PASSWORD_RECOVERY disparado pelo Supabase ao processar o hash da URL
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") resolve("form");
    });

    // 2) Sessão já existente: Supabase pode ter processado o hash antes deste componente montar
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) resolve("form");
      // Se null: NÃO declarar inválido aqui - o evento PASSWORD_RECOVERY ainda pode chegar
    });

    // 3) Timeout de segurança: se nenhum dos dois acima resolver em 6s, o link é realmente inválido
    const timeout = setTimeout(() => resolve("invalid"), 6000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // Redirecionar se token inválido/expirado após breve delay para o usuário ver a mensagem
  useEffect(() => {
    if (pageState !== "invalid") return;
    const t = setTimeout(() => navigate("/login", { replace: true }), 4000);
    return () => clearTimeout(t);
  }, [pageState, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pwd.length < 8) { setError("A nova senha deve ter ao menos 8 caracteres."); return; }
    if (pwd !== pwd2) { setError("As senhas não conferem."); return; }
    setSaving(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password: pwd });
      if (updErr) throw updErr;
      setPageState("success");
      // Encerra a sessão de recuperação - usuário fará login normalmente com a nova senha
      await supabase.auth.signOut();
      setTimeout(() => navigate("/login", { replace: true, state: { successMsg: "Senha redefinida com sucesso. Faça login com a nova senha." } }), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao redefinir a senha.");
    } finally {
      setSaving(false);
    }
  };

  // ── Estados da página ────────────────────────────────────────────────────────

  if (pageState === "loading") {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6">
        <p className="text-sm text-muted-foreground">Verificando link de recuperação…</p>
      </div>
    );
  }

  if (pageState === "invalid") {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6">
        <div className="w-full max-w-md text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-destructive" />
          <h2 className="font-display text-xl font-bold">Link inválido ou expirado</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Este link de recuperação já foi usado ou expirou. Você será redirecionado ao login
            em instantes para solicitar um novo link.
          </p>
        </div>
      </div>
    );
  }

  if (pageState === "success") {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6">
        <div className="w-full max-w-md text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-success" />
          <h2 className="font-display text-xl font-bold">Senha redefinida!</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua nova senha foi salva com sucesso. Redirecionando para o login…
          </p>
        </div>
      </div>
    );
  }

  // ── Formulário principal ─────────────────────────────────────────────────────

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <ShieldCheck className="h-3 w-3 text-primary" /> Redefinição de senha
        </div>
        <h2 className="font-display text-2xl font-bold">Crie sua nova senha</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha uma senha segura com no mínimo 8 caracteres.
        </p>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold">Nova senha</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showPwd ? "text" : "password"}
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                minLength={8}
                required
                placeholder="Mínimo 8 caracteres"
                className="h-11 w-full rounded-lg border border-border bg-card pl-10 pr-10 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold">Confirmar nova senha</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showPwd ? "text" : "password"}
                value={pwd2}
                onChange={(e) => setPwd2(e.target.value)}
                minLength={8}
                required
                placeholder="Repita a nova senha"
                className="h-11 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn-relief flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gradient-accent text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Redefinir senha"}
          </button>
        </form>
      </div>
    </div>
  );
}
