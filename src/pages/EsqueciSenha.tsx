import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ShieldCheck, AlertCircle, ArrowLeft, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      // Sempre exibe a mesma mensagem — não revela se o e-mail existe
      setSubmitted(true);
    } catch {
      setError("Não foi possível processar a solicitação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <ShieldCheck className="h-3 w-3 text-primary" /> Recuperação de acesso
        </div>
        <h2 className="font-display text-2xl font-bold">Esqueci minha senha</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe o e-mail corporativo cadastrado. Enviaremos um link para você criar uma nova senha.
        </p>

        {error && (
          <div className="mt-5 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {submitted ? (
          <div className="mt-6 rounded-lg border border-success/30 bg-success/10 px-4 py-4 text-sm">
            <p className="font-semibold text-foreground">Solicitação enviada</p>
            <p className="mt-1 text-muted-foreground leading-relaxed">
              Se o e-mail <strong>{email}</strong> estiver cadastrado no sistema, você receberá
              um link de recuperação em breve. Verifique também a caixa de spam.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              O link expira em 1 hora. Se não receber, solicite novamente ou entre em contato
              com o administrador do sistema.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold">E-mail corporativo</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome.sobrenome@gruponascimento.com.br"
                  className="h-11 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-relief flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gradient-accent text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {loading ? "Enviando…" : "Enviar link de recuperação"}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
}
