import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, ShieldCheck, Ban, Loader2 } from "lucide-react";

type Empresa = { id: string; codigo: string };

type Props = {
  open: boolean;
  onClose: () => void;
  ccId: string;
  ccCodigo: string;
  empresaAtualId: string;
  empresas: Empresa[];
  onSuccess: () => void;
};

type Diagnostico = Record<string, number | string | null>;
type Cenario = "livre" | "confirmacao" | "bloqueado" | null;

export function TrocarEmpresaCCDialog({ open, onClose, ccId, ccCodigo, empresaAtualId, empresas, onSuccess }: Props) {
  const { toast } = useToast();
  const [novaEmpresa, setNovaEmpresa] = useState(empresaAtualId);
  const [motivo, setMotivo] = useState("");
  const [cenario, setCenario] = useState<Cenario>(null);
  const [diag, setDiag] = useState<Diagnostico | null>(null);
  const [loadingDiag, setLoadingDiag] = useState(false);
  const [saving, setSaving] = useState(false);
  const [temPermissao, setTemPermissao] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) return;
    setNovaEmpresa(empresaAtualId);
    setMotivo("");
    setLoadingDiag(true);
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const [cenR, diagR, permR] = await Promise.all([
        supabase.rpc("pode_alterar_empresa_cc", { _cc_id: ccId }),
        supabase.rpc("diagnostico_alterar_empresa_cc", { _cc_id: ccId }),
        u.user ? supabase.rpc("tem_permissao_especial", { _user_id: u.user.id, _permissao: "alterar_empresa_cc" }) : Promise.resolve({ data: false, error: null }),
      ]);
      if (!cenR.error) setCenario(cenR.data as Cenario);
      if (!diagR.error) setDiag(diagR.data as Diagnostico);
      setTemPermissao(!permR.error ? !!permR.data : false);
      setLoadingDiag(false);
    })();
  }, [open, ccId, empresaAtualId]);

  if (!open) return null;

  const handleSalvar = async () => {
    if (cenario === "bloqueado") return;
    if (novaEmpresa === empresaAtualId) {
      toast({ title: "Selecione uma empresa diferente.", variant: "destructive" });
      return;
    }
    if (motivo.trim().length < 5) {
      toast({ title: "Motivo obrigatório (≥ 5 caracteres).", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("admin_alterar_empresa_cc", {
      _cc_id: ccId,
      _nova_empresa_id: novaEmpresa,
      _motivo: motivo,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao alterar empresa", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Empresa alterada", description: `CC ${ccCodigo} agora pertence à nova empresa.` });
    onSuccess();
    onClose();
  };

  const movimentos = diag
    ? Object.entries(diag).filter(([k, v]) => typeof v === "number" && (v as number) > 0 && k !== "contrato_count" && k !== "total_movimento")
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card-elevated w-full max-w-lg bg-card p-6">
        <header className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Trocar empresa do CC {ccCodigo}</h3>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Fechar</button>
        </header>

        {loadingDiag ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Analisando vínculos…
          </div>
        ) : (
          <>
            {temPermissao === false && (
              <div className="mb-4 flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <Ban className="h-4 w-4 mt-0.5" />
                <div>
                  <p className="font-semibold">Sem permissão especial</p>
                  <p className="text-xs">Você precisa da permissão <code>alterar_empresa_cc</code>. Solicite a um administrador em <strong>Administração → Alçadas → Saúde</strong>.</p>
                </div>
              </div>
            )}
            {cenario === "livre" && (
              <div className="mb-4 flex items-start gap-2 rounded-md bg-success-soft p-3 text-sm text-success">
                <ShieldCheck className="h-4 w-4 mt-0.5" />
                <div>
                  <p className="font-semibold">Cenário (a) — edição livre</p>
                  <p className="text-xs">CC sem movimento. Troca segura.</p>
                </div>
              </div>
            )}
            {cenario === "confirmacao" && (
              <div className="mb-4 flex items-start gap-2 rounded-md bg-warning-soft p-3 text-sm text-warning">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <div>
                  <p className="font-semibold">Cenário (b) — requer confirmação</p>
                  <p className="text-xs">Contrato vinculado já ativo (sem movimento financeiro). A troca será registrada em auditoria.</p>
                </div>
              </div>
            )}
            {cenario === "bloqueado" && (
              <div className="mb-4 flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <Ban className="h-4 w-4 mt-0.5" />
                <div>
                  <p className="font-semibold">Cenário (c) — bloqueado</p>
                  <p className="text-xs">Existem movimentos vinculados. Correção exige estorno/reemissão.</p>
                </div>
              </div>
            )}

            {movimentos.length > 0 && (
              <div className="mb-4 rounded-md border border-border p-3 text-xs">
                <p className="mb-1 font-semibold text-muted-foreground">Vínculos detectados</p>
                <ul className="grid grid-cols-2 gap-x-3">
                  {movimentos.map(([k, v]) => (
                    <li key={k} className="flex justify-between">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-mono">{v as number}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Nova empresa</label>
            <select
              value={novaEmpresa}
              onChange={(e) => setNovaEmpresa(e.target.value)}
              disabled={cenario === "bloqueado"}
              className="mb-4 h-9 w-full rounded-md border border-border bg-card px-2 text-sm disabled:opacity-50"
            >
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.codigo}</option>
              ))}
            </select>

            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Motivo (obrigatório)</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={cenario === "bloqueado"}
              rows={3}
              placeholder="Justifique a alteração para fins de auditoria…"
              className="mb-4 w-full rounded-md border border-border bg-card p-2 text-sm disabled:opacity-50"
            />

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary">
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={cenario === "bloqueado" || saving || !temPermissao}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                Confirmar troca
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
