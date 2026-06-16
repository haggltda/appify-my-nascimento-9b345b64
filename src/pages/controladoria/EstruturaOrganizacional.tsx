import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Network, Plus, PowerOff, Loader2, Users, Building2, Layers } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Empresa = { id: string; codigo: string; razao_social: string };
type Comite = { id: string; empresa_id: string; nome: string; descricao: string | null; gestor_profile_id: string | null; ativo: boolean };
type Area   = { id: string; empresa_id: string; comite_id: string; nome: string; gestor_profile_id: string | null; centro_custo_id: string | null; ativo: boolean };
type Setor  = { id: string; empresa_id: string; area_id: string; nome: string; gestor_profile_id: string | null; centro_custo_id: string | null; ativo: boolean };
type CC     = { id: string; codigo: string; nome: string; empresa_id: string };

export default function EstruturaOrganizacional() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [comites, setComites] = useState<Comite[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [ccs, setCcs] = useState<CC[]>([]);
  const [comiteSel, setComiteSel] = useState<string>("");
  const [areaSel, setAreaSel] = useState<string>("");

  const [novoComite, setNovoComite] = useState("");
  const [novaArea, setNovaArea] = useState("");
  const [novoSetor, setNovoSetor] = useState("");
  const [areaCC, setAreaCC] = useState<string>("");
  const [setorCC, setSetorCC] = useState<string>("");

  const fetchAll = async () => {
    setLoading(true);
    const [emp, c, a, s, cc] = await Promise.all([
      supabase.from("empresas").select("id, codigo, razao_social").order("codigo"),
      supabase.from("comite").select("*").order("nome"),
      supabase.from("area").select("*").order("nome"),
      supabase.from("setor").select("*").order("nome"),
      supabase.from("centros_custo").select("id, codigo, nome, empresa_id").eq("ativo", true).order("codigo"),
    ]);
    if (emp.error || c.error || a.error || s.error || cc.error) {
      toast({ title: "Erro ao carregar", description: (emp.error||c.error||a.error||s.error||cc.error)?.message, variant: "destructive" });
    }
    setEmpresas(emp.data ?? []);
    setComites((c.data ?? []) as Comite[]);
    setAreas((a.data ?? []) as Area[]);
    setSetores((s.data ?? []) as Setor[]);
    setCcs((cc.data ?? []) as CC[]);
    if (!empresaId && emp.data?.[0]) setEmpresaId(emp.data[0].id);
    setLoading(false);
  };
  useEffect(() => { fetchAll(); }, []);

  const comitesEmp = useMemo(() => comites.filter(c => c.empresa_id === empresaId), [comites, empresaId]);
  const areasComite = useMemo(() => areas.filter(a => a.comite_id === comiteSel), [areas, comiteSel]);
  const setoresArea = useMemo(() => setores.filter(s => s.area_id === areaSel), [setores, areaSel]);
  const ccsEmp = useMemo(() => ccs.filter(c => c.empresa_id === empresaId), [ccs, empresaId]);

  const addComite = async () => {
    if (!novoComite.trim() || !empresaId) return;
    const { error } = await supabase.from("comite").insert({ empresa_id: empresaId, nome: novoComite.trim() });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    setNovoComite(""); fetchAll();
  };
  const addArea = async () => {
    if (!novaArea.trim() || !comiteSel) return;
    const { error } = await supabase.from("area").insert({
      empresa_id: empresaId, comite_id: comiteSel, nome: novaArea.trim(),
      centro_custo_id: areaCC || null,
    });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    setNovaArea(""); setAreaCC(""); fetchAll();
  };
  const addSetor = async () => {
    if (!novoSetor.trim() || !areaSel) return;
    const { error } = await supabase.from("setor").insert({
      empresa_id: empresaId, area_id: areaSel, nome: novoSetor.trim(),
      centro_custo_id: setorCC || null,
    });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    setNovoSetor(""); setSetorCC(""); fetchAll();
  };
  const toggle = async (table: "comite"|"area"|"setor", id: string, ativo: boolean) => {
    const { error } = await supabase.from(table).update({ ativo: !ativo }).eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    fetchAll();
  };

  const ccLabel = (id: string | null) => id ? (ccs.find(c => c.id === id)?.codigo ?? "—") : "—";

  return (
    <div>
      <PageHeader
        module="Controladoria & Orçamento"
        breadcrumb={["Cadastros Mestres", "Estrutura Organizacional"]}
        title="Estrutura Organizacional"
        subtitle="Comitê → Área → Setor. Hierarquia padronizada por empresa, com gestor e CC opcional por nível."
      />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Empresa</label>
            <select
              value={empresaId}
              onChange={(e) => { setEmpresaId(e.target.value); setComiteSel(""); setAreaSel(""); }}
              className="h-9 rounded-md border border-border bg-card px-2 text-sm"
            >
              {empresas.map(e => <option key={e.id} value={e.id}>{e.codigo} — {e.razao_social}</option>)}
            </select>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* COMITÊS */}
            <Coluna icon={<Network className="h-4 w-4 text-primary" />} titulo={`Comitês (${comitesEmp.length})`}>
              <RoleGate acao="incluir" modulo="centros_custo">
                <div className="mb-2 flex gap-1">
                  <input value={novoComite} onChange={(e) => setNovoComite(e.target.value)}
                    placeholder="Novo comitê" className="h-8 flex-1 rounded-md border border-border bg-card px-2 text-sm" />
                  <button data-write onClick={addComite}
                    className="btn-relief inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2 text-xs font-semibold text-primary-foreground">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </RoleGate>
              <Lista
                itens={comitesEmp.map(c => ({ id: c.id, nome: c.nome, ativo: c.ativo, sub: null }))}
                selecionado={comiteSel}
                onSelect={(id) => { setComiteSel(id); setAreaSel(""); }}
                onToggle={(id, ativo) => toggle("comite", id, ativo)}
              />
            </Coluna>

            {/* ÁREAS */}
            <Coluna icon={<Building2 className="h-4 w-4 text-accent" />} titulo={`Áreas (${areasComite.length})`} subtitulo={comiteSel ? "" : "Selecione um comitê"}>
              {comiteSel && (
                <RoleGate acao="incluir" modulo="centros_custo">
                  <div className="mb-2 grid gap-1">
                    <input value={novaArea} onChange={(e) => setNovaArea(e.target.value)}
                      placeholder="Nova área" className="h-8 rounded-md border border-border bg-card px-2 text-sm" />
                    <div className="flex gap-1">
                      <select value={areaCC} onChange={(e) => setAreaCC(e.target.value)}
                        className="h-8 flex-1 rounded-md border border-border bg-card px-2 text-xs">
                        <option value="">Sem CC</option>
                        {ccsEmp.map(c => <option key={c.id} value={c.id}>{c.codigo} — {c.nome}</option>)}
                      </select>
                      <button data-write onClick={addArea}
                        className="btn-relief inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2 text-xs font-semibold text-primary-foreground">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </RoleGate>
              )}
              <Lista
                itens={areasComite.map(a => ({ id: a.id, nome: a.nome, ativo: a.ativo, sub: ccLabel(a.centro_custo_id) }))}
                selecionado={areaSel}
                onSelect={setAreaSel}
                onToggle={(id, ativo) => toggle("area", id, ativo)}
              />
            </Coluna>

            {/* SETORES */}
            <Coluna icon={<Layers className="h-4 w-4 text-success" />} titulo={`Setores (${setoresArea.length})`} subtitulo={areaSel ? "" : "Selecione uma área"}>
              {areaSel && (
                <RoleGate acao="incluir" modulo="centros_custo">
                  <div className="mb-2 grid gap-1">
                    <input value={novoSetor} onChange={(e) => setNovoSetor(e.target.value)}
                      placeholder="Novo setor" className="h-8 rounded-md border border-border bg-card px-2 text-sm" />
                    <div className="flex gap-1">
                      <select value={setorCC} onChange={(e) => setSetorCC(e.target.value)}
                        className="h-8 flex-1 rounded-md border border-border bg-card px-2 text-xs">
                        <option value="">Sem CC</option>
                        {ccsEmp.map(c => <option key={c.id} value={c.id}>{c.codigo} — {c.nome}</option>)}
                      </select>
                      <button data-write onClick={addSetor}
                        className="btn-relief inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2 text-xs font-semibold text-primary-foreground">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </RoleGate>
              )}
              <Lista
                itens={setoresArea.map(s => ({ id: s.id, nome: s.nome, ativo: s.ativo, sub: ccLabel(s.centro_custo_id) }))}
                selecionado=""
                onSelect={() => {}}
                onToggle={(id, ativo) => toggle("setor", id, ativo)}
              />
            </Coluna>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            <Users className="inline h-3 w-3" /> Vínculos com Plano de Ações, Colaboradores e demais módulos serão habilitados em fase posterior — nada foi alterado nas telas existentes.
          </p>
        </>
      )}
    </div>
  );
}

