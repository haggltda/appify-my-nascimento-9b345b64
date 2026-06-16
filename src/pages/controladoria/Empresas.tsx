import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ShieldAlert, CheckCircle2, Pencil, Loader2 } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Regime = "lucro_real" | "lucro_presumido" | "simples_nacional";

type Empresa = {
  id: string;
  codigo: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  regime: Regime;
  ativa: boolean;
  vincular_orcamento_padrao: boolean;
};

export default function Empresas() {
  const { toast } = useToast();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Empresa | null>(null);

  const fetchEmpresas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("empresas")
      .select("id, codigo, razao_social, nome_fantasia, cnpj, regime, ativa, vincular_orcamento_padrao")
      .order("codigo");
    if (error) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    } else {
      setEmpresas((data ?? []) as Empresa[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchEmpresas(); }, []);

  const salvar = async () => {
    if (!editing) return;
    const { error } = await supabase
      .from("empresas")
      .update({
        razao_social: editing.razao_social,
        nome_fantasia: editing.nome_fantasia,
        cnpj: editing.cnpj,
        regime: editing.regime,
        ativa: editing.ativa,
        vincular_orcamento_padrao: editing.vincular_orcamento_padrao,
      })
      .eq("id", editing.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Empresa atualizada", description: editing.codigo });
    setEditing(null);
    fetchEmpresas();
  };

  return (
    <div>
      <PageHeader
        module="Controladoria & Orçamento"
        breadcrumb={["Cadastros Mestres", "Empresas"]}
        title="Empresas do Grupo Nascimento"
        subtitle="Catálogo das pessoas jurídicas do grupo. Edição restrita a administradores."
      />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando empresas…
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {empresas.map((e) => (
            <div key={e.id} className="card-elevated p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary text-sm font-bold">
                  {e.codigo}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{e.razao_social}</p>
                  <p className="font-mono text-xs text-muted-foreground">{e.cnpj}</p>
                </div>
                {e.ativa ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">
                    <CheckCircle2 className="h-3 w-3" />
                    Ativa
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-warning-soft px-2 py-0.5 text-[10px] font-semibold text-warning">
                    <ShieldAlert className="h-3 w-3" />
                    Inativa
                  </span>
                )}
              </div>

              <RoleGate acao="alterar" modulo="empresas">
                <button
                  data-write
                  onClick={() => setEditing(e)}
                  className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-card text-xs font-semibold hover:bg-secondary"
                >
                  <Pencil className="h-3 w-3" /> Editar empresa
                </button>
              </RoleGate>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Regime</dt>
                  <dd className="mt-0.5 font-medium text-foreground">{e.regime}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Nome fantasia</dt>
                  <dd className="mt-0.5 font-medium text-foreground">{e.nome_fantasia ?? "—"}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">ID interno (empresa_id)</dt>
                  <dd className="mt-0.5 font-mono text-foreground">{e.id}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}

      {/* Modal de edição simples */}
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="card-elevated w-full max-w-md p-6">
            <h3 className="font-display text-lg font-bold">Editar empresa {editing.codigo}</h3>
            <div className="mt-4 space-y-3">
              <Field label="Razão social">
                <input
                  value={editing.razao_social}
                  onChange={(e) => setEditing({ ...editing, razao_social: e.target.value })}
                  className="input-base"
                />
              </Field>
              <Field label="Nome fantasia">
                <input
                  value={editing.nome_fantasia ?? ""}
                  onChange={(e) => setEditing({ ...editing, nome_fantasia: e.target.value })}
                  className="input-base"
                />
              </Field>
              <Field label="CNPJ">
                <input
                  value={editing.cnpj}
                  onChange={(e) => setEditing({ ...editing, cnpj: e.target.value })}
                  className="input-base"
                />
              </Field>
              <Field label="Regime">
                <select
                  value={editing.regime}
                  onChange={(e) => setEditing({ ...editing, regime: e.target.value as Regime })}
                  className="input-base"
                >
                  <option value="lucro_real">Lucro Real</option>
                  <option value="lucro_presumido">Lucro Presumido</option>
                  <option value="simples_nacional">Simples Nacional</option>
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.ativa}
                  onChange={(e) => setEditing({ ...editing, ativa: e.target.checked })}
                />
                Ativa
              </label>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={editing.vincular_orcamento_padrao}
                    onChange={(e) => setEditing({ ...editing, vincular_orcamento_padrao: e.target.checked })}
                  />
                  <span>
                    <strong className="block">Vincular orçamento por padrão</strong>
                    <span className="text-xs text-muted-foreground">
                      Quando ativo, requisições que estouram o orçamento do CC exigem 2ª aprovação ("ultrapassar orçamento"). CCs podem sobrescrever.
                    </span>
                  </span>
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="h-9 rounded-md border border-border px-3 text-xs font-semibold hover:bg-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                className="btn-relief h-9 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-foreground">{label}</label>
      {children}
    </div>
  );
}
