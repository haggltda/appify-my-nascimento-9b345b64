import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { usePlanoAcoes } from "@/hooks/usePlanoAcoes";
import { usePlanoAcaoPermissao } from "@/hooks/usePlanoAcaoPermissao";
import { usePlanoAcaoFilterOptions, matchResponsavel } from "@/hooks/usePlanoAcaoFilterOptions";
import { STATUS_LABELS, STATUS_COR, PRIORIDADE_LABEL, PRIORIDADE_COR, STATUS_ORDEM, PRIORIDADES } from "@/types/planoAcao";
import { Plus, Search, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";

const fmtDate = (s: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(+d) ? s : d.toLocaleDateString("pt-BR");
};

export default function PlanoAcoesLista() {
  const { data: rows = [], isLoading } = usePlanoAcoes();
  const { can, loading: lp } = usePlanoAcaoPermissao();
  const [busca, setBusca] = useState("");

  const [fStatus, setFStatus] = useState<string>("__all");
  const [fPrior, setFPrior] = useState<string>("__all");
  const [fComite, setFComite] = useState<string>("__all");
  const [fArea, setFArea] = useState<string>("__all");
  const [fSetor, setFSetor] = useState<string>("__all");
  const [fResp, setFResp] = useState<string>("__all");

  const { comites, areas, setores, responsaveis } = usePlanoAcaoFilterOptions(rows);

  // Limpa filtros que deixaram de existir após troca de empresa / mudança das rows.
  useEffect(() => {
    if (fComite !== "__all" && !comites.some(o => o.value === fComite)) setFComite("__all");
    if (fArea !== "__all" && !areas.some(o => o.value === fArea)) setFArea("__all");
    if (fSetor !== "__all" && !setores.some(o => o.value === fSetor)) setFSetor("__all");
    if (fResp !== "__all" && !responsaveis.some(o => o.value === fResp)) setFResp("__all");
  }, [comites, areas, setores, responsaveis, fComite, fArea, fSetor, fResp]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter(r => {
      if (fStatus !== "__all" && r.status_normalizado !== fStatus) return false;
      if (fPrior !== "__all" && r.prioridade_normalizada !== fPrior) return false;
      if (fComite !== "__all" && r.comite !== fComite) return false;
      if (fArea !== "__all" && r.area !== fArea) return false;
      if (fSetor !== "__all" && r.setor !== fSetor) return false;
      if (!matchResponsavel(r, fResp)) return false;
      if (!q) return true;
      return [r.titulo, r.problema, r.acao, r.responsavel_nome_origem, r.id_importacao]
        .filter(Boolean).some(s => (s as string).toLowerCase().includes(q));
    });
  }, [rows, busca, fStatus, fPrior, fComite, fArea, fSetor, fResp]);

  if (lp) return null;
  if (!can("visualizar")) return <ForbiddenCard />;

  return (
    <div>
      <PageHeader
        title="Plano de Ações"
        subtitle="Gerenciador de Tarefas Nascimento — todas as ações, com filtros, status e pendências"
        module="Plano de Ações"
        breadcrumb={["Lista geral"]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/app/plano-acoes/dashboard">Dashboard</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/app/plano-acoes/kanban">Kanban</Link></Button>
            {can("importar") && <Button asChild variant="outline" size="sm"><Link to="/app/plano-acoes/importar">Importar</Link></Button>}
            {can("criar") && <Button asChild size="sm"><Link to="/app/plano-acoes/nova"><Plus className="mr-1 h-4 w-4" />Nova ação</Link></Button>}
          </div>
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar por título, problema, ação, responsável..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os status</SelectItem>
              {STATUS_ORDEM.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fPrior} onValueChange={setFPrior}>
            <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas as prioridades</SelectItem>
              {PRIORIDADES.map(p => <SelectItem key={p} value={p}>{PRIORIDADE_LABEL[p]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fComite} onValueChange={setFComite}>
            <SelectTrigger><SelectValue placeholder="Comitê" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os comitês</SelectItem>
              {comites.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fArea} onValueChange={setFArea}>
            <SelectTrigger><SelectValue placeholder="Área" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas as áreas</SelectItem>
              {areas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{filtered.length} de {rows.length} ações</span>
          <span className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-destructive" /> {rows.filter(r => r.status_normalizado === "atrasada").length} atrasadas</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-amber-600" /> {rows.filter(r => r.pendencia_evidencia).length} aguardam evidência</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-600" /> {rows.filter(r => r.status_normalizado === "concluida_validada").length} validadas</span>
          </span>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="max-h-[calc(100vh-360px)] overflow-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="sticky top-0 z-10 bg-muted/50 backdrop-blur">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-2 px-3">ID</th>
                <th className="p-2">Comitê / Área</th>
                <th className="p-2">Título / Problema</th>
                <th className="p-2">Responsável</th>
                <th className="p-2">Prior.</th>
                <th className="p-2">Status</th>
                <th className="p-2">Pend.</th>
                <th className="p-2">Atualizada</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>
              )}
              {!isLoading && filtered.length === 0 && rows.length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">
                  Você ainda não tem planos de ação visíveis nesta empresa.<br />
                  <span className="text-xs">A visibilidade segue a hierarquia: você vê os planos sob sua responsabilidade, da sua equipe (setor/área/comitê que lidera ou gerencia) ou de toda a empresa, conforme suas permissões. Solicite ao administrador (Erica, Yuri ou Helena) se faltar acesso.</span>
                </td></tr>
              )}
              {!isLoading && filtered.length === 0 && rows.length > 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhuma ação encontrada com os filtros atuais.</td></tr>
              )}
              {filtered.map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/40">
                  <td className="p-2 px-3 font-mono text-xs text-muted-foreground">{r.id_importacao ?? r.id.slice(0,8)}</td>
                  <td className="p-2">
                    <div className="text-xs font-medium">{r.comite ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground">{r.area ?? "—"}</div>
                  </td>
                  <td className="p-2 max-w-[420px]">
                    <Link to={`/app/plano-acoes/${r.id}`} className="line-clamp-2 text-foreground hover:text-primary">
                      {r.titulo || r.problema || "(sem título)"}
                    </Link>
                  </td>
                  <td className="p-2 text-xs">
                    <div>{r.responsavel_nome_origem ?? "—"}</div>
                    {r.lider_comite_nome_origem && <div className="text-[11px] text-muted-foreground">Comitê: {r.lider_comite_nome_origem}</div>}
                  </td>
                  <td className="p-2">
                    {r.prioridade_normalizada && (
                      <Badge variant="outline" className={`text-[10px] ${PRIORIDADE_COR[r.prioridade_normalizada] ?? ""}`}>
                        {PRIORIDADE_LABEL[r.prioridade_normalizada] ?? r.prioridade_normalizada}
                      </Badge>
                    )}
                  </td>
                  <td className="p-2">
                    <Badge variant="outline" className={`text-[10px] ${STATUS_COR[r.status_normalizado] ?? ""}`}>
                      {STATUS_LABELS[r.status_normalizado] ?? r.status_normalizado}
                    </Badge>
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      {r.pendencia_responsavel && <span title="Sem responsável vinculado" className="rounded bg-destructive/10 px-1 text-[10px] text-destructive">resp</span>}
                      {r.pendencia_datas && <span title="Sem datas planejadas" className="rounded bg-amber-500/10 px-1 text-[10px] text-amber-700 dark:text-amber-400">dat</span>}
                      {r.pendencia_evidencia && <span title="Concluída sem evidência" className="rounded bg-amber-500/10 px-1 text-[10px] text-amber-700 dark:text-amber-400">evid</span>}
                    </div>
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">{fmtDate(r.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function ForbiddenCard() {
  return (
    <div>
      <PageHeader title="Plano de Ações" module="Plano de Ações" />
      <Card className="p-8 text-center">
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
        <h3 className="font-display text-lg font-bold">Acesso restrito</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Você não tem permissão para acessar o módulo Plano de Ações.<br />
          Solicite ao administrador do módulo (Erica, Yuri ou Helena) sua liberação na tela de Configurações.
        </p>
      </Card>
    </div>
  );
}
