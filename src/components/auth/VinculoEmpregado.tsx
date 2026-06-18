import { useState } from "react";
import { IdCard, Calendar, ArrowRight, CheckCircle2, AlertCircle, X, Loader2, Building2, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useVinculoEmpregado, type EmpregadoVinculo } from "@/hooks/useVinculoEmpregado";

interface VinculoResp {
  ok: boolean;
  error?: string;
  empregado?: EmpregadoVinculo;
  ja_vinculado?: boolean;
  vinculado?: boolean;
}

/**
 * Vínculo via RPC SECURITY DEFINER (vincular_meu_empregado) — vai pelo endpoint
 * /rest/v1/rpc já usado pelo app. Substitui a antiga Edge Function, que falhava
 * com "Failed to send a request to the Edge Function".
 */
async function vincularRpc(cpf: string, nascimento: string, confirmar: boolean): Promise<VinculoResp> {
  const { data, error } = await (supabase as any).rpc("vincular_meu_empregado", {
    p_cpf: cpf,
    p_nascimento: nascimento,
    p_confirmar: confirmar,
  });
  if (error) {
    return { ok: false, error: error.message || "Não foi possível concluir o vínculo. Tente novamente." };
  }
  return (data as VinculoResp) ?? { ok: false, error: "Sem resposta do servidor." };
}

function maskCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length > 9) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4");
  if (d.length > 6) return d.replace(/(\d{3})(\d{3})(\d{0,3})/, "$1.$2.$3");
  if (d.length > 3) return d.replace(/(\d{3})(\d{0,3})/, "$1.$2");
  return d;
}
function maskData(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length > 4) return d.replace(/(\d{2})(\d{2})(\d{0,4})/, "$1/$2/$3");
  if (d.length > 2) return d.replace(/(\d{2})(\d{0,2})/, "$1/$2");
  return d;
}

/** Gate: mostra o card de vínculo quando o usuário logado ainda não está
 *  amarrado a um cadastro EMPREGADOS. Dispensável por sessão. */
export function VinculoGate() {
  const { linked, loading, ready, refetch } = useVinculoEmpregado();
  // Dispensa em memória: "Agora não" some durante a navegação, mas ao recarregar
  // a página (ou novo login) o card reaparece enquanto o usuário não vincular.
  const [dismissed, setDismissed] = useState(false);

  if (loading || !ready || linked || dismissed) return null;

  return <VincularModal onClose={() => setDismissed(true)} onLinked={() => { refetch(); }} />;
}

function VincularModal({ onClose, onLinked }: { onClose: () => void; onLinked: () => void }) {
  const [cpf, setCpf] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [preview, setPreview] = useState<EmpregadoVinculo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const buscar = async () => {
    setError(null);
    if (cpf.replace(/\D/g, "").length !== 11) return setError("Informe um CPF válido.");
    if (nascimento.replace(/\D/g, "").length !== 8) return setError("Informe a data de nascimento (DD/MM/AAAA).");
    setLoading(true);
    const r = await vincularRpc(cpf, nascimento, false);
    setLoading(false);
    if (!r.ok) return setError(r.error ?? "Não foi possível localizar o cadastro.");
    setPreview(r.empregado as EmpregadoVinculo);
  };

  const confirmar = async () => {
    setError(null);
    setLoading(true);
    const r = await vincularRpc(cpf, nascimento, true);
    setLoading(false);
    if (!r.ok) return setError(r.error ?? "Não foi possível vincular.");
    setDone(true);
    setTimeout(() => onLinked(), 1200);
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground" aria-label="Fechar">
          <X className="h-5 w-5" />
        </button>

        {done ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-success" />
            <h3 className="font-display text-lg font-bold">Cadastro vinculado!</h3>
            <p className="mt-1 text-sm text-muted-foreground">Sua conta agora está ligada ao seu cadastro de colaborador.</p>
          </div>
        ) : !preview ? (
          <>
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
              <IdCard className="h-3 w-3" /> Vincule seu usuário
            </div>
            <h3 className="font-display text-xl font-bold">Vincule seu cadastro</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Informe seu CPF e data de nascimento para ligar sua conta ao seu cadastro de colaborador (cargo, setor, liderança).
            </p>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>{error}</p>
              </div>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">CPF</label>
                <div className="relative">
                  <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} inputMode="numeric"
                    placeholder="000.000.000-00" autoFocus
                    className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">Data de nascimento</label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={nascimento} onChange={(e) => setNascimento(maskData(e.target.value))} inputMode="numeric"
                    placeholder="DD/MM/AAAA"
                    onKeyDown={(e) => { if (e.key === "Enter") buscar(); }}
                    className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30" />
                </div>
              </div>
            </div>

            <button onClick={buscar} disabled={loading}
              className="btn-relief mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gradient-accent text-sm font-semibold text-accent-foreground disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Localizar meu cadastro <ArrowRight className="h-4 w-4" /></>}
            </button>
            <button onClick={onClose} className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-foreground">
              Agora não
            </button>
          </>
        ) : (
          <>
            <h3 className="font-display text-xl font-bold">Confirme seu cadastro</h3>
            <p className="mt-1 text-sm text-muted-foreground">É você? Confirme para vincular sua conta.</p>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>{error}</p>
              </div>
            )}

            <div className="mt-4 rounded-xl border border-border bg-background p-4">
              <p className="font-semibold text-foreground">{preview.nome}</p>
              <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                {preview.cargo && <p className="flex items-center gap-2"><Briefcase className="h-3.5 w-3.5 text-accent" /> {preview.cargo}</p>}
                {(preview.empresa || preview.filial) && <p className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-accent" /> {[preview.empresa, preview.filial].filter(Boolean).join(" · ")}</p>}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {preview.setor && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">{preview.setor}</span>}
                  {preview.perfil && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{preview.perfil}</span>}
                  {preview.admissao && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Admissão {preview.admissao}</span>}
                </div>
              </div>
            </div>

            <button onClick={confirmar} disabled={loading}
              className="btn-relief mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gradient-accent text-sm font-semibold text-accent-foreground disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Confirmar vínculo <CheckCircle2 className="h-4 w-4" /></>}
            </button>
            <button onClick={() => { setPreview(null); setError(null); }} className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-foreground">
              Não sou eu / corrigir dados
            </button>
          </>
        )}
      </div>
    </div>
  );
}
