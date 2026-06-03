import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmpresaAtiva } from "@/context/EmpresaAtivaContext";
import { usePlanoAcaoPermissao } from "@/hooks/usePlanoAcaoPermissao";
import { STATUS_LABELS, STATUS_ORDEM, STATUS_COR, PRIORIDADES, PRIORIDADE_LABEL } from "@/types/planoAcao";
import { ForbiddenCard } from "./Lista";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";
import { useComitesMap } from "@/hooks/useComitesMap";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useUsuariosEmpresa } from "@/hooks/useUsuariosEmpresa";

export default function PlanoAcaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "nova";
  const nav = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { empresa } = useEmpresaAtiva();
  const empresaId = empresa?.id ?? null;
  const { can, loading: lp } = usePlanoAcaoPermissao();

  const [form, setForm] = useState<any>({
    titulo: "", problema: "", acao: "", comite: "", area: "", setor: "",
    prioridade_normalizada: "media", status_normalizado: "a_definir",
    responsavel_profile_id: null,
    responsavel_nome_origem: "", lider_comite_nome_origem: "",
    data_inicio_planejado_original: "", data_fim_planejado_original: "",
    comentarios: "", custo_previsto: 0,
  });
  const [historico, setHistorico] = useState<any[]>([]);
  const [comentarios, setComentarios] = useState<any[]>([]);
  const [novoComent, setNovoComent] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["plano_acao_one", id],
    enabled: !isNew && !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("plano_acao").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data) setForm(data);
    if (data?.id) {
      supabase.from("plano_acao_historico").select("*").eq("plano_acao_id", data.id).order("created_at", { ascending: false }).limit(50)
        .then(r => setHistorico(r.data ?? []));
      supabase.from("plano_acao_comentario").select("*").eq("plano_acao_id", data.id).order("created_at", { ascending: false })
        .then(r => setComentarios(r.data ?? []));
    }
  }, [data]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const { data: comitesMap = {} } = useComitesMap();
  const comitesList = useMemo(() => Object.keys(comitesMap).sort((a, b) => a.localeCompare(b, "pt-BR")), [comitesMap]);
  const areasDoComite = useMemo(
    () => (form.comite && comitesMap[form.comite]?.areas) || [],
    [form.comite, comitesMap]
  );
  const areaAtual = useMemo(
    () => areasDoComite.find((a: any) => a.nome === form.area) || null,
    [areasDoComite, form.area]
  );
  const setoresDaArea: string[] = areaAtual?.setores ?? [];

  // Auto-preenche líder do comitê e ajusta área quando comitê muda
  useEffect(() => {
    if (!form.comite) return;
    const info = comitesMap[form.comite];
    if (!info) return;
    setForm((f: any) => {
      const next = { ...f };
      if (info.lider) next.lider_comite_nome_origem = info.lider;
      if (f.area && !info.areasNomes.includes(f.area)) { next.area = ""; next.setor = ""; }
      return next;
    });
  }, [form.comite, comitesMap]);

  // Auto-preenche responsável com o gestor da área e zera setor quando área muda
  useEffect(() => {
    if (!form.area) return;
    if (areaAtual?.gestor) {
      setForm((f: any) => ({ ...f, responsavel_nome_origem: areaAtual.gestor || f.responsavel_nome_origem }));
    }
    if (form.setor && !setoresDaArea.includes(form.setor)) {
      setForm((f: any) => ({ ...f, setor: "" }));
    }
  }, [form.area, areaAtual]);

  const _podeEditPre = isNew ? can("criar") : can("editar");
  const { data: usuarios = [], error: errUsuarios } = useUsuariosEmpresa({
    enabled: !lp && can("visualizar") && (_podeEditPre || isNew),
  });

  if (lp) return null;
  if (!can("visualizar")) return <ForbiddenCard />;
  const podeEdit = _podeEditPre;
  const usuariosOptions = usuarios.map((u) => ({
    value: u.id,
    label: u.display_name ?? "(sem nome)",
    hint: u.email ?? undefined,
  }));
  const rpcSemPermissao =
    !!errUsuarios &&
    ((errUsuarios as any)?.code === "42501" ||
      String((errUsuarios as any)?.message ?? "").includes("sem_permissao_para_listar_usuarios_empresa"));

  const salvar = async () => {
    if (!podeEdit || !empresaId) return;
    if (isNew && !form.responsavel_profile_id) {
      return toast({
        title: "Responsável é obrigatório",
        description: "Selecione um responsável para criar a ação.",
        variant: "destructive",
      });
    }
    if (isNew) {
      const { data: ins, error } = await supabase.from("plano_acao").insert({
        empresa_id: empresaId, ...form, origem: "manual",
        responsavel_profile_id: form.responsavel_profile_id ?? null,
      }).select("id").single();
      if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
      toast({ title: "Ação criada" });
      qc.invalidateQueries({ queryKey: ["plano_acoes"] });
      nav(`/app/plano-acoes/${ins.id}`);
    } else {
      const { error } = await supabase.from("plano_acao").update({
        titulo: form.titulo, problema: form.problema, acao: form.acao,
        comite: form.comite, area: form.area, setor: form.setor || null,
        prioridade_normalizada: form.prioridade_normalizada,
        status_normalizado: form.status_normalizado,
        responsavel_profile_id: form.responsavel_profile_id ?? null,
        responsavel_nome_origem: form.responsavel_nome_origem,
        lider_comite_nome_origem: form.lider_comite_nome_origem,
        comentarios: form.comentarios,
        custo_previsto: form.custo_previsto,
      }).eq("id", id!);
      if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
      toast({ title: "Ação atualizada" });
      qc.invalidateQueries({ queryKey: ["plano_acoes"] });
      qc.invalidateQueries({ queryKey: ["plano_acao_one", id] });
    }
  };

  const concluir = async () => {
    if (!can("editar") || isNew) return;
    const novo = can("aprovar") ? "concluida_validada" : "aguardando_validacao";
    const { error } = await supabase.from("plano_acao").update({ status_normalizado: novo }).eq("id", id!);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: STATUS_LABELS[novo] }); qc.invalidateQueries({ queryKey: ["plano_acao_one", id] }); }
  };

  const excluir = async () => {
    if (!can("excluir") || isNew) return;
    if (!confirm("Excluir logicamente esta ação?")) return;
    const { error } = await supabase.from("plano_acao").update({ deleted_at: new Date().toISOString() }).eq("id", id!);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Excluída" }); nav("/app/plano-acoes"); }
  };

  const addComentario = async () => {
    if (!novoComent.trim() || isNew || !empresaId) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("plano_acao_comentario").insert({
      empresa_id: empresaId, plano_acao_id: id!, comentario: novoComent.trim(), criado_por: u.user?.id,
    });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      setNovoComent("");
      const { data: cs } = await supabase.from("plano_acao_comentario").select("*").eq("plano_acao_id", id!).order("created_at", { ascending: false });
      setComentarios(cs ?? []);
    }
  };

  return (
    <div>
      <PageHeader
        title={isNew ? "Nova ação" : (form.id_importacao ?? "Detalhe da ação")}
        subtitle={isNew ? "Cadastrar nova ação no plano" : form.titulo ?? form.problema ?? ""}
        module="Plano de Ações"
        breadcrumb={[isNew ? "Nova" : "Detalhe"]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild><Link to="/app/plano-acoes">← Lista</Link></Button>
            {!isNew && can("editar") && form.status_normalizado !== "concluida_validada" && (
              <Button size="sm" variant="secondary" onClick={concluir}>
                {can("aprovar") ? "Validar conclusão" : "Marcar como concluída"}
              </Button>
            )}
            {podeEdit && <Button size="sm" onClick={salvar} disabled={isNew && !form.responsavel_profile_id}>Salvar</Button>}
            {!isNew && can("excluir") && (
              <Button size="sm" variant="destructive" onClick={excluir}><Trash2 className="mr-1 h-3.5 w-3.5" />Excluir</Button>
            )}
          </div>
        }
      />
      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Título</Label>
              <Input value={form.titulo ?? ""} disabled={!podeEdit} onChange={e => set("titulo", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Problema</Label>
              <Textarea rows={3} value={form.problema ?? ""} disabled={!podeEdit} onChange={e => set("problema", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Ação</Label>
              <Textarea rows={4} value={form.acao ?? ""} disabled={!podeEdit} onChange={e => set("acao", e.target.value)} />
            </div>
            <div>
              <Label>Comitê</Label>
              {comitesList.length > 0 ? (
                <Select
                  value={form.comite || "__none"}
                  disabled={!podeEdit}
                  onValueChange={v => set("comite", v === "__none" ? "" : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o comitê" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {comitesList.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    {form.comite && !comitesList.includes(form.comite) && (
                      <SelectItem value={form.comite}>{form.comite}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={form.comite ?? ""} disabled={!podeEdit} onChange={e => set("comite", e.target.value)} />
              )}
            </div>
            <div>
              <Label>Área</Label>
              {areasDoComite.length > 0 ? (
                <Select
                  value={form.area || "__none"}
                  disabled={!podeEdit || !form.comite}
                  onValueChange={v => set("area", v === "__none" ? "" : v)}
                >
                  <SelectTrigger><SelectValue placeholder={form.comite ? "Selecione a área" : "Escolha o comitê primeiro"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {areasDoComite.map((a: any) => <SelectItem key={a.nome} value={a.nome}>{a.nome}</SelectItem>)}
                    {form.area && !areasDoComite.some((a: any) => a.nome === form.area) && (
                      <SelectItem value={form.area}>{form.area}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={form.area ?? ""} disabled={!podeEdit} onChange={e => set("area", e.target.value)} placeholder={form.comite ? "Digite a área" : "Escolha o comitê primeiro"} />
              )}
            </div>
            <div>
              <Label>Setor</Label>
              {setoresDaArea.length > 0 ? (
                <Select
                  value={form.setor || "__none"}
                  disabled={!podeEdit || !form.area}
                  onValueChange={v => set("setor", v === "__none" ? "" : v)}
                >
                  <SelectTrigger><SelectValue placeholder={form.area ? "Selecione o setor" : "Escolha a área primeiro"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {setoresDaArea.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    {form.setor && !setoresDaArea.includes(form.setor) && (
                      <SelectItem value={form.setor}>{form.setor}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={form.setor ?? ""} disabled={!podeEdit || !form.area} onChange={e => set("setor", e.target.value)} placeholder={form.area ? "Sem setores cadastrados" : "Escolha a área primeiro"} />
              )}
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status_normalizado} disabled={!podeEdit} onValueChange={v => set("status_normalizado", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_ORDEM.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={form.prioridade_normalizada ?? "nao_informada"} disabled={!podeEdit} onValueChange={v => set("prioridade_normalizada", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORIDADES.map(p => <SelectItem key={p} value={p}>{PRIORIDADE_LABEL[p]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Responsável</Label><Input value={form.responsavel_nome_origem ?? ""} disabled={!podeEdit} onChange={e => set("responsavel_nome_origem", e.target.value)} /></div>
            <div>
              <Label>Líder do comitê <span className="text-xs text-muted-foreground">(automático)</span></Label>
              <Input value={form.lider_comite_nome_origem ?? ""} readOnly placeholder={form.comite ? "—" : "Selecione o comitê"} className="bg-muted/40" />
            </div>
            <div><Label>Custo previsto</Label><Input type="number" step="0.01" value={form.custo_previsto ?? 0} disabled={!podeEdit} onChange={e => set("custo_previsto", parseFloat(e.target.value) || 0)} /></div>
            <div className="sm:col-span-2">
              <Label>Comentários</Label>
              <Textarea rows={3} value={form.comentarios ?? ""} disabled={!podeEdit} onChange={e => set("comentarios", e.target.value)} />
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status & pendências</h3>
            <Badge variant="outline" className={`mb-2 ${STATUS_COR[form.status_normalizado] ?? ""}`}>{STATUS_LABELS[form.status_normalizado] ?? form.status_normalizado}</Badge>
            <div className="space-y-1 text-xs text-muted-foreground">
              {form.pendencia_responsavel && <p>• Sem responsável vinculado</p>}
              {form.pendencia_datas && <p>• Sem datas planejadas</p>}
              {form.pendencia_evidencia && <p>• Aguardando evidência</p>}
              {(form.pendencias_iniciais ?? []).map((p: string) => <p key={p} className="font-mono">• {p}</p>)}
            </div>
            <div className="mt-3 grid gap-2 text-xs">
              <div><span className="text-muted-foreground">ID importação:</span> <span className="font-mono">{form.id_importacao ?? "—"}</span></div>
              <div><span className="text-muted-foreground">Linha CSV:</span> {form.linha_csv ?? "—"}</div>
              <div><span className="text-muted-foreground">Status original:</span> {form.status_original ?? "—"}</div>
              <div><span className="text-muted-foreground">Datas (originais):</span> {form.data_inicio_planejado_original ?? "—"} → {form.data_fim_planejado_original ?? "—"}</div>
            </div>
          </Card>

          {!isNew && (
            <Card className="p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Comentários</h3>
              {can("editar") && (
                <div className="mb-2 flex gap-2">
                  <Input placeholder="Novo comentário..." value={novoComent} onChange={e => setNovoComent(e.target.value)} />
                  <Button size="sm" onClick={addComentario}>Add</Button>
                </div>
              )}
              <div className="max-h-48 space-y-2 overflow-auto">
                {comentarios.map(c => (
                  <div key={c.id} className="rounded border border-border p-2 text-xs">
                    <p>{c.comentario}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                ))}
                {comentarios.length === 0 && <p className="text-xs text-muted-foreground">Sem comentários ainda.</p>}
              </div>
            </Card>
          )}

          {!isNew && (
            <Card className="p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Histórico</h3>
              <div className="max-h-64 space-y-1 overflow-auto text-xs">
                {historico.map(h => (
                  <div key={h.id} className="border-l-2 border-primary/40 pl-2">
                    <p className="font-medium">{h.evento}</p>
                    <p className="text-muted-foreground">{h.campo}: {h.valor_anterior ?? "∅"} → {h.valor_novo ?? "∅"}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                ))}
                {historico.length === 0 && <p className="text-muted-foreground">Sem alterações registradas.</p>}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
