import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isSameDay, isSameMonth, isSameWeek, isToday } from "date-fns";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, CalendarDays, CheckSquare, Clock, LayoutDashboard, List, Lock, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAccessibleMenus } from "@/hooks/useAccessibleMenus";
import { useReunioes, useUsuariosAtivos, useEditarReunioesEmMassa, useExcluirReunioesEmMassa } from "./useReunioes";
import { useBloqueiosAgendaPorUsuarios } from "./useBloqueioAgenda";
import { CalendarioMes } from "./componentes/CalendarioMes";
import { EditarDiaHorarioDialog } from "./componentes/EditarDiaHorarioDialog";
import { ReuniaoFormCriar } from "./ReuniaoFormCriar";
import { BloquearAgendaModal } from "./componentes/BloquearAgendaModal";
import { ETAPA_COR, ETAPA_LABEL, nomeUsuario, salaResumo, SALAS_PRESENCIAIS } from "./types";

function KpiTile({ icon, label, valor, sub, cor }: { icon: React.ReactNode; label: string; valor: number; sub: string; cor: string }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className={cn("rounded-md p-2", cor)}>{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold leading-tight">{valor}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </Card>
  );
}

export default function Reunioes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: reunioes = [], isLoading } = useReunioes();
  const { data: usuarios = [] } = useUsuariosAtivos();
  const { data: access } = useAccessibleMenus("visualizar");
  const podeCriar = access?.codes.has("central_servicos_criar_reuniao") ?? false;
  const [novoOpen, setNovoOpen] = useState(false);
  const [bloquearOpen, setBloquearOpen] = useState(false);
  const [modo, setModo] = useState<"calendario" | "lista">("calendario");
  const [mesAtual, setMesAtual] = useState(() => new Date());
  const [diaSelecionado, setDiaSelecionado] = useState(() => new Date());
  const [filtroPessoa, setFiltroPessoa] = useState("");
  const [filtroSala, setFiltroSala] = useState("");
  const [selecaoAtiva, setSelecaoAtiva] = useState(false);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  // Sem filtro de pessoa, mostra os próprios bloqueios; filtrando por alguém, mostra os dela (motivo incluso — visível pra quem tem acesso à Agenda de Reunião).
  const { data: bloqueios = [] } = useBloqueiosAgendaPorUsuarios([filtroPessoa || user?.id].filter((v): v is string => !!v));
  const [editarLoteOpen, setEditarLoteOpen] = useState(false);
  const editarLote = useEditarReunioesEmMassa();
  const excluirLote = useExcluirReunioesEmMassa();

  const opcoesResponsaveis = usuarios.map((u) => ({ value: u.id, label: u.display_name }));
  const opcoesSalas = SALAS_PRESENCIAIS.map((s) => ({ value: s, label: s }));

  const reunioesFiltradas = useMemo(
    () => reunioes.filter((r) =>
      (!filtroPessoa || [r.criado_por, r.responsavel_preenchimento_user_id, ...r.convidados].includes(filtroPessoa))
      && (!filtroSala || salaResumo(r) === filtroSala),
    ),
    [reunioes, filtroPessoa, filtroSala],
  );

  const podeGerenciarLinha = (r: { criado_por: string; organizador_user_id: string; responsavel_preenchimento_user_id: string }) =>
    !!user?.id && (user.id === r.criado_por || user.id === r.organizador_user_id || user.id === r.responsavel_preenchimento_user_id);

  const alternarSelecao = (id: string) => {
    setSelecionadas((s) => (s.includes(id) ? s.filter((v) => v !== id) : [...s, id]));
  };

  const sairDoModoSelecao = () => {
    setSelecaoAtiva(false);
    setSelecionadas([]);
  };

  const kpis = useMemo(() => {
    const agora = new Date();
    return {
      noMes: reunioesFiltradas.filter((r) => isSameMonth(new Date(r.data_hora), agora)).length,
      naSemana: reunioesFiltradas.filter((r) => isSameWeek(new Date(r.data_hora), agora, { weekStartsOn: 0 })).length,
      hoje: reunioesFiltradas.filter((r) => isToday(new Date(r.data_hora))).length,
      atrasadas: reunioesFiltradas.filter((r) => r.etapa === "agendada" && new Date(r.data_hora) < agora).length,
    };
  }, [reunioesFiltradas]);

  const reunioesDoDia = reunioesFiltradas
    .filter((r) => isSameDay(new Date(r.data_hora), diaSelecionado))
    .sort((a, b) => a.data_hora.localeCompare(b.data_hora));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda de Reunião"
        module="Central de Serviços"
        breadcrumb={["Agenda de Reunião"]}
        subtitle="Agende reuniões com pauta obrigatória, preencha a ata depois do encontro e colha assinaturas."
        actions={
          <>
            <Button asChild variant="outline" className="gap-1.5">
              <Link to="/app/central-servicos/reunioes/painel-gerencial"><LayoutDashboard className="h-4 w-4" /> Painel gerencial</Link>
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={() => setBloquearOpen(true)}>
              <Lock className="h-4 w-4" /> Bloquear Agenda
            </Button>
            {podeCriar && (
              <Button className="gap-1.5" onClick={() => setNovoOpen(true)}>
                <Plus className="h-4 w-4" /> Agendar Reunião
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile icon={<CalendarDays className="h-5 w-5" />} label="Reuniões no mês" valor={kpis.noMes} sub="Total agendadas" cor="bg-blue-100 text-blue-700" />
        <KpiTile icon={<Clock className="h-5 w-5" />} label="Esta semana" valor={kpis.naSemana} sub="Próximas reuniões" cor="bg-violet-100 text-violet-700" />
        <KpiTile icon={<CalendarDays className="h-5 w-5" />} label="Hoje" valor={kpis.hoje} sub="Reuniões hoje" cor="bg-amber-100 text-amber-700" />
        <KpiTile icon={<AlertTriangle className="h-5 w-5" />} label="Atrasadas" valor={kpis.atrasadas} sub="Reuniões pendentes" cor="bg-red-100 text-red-700" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchableSelect
          value={filtroPessoa}
          onChange={setFiltroPessoa}
          options={opcoesResponsaveis}
          placeholder="Pesquisar Alguém"
          allowClear
          clearValue=""
          className="w-56"
        />
        <SearchableSelect
          value={filtroSala}
          onChange={setFiltroSala}
          options={opcoesSalas}
          placeholder="Salas de Reuniões"
          allowClear
          clearValue=""
          className="w-56"
        />
        <div className="ml-auto flex rounded-md border border-border p-0.5">
          <Button size="sm" variant={modo === "calendario" ? "secondary" : "ghost"} className="gap-1.5" onClick={() => setModo("calendario")}>
            <CalendarDays className="h-3.5 w-3.5" /> Calendário
          </Button>
          <Button size="sm" variant={modo === "lista" ? "secondary" : "ghost"} className="gap-1.5" onClick={() => setModo("lista")}>
            <List className="h-3.5 w-3.5" /> Lista
          </Button>
        </div>
        {modo === "lista" && (
          <Button
            size="sm"
            variant={selecaoAtiva ? "secondary" : "outline"}
            className="gap-1.5"
            onClick={() => (selecaoAtiva ? sairDoModoSelecao() : setSelecaoAtiva(true))}
          >
            <CheckSquare className="h-3.5 w-3.5" /> {selecaoAtiva ? "Cancelar seleção" : "Selecionar"}
          </Button>
        )}
      </div>

      {selecaoAtiva && selecionadas.length > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-3 shadow-sm">
          <span className="text-sm font-medium">{selecionadas.length} selecionada{selecionadas.length > 1 ? "s" : ""}</span>
          <Button size="sm" className="gap-1.5" onClick={() => setEditarLoteOpen(true)}>
            <CalendarDays className="h-3.5 w-3.5" /> Editar em massa
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" className="gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Excluir em massa
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir {selecionadas.length} reunião(ões)?</AlertDialogTitle>
                <AlertDialogDescription>
                  Apaga cada reunião selecionada com tudo dentro — pauta, anexos, convidados, histórico. Sem volta.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={excluirLote.isPending}
                  onClick={async () => {
                    await excluirLote.mutateAsync(selecionadas);
                    sairDoModoSelecao();
                  }}
                >
                  {excluirLote.isPending ? "Excluindo…" : "Confirmar exclusão"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button size="sm" variant="ghost" onClick={sairDoModoSelecao}>Limpar</Button>
        </div>
      )}

      <EditarDiaHorarioDialog
        open={editarLoteOpen}
        onOpenChange={setEditarLoteOpen}
        titulo="Editar reuniões selecionadas"
        descricao={'Muda o dia da semana e o horário das reuniões selecionadas que ainda estão como "Planejada". As demais (já iniciadas, concluídas ou canceladas) não são alteradas.'}
        salvando={editarLote.isPending}
        onSalvar={async (novoDiaSemana, novoHorario) => {
          await editarLote.mutateAsync({ reuniaoIds: selecionadas, novoDiaSemana, novoHorario });
          setEditarLoteOpen(false);
          sairDoModoSelecao();
        }}
      />

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && modo === "calendario" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <CalendarioMes
            mesAtual={mesAtual}
            onMudarMes={setMesAtual}
            diaSelecionado={diaSelecionado}
            onSelecionarDia={setDiaSelecionado}
            reunioes={reunioesFiltradas}
            usuarios={usuarios}
            bloqueios={bloqueios}
          />
          <Card className="p-4">
            <p className="text-sm font-semibold">Reuniões do dia</p>
            <p className="mb-3 text-xs capitalize text-muted-foreground">
              {diaSelecionado.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
            <div className="space-y-2">
              {reunioesDoDia.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate(`/app/central-servicos/reunioes/${r.id}`)}
                  className="block w-full rounded border border-border p-2 text-left text-sm hover:bg-accent"
                >
                  <p className="font-medium">
                    {new Date(r.data_hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} {r.titulo}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{r.numero}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {nomeUsuario(usuarios, r.responsavel_preenchimento_user_id) ?? "—"} · {r.local_ou_link}
                  </p>
                </button>
              ))}
              {reunioesDoDia.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma reunião nesse dia.</p>}
            </div>
          </Card>
        </div>
      )}

      {!isLoading && modo === "lista" && (
        <div className="space-y-2">
          {reunioesFiltradas.length === 0 && (
            <Card className="flex flex-col items-center gap-3 p-10 text-center text-muted-foreground">
              <CalendarDays className="h-10 w-10" />
              <p className="text-sm">Nenhuma reunião agendada ainda.</p>
            </Card>
          )}
          {reunioesFiltradas.map((r) => {
            const gerenciavel = podeGerenciarLinha(r);
            return (
              <Card
                key={r.id}
                className="flex cursor-pointer items-center justify-between gap-4 p-4 transition-colors hover:bg-accent/40"
                onClick={() => (selecaoAtiva ? (gerenciavel && alternarSelecao(r.id)) : navigate(`/app/central-servicos/reunioes/${r.id}`))}
              >
                <div className="flex min-w-0 items-center gap-3">
                  {selecaoAtiva && (
                    <Checkbox
                      checked={selecionadas.includes(r.id)}
                      disabled={!gerenciavel}
                      onCheckedChange={() => gerenciavel && alternarSelecao(r.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{r.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.numero}
                      {" · "}{new Date(r.data_hora).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      {" · "}{r.tipo_local === "presencial" ? "Presencial" : r.tipo_local === "hibrido" ? "Híbrido" : "Online"}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className={ETAPA_COR[r.etapa]}>{ETAPA_LABEL[r.etapa]}</Badge>
              </Card>
            );
          })}
        </div>
      )}

      <ReuniaoFormCriar open={novoOpen} onOpenChange={setNovoOpen} />
      <BloquearAgendaModal open={bloquearOpen} onOpenChange={setBloquearOpen} />
    </div>
  );
}