function Coluna({ icon, titulo, subtitulo, children }: { icon: React.ReactNode; titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <section className="card-elevated p-3">
      <header className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold">{titulo}</h2>
        {subtitulo && <span className="text-[11px] text-muted-foreground">— {subtitulo}</span>}
      </header>
      {children}
    </section>
  );
}

function Lista({ itens, selecionado, onSelect, onToggle }:{
  itens: { id: string; nome: string; ativo: boolean; sub: string | null }[];
  selecionado: string;
  onSelect: (id: string) => void;
  onToggle: (id: string, ativo: boolean) => void;
}) {
  if (itens.length === 0) return <p className="px-1 py-2 text-xs text-muted-foreground">Nenhum registro.</p>;
  return (
    <ul className="divide-y divide-border/60 rounded-md border border-border/60">
      {itens.map(i => (
        <li key={i.id} className={`flex items-center justify-between px-2 py-1.5 text-sm ${selecionado === i.id ? "bg-primary/5" : ""}`}>
          <button onClick={() => onSelect(i.id)} className="flex-1 text-left">
            <span className={i.ativo ? "" : "line-through text-muted-foreground"}>{i.nome}</span>
            {i.sub && <span className="ml-2 font-mono text-[10px] text-muted-foreground">{i.sub}</span>}
          </button>
          <RoleGate acao="alterar" modulo="centros_custo">
            <button data-write onClick={() => onToggle(i.id, i.ativo)}
              className="ml-2 inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-secondary">
              <PowerOff className="h-2.5 w-2.5" />
              {i.ativo ? "off" : "on"}
            </button>
          </RoleGate>
        </li>
      ))}
    </ul>
  );
}
