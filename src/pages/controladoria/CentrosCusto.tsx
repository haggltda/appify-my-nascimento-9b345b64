import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Building2, Plus, PowerOff, Loader2, FileBadge, AlertTriangle, UserCog, Building } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { TrocarEmpresaCCDialog } from "./TrocarEmpresaCCDialog";

type CCTipo = "adm" | "operacional";

type CCOrigem = "manual" | "contrato" | "licitacao" | "rateio" | "corporativo";

type CentroCusto = {
  id: string;
  empresa_id: string;
  codigo: string;
  nome: string;
  tipo: CCTipo;
  responsavel: string | null;
  ativo: boolean;
  origem_cadastro: CCOrigem;
  codigo_legado: boolean;
  entidade_origem_tabela: string | null;
  vincular_orcamento: boolean | null;
  gestor_user_id: string | null;
};

type Empresa = { id: string; codigo: string; razao_social: string };

export default function CentrosCusto() {
  const { toast } = useToast();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [lista, setLista] = useState<CentroCusto[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<{ empresa_id: string; codigo: string; nome: string; tipo: CCTipo; responsavel: string }>({
    empresa_id: "",
    codigo: "",
    nome: "",
    tipo: "adm",
    responsavel: "",
  });

  const fetchAll = async () => {
    setLoading(true);
    const [emp, cc] = await Promise.all([
      supabase.from("empresas").select("id, codigo, razao_social").order("codigo"),
      supabase.from("centros_custo").select("*").order("codigo"),
    ]);
    if (emp.error) toast({ title: "Erro empresas", description: emp.error.message, variant: "destructive" });
    if (cc.error) toast({ title: "Erro centros de custo", description: cc.error.message, variant: "destructive" });
    setEmpresas(emp.data ?? []);
    setLista((cc.data ?? []) as CentroCusto[]);
    if (!draft.empresa_id && emp.data?.[0]) {
      setDraft((d) => ({ ...d, empresa_id: emp.data![0].id }));
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const adicionar = async () => {
    if (!draft.codigo.trim() || !draft.nome.trim() || !draft.empresa_id) {
      toast({ title: "Campos obrigatórios", description: "Empresa, código e nome.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("centros_custo").insert({
      empresa_id: draft.empresa_id,
      codigo: draft.codigo,
      nome: draft.nome,
      tipo: draft.tipo,
      responsavel: draft.responsavel || null,
      ativo: true,
    });
    if (error) {
      toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "CC criado — atribua um gestor",
      description: `${draft.codigo} foi criado sem gestor. Enquanto não houver gestor, requisições para este CC serão bloqueadas. Defina em Administração → Alçadas → Gestores de CC.`,
      duration: 8000,
    });
    setDraft({ empresa_id: empresas[0]?.id ?? "", codigo: "", nome: "", tipo: "adm", responsavel: "" });
    fetchAll();
  };

  const toggle = async (cc: CentroCusto) => {
    const { error } = await supabase
      .from("centros_custo")
      .update({ ativo: !cc.ativo })
      .eq("id", cc.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    fetchAll();
  };

  const setVincular = async (cc: CentroCusto, value: boolean | null) => {
    const { error } = await supabase
      .from("centros_custo")
      .update({ vincular_orcamento: value })
      .eq("id", cc.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Vincular orçamento atualizado", description: cc.codigo });
    fetchAll();
  };

  const adm = lista.filter((c) => c.tipo === "adm");
  const op = lista.filter((c) => c.tipo === "operacional");

  const semGestor = lista.filter((c) => c.ativo && !c.gestor_user_id);

  return (
    <div>
      <PageHeader
        module="Controladoria & Orçamento"
        breadcrumb={["Cadastros Mestres", "Centros de Custo"]}
        title="Centros de Custo"
        subtitle="Cadastro de CCs administrativos e operacionais por empresa. CRUD restrito à Controladoria."
      />

      {!loading && semGestor.length > 0 && (
        <div className="card-elevated mb-4 flex items-start gap-3 border-l-4 border-warning bg-warning-soft/30 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="flex-1">
            <p className="font-semibold text-foreground">
              {semGestor.length} centro{semGestor.length > 1 ? "s" : ""} de custo ativo{semGestor.length > 1 ? "s" : ""} sem gestor atribuído
            </p>
            <p className="text-xs text-muted-foreground">
              Requisições para CCs sem gestor são bloqueadas pelo motor de aprovação. Defina o gestor responsável para liberar o fluxo.
            </p>
          </div>
          <Link
            to="/app/administracao?tab=alcadas&sub=gestores-cc"
            className="btn-relief inline-flex h-8 items-center gap-1.5 rounded-md bg-warning px-3 text-xs font-semibold text-warning-foreground"
          >
            <UserCog className="h-3.5 w-3.5" /> Atribuir gestores
          </Link>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <>
          <RoleGate acao="incluir" modulo="centros_custo">
            <section className="card-elevated mb-6 p-4">
              <header className="mb-3 flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Novo centro de custo</h2>
              </header>
              <div className="grid gap-2 sm:grid-cols-[160px_140px_1fr_140px_180px_auto]">
                <select
                  value={draft.empresa_id}
                  onChange={(e) => setDraft((d) => ({ ...d, empresa_id: e.target.value }))}
                  className="h-9 rounded-md border border-border bg-card px-2 text-sm"
                >
                  {empresas.map((e) => <option key={e.id} value={e.id}>{e.codigo}</option>)}
                </select>
                <input
                  placeholder="Código"
                  value={draft.codigo}
                  onChange={(e) => setDraft((d) => ({ ...d, codigo: e.target.value }))}
                  className="h-9 rounded-md border border-border bg-card px-3 text-sm"
                />
                <input
                  placeholder="Nome do CC"
                  value={draft.nome}
                  onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))}
                  className="h-9 rounded-md border border-border bg-card px-3 text-sm"
                />
                <select
                  value={draft.tipo}
                  onChange={(e) => setDraft((d) => ({ ...d, tipo: e.target.value as CCTipo }))}
                  className="h-9 rounded-md border border-border bg-card px-2 text-sm"
                >
                  <option value="adm">Administrativo</option>
                  <option value="operacional">Operacional</option>
                </select>
                <input
                  placeholder="Responsável"
                  value={draft.responsavel}
                  onChange={(e) => setDraft((d) => ({ ...d, responsavel: e.target.value }))}
                  className="h-9 rounded-md border border-border bg-card px-3 text-sm"
                />
                <button
                  data-write
                  onClick={adicionar}
                  className="btn-relief inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </button>
              </div>
            </section>
          </RoleGate>

          <CCSection titulo={`Administrativos (${adm.length})`} icone={<FileBadge className="h-4 w-4 text-primary" />} lista={adm} empresas={empresas} onToggle={toggle} onSetVincular={setVincular} onReload={fetchAll} />
          <CCSection titulo={`Operacionais (${op.length})`} icone={<Building2 className="h-4 w-4 text-accent" />} lista={op} empresas={empresas} onToggle={toggle} onSetVincular={setVincular} onReload={fetchAll} />
        </>
      )}
    </div>
  );
}

function CCSection({
  titulo, icone, lista, empresas, onToggle, onSetVincular, onReload,
}: {
  titulo: string;
  icone: React.ReactNode;
  lista: CentroCusto[];
  empresas: Empresa[];
  onToggle: (cc: CentroCusto) => void;
  onSetVincular: (cc: CentroCusto, value: boolean | null) => void;
  onReload: () => void;
}) {
  const [trocaCC, setTrocaCC] = useState<CentroCusto | null>(null);
  const empresaCodigo = (id: string) => empresas.find((e) => e.id === id)?.codigo ?? "—";
  return (
    <section className="mb-6">
      <header className="mb-3 flex items-center gap-2">
        {icone}
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</h2>
      </header>
      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Código</th>
              <th className="px-4 py-2 text-left">Nome</th>
              <th className="px-4 py-2 text-left">Empresa</th>
              <th className="px-4 py-2 text-left">Origem</th>
              <th className="px-4 py-2 text-left">Responsável</th>
              <th className="px-4 py-2 text-left">Vincular orçamento</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-xs text-muted-foreground">
                  Nenhum centro de custo cadastrado.
                </td>
              </tr>
            ) : (
              lista.map((c) => (
                <tr key={c.id} className="border-t border-border/60">
                  <td className="px-4 py-2 font-mono text-xs font-semibold text-primary">
                    {c.codigo}
                    {c.codigo_legado && <span className="ml-2 chip bg-muted text-[10px] text-muted-foreground">legado</span>}
                  </td>
                  <td className="px-4 py-2">{c.nome}</td>
                  <td className="px-4 py-2 font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <span>{empresaCodigo(c.empresa_id)}</span>
                      <RoleGate acao="alterar" modulo="centros_custo">
                        <button
                          data-write
                          onClick={() => setTrocaCC(c)}
                          title="Trocar empresa do CC (admin)"
                          className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary"
                        >
                          <Building className="h-3 w-3" />
                        </button>
                      </RoleGate>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`chip text-[10px] ${
                      c.origem_cadastro === "manual" ? "bg-muted text-muted-foreground" :
                      c.origem_cadastro === "contrato" ? "bg-primary/10 text-primary" :
                      "bg-accent/10 text-accent"
                    }`}>
                      {c.origem_cadastro}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {c.responsavel ?? "—"}
                    {c.ativo && !c.gestor_user_id && (
                      <span className="ml-2 chip bg-warning-soft text-[10px] text-warning" title="Sem gestor atribuído — requisições serão bloqueadas">
                        sem gestor
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <RoleGate acao="alterar" modulo="centros_custo">
                      <select
                        data-write
                        value={c.vincular_orcamento === null ? "herda" : c.vincular_orcamento ? "sim" : "nao"}
                        onChange={(e) => {
                          const v = e.target.value;
                          onSetVincular(c, v === "herda" ? null : v === "sim");
                        }}
                        className="h-7 rounded-md border border-border bg-card px-2 text-[11px]"
                        title="Herda = usa o padrão da empresa. Sim/Não = sobrescreve."
                      >
                        <option value="herda">Herda da empresa</option>
                        <option value="sim">Sim</option>
                        <option value="nao">Não</option>
                      </select>
                    </RoleGate>
                  </td>
                  <td className="px-4 py-2">
                    <span className={c.ativo ? "chip bg-success-soft text-success" : "chip bg-muted text-muted-foreground"}>
                      {c.ativo ? "ativo" : "inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <RoleGate acao="alterar" modulo="centros_custo">
                      <button
                        data-write
                        onClick={() => onToggle(c)}
                        disabled={c.origem_cadastro !== "manual" && c.entidade_origem_tabela === "contrato"}
                        title={c.origem_cadastro !== "manual" ? "CC vinculado a contrato — gerenciado automaticamente" : ""}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <PowerOff className="h-3 w-3" />
                        {c.ativo ? "Desativar" : "Reativar"}
                      </button>
                    </RoleGate>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
