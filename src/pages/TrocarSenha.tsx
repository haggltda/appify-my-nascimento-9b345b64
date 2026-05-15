import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Lock, AlertCircle, ShieldCheck, Eye, EyeOff, KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useMustChangePassword } from "@/hooks/useMustChangePassword";

export default function TrocarSenha() {
  const { user, loading: authLoading } = useAuth();
  const { mustChange, loading: mcLoading, refetch } = useMustChangePassword(user?.id);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  if (!authLoading && !user) return <Navigate to="/login" replace />;
  // Se não precisa trocar, manda pro app
  if (!authLoading && !mcLoading && user && !mustChange) {
    return <Navigate to="/app" replace />;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pwd.length < 8) { setError("A nova senha deve ter ao menos 8 caracteres."); return; }
    if (pwd !== pwd2) { setError("As senhas não conferem."); return; }
    setSaving(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password: pwd });
      if (updErr) throw updErr;
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", user!.id);
      if (pErr) throw pErr;
      await refetch();
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar senha.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <ShieldCheck className="h-3 w-3 text-warning" /> Troca de senha obrigatória
        </div>
        <h2 className="font-display text-2xl font-bold">Crie sua nova senha</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sua senha foi redefinida pelo administrador. Defina agora uma nova senha pessoal e
          intransferível para continuar usando o ERP.
        </p>

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs text-foreground">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            <strong>Atenção:</strong> guarde esta nova senha em local seguro (cofre de senhas,
            gerenciador de credenciais ou outro meio confiável). Por segurança, ela não será
            exibida novamente e não pode ser recuperada — apenas redefinida.
          </p>
        </div>

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
              <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
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
            {saving ? "Salvando…" : "Definir nova senha e entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
