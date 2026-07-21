import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Finalidade, NotificarPor, Reuniao, ReuniaoCalendario, ResultadoEsperado, TipoLocalReuniao, TipoReuniao, Usuario } from "./types";
import { registrarLog } from "./registrarLog";

const REUNIAO_COLUNAS =
  "id, numero, titulo, objetivo, data_hora, duracao_minutos, tipo_local, local_ou_link, link_online, etapa, criado_por, organizador_user_id, responsavel_preenchimento_user_id, tipo_reuniao, finalidade, resultado_esperado, notificar_por, setor_responsavel, justificativa_alteracao_duracao, motivo_cancelamento, created_at, updated_at";

/** Calendário geral: todas as reuniões da empresa (recorte mínimo) — abrir o card ainda exige interação, via RLS de "reuniao". */
export function useReunioes() {
  return useQuery({
    queryKey: ["reuniao-calendario"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("listar_reunioes_calendario");
      if (error) throw error;
      return (data ?? []) as ReuniaoCalendario[];
    },
  });
}

export function useMinhasReunioes() {
  return useQuery({
    queryKey: ["reuniao-minhas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("listar_minhas_reunioes");
      if (error) throw error;
      return (data ?? []) as Reuniao[];
    },
  });
}

export function useOcultarReuniaoDaHome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reuniaoId: string) => {
      const { error } = await (supabase as any)
        .from("reuniao_home_ocultada")
        .insert({ reuniao_id: reuniaoId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reuniao-minhas"] });
    },
  });
}

/** Sobreposição de horário: mesma sala presencial, mesma faixa de tempo, reunião não cancelada. */
export async function verificarConflitoSala(params: {
  local: string;
  dataHoraIso: string;
  duracaoMinutos: number;
  reuniaoIdIgnorar?: string;
}): Promise<Reuniao | null> {
  const inicio = new Date(params.dataHoraIso);
  const fim = new Date(inicio.getTime() + params.duracaoMinutos * 60_000);

  let query = (supabase as any)
    .from("reuniao")
    .select(REUNIAO_COLUNAS)
    .in("tipo_local", ["presencial", "hibrido"])
    .eq("local_ou_link", params.local)
    .neq("etapa", "cancelada");
  if (params.reuniaoIdIgnorar) {
    query = query.neq("id", params.reuniaoIdIgnorar);
  }
  const { data, error } = await query;
  if (error) throw error;

  const conflito = ((data ?? []) as Reuniao[]).find((r) => {
    const outroInicio = new Date(r.data_hora);
    const outroFim = new Date(outroInicio.getTime() + (r.duracao_minutos ?? 60) * 60_000);
    return inicio < outroFim && outroInicio < fim;
  });
  return conflito ?? null;
}

/** Sobreposição de horário: mesma pessoa convidada em duas reuniões não canceladas na mesma faixa de tempo. */
export async function verificarConflitoParticipante(params: {
  userId: string;
  dataHoraIso: string;
  duracaoMinutos: number;
  reuniaoIdIgnorar?: string;
}): Promise<Reuniao | null> {
  const inicio = new Date(params.dataHoraIso);
  const fim = new Date(inicio.getTime() + params.duracaoMinutos * 60_000);

  const { data, error } = await (supabase as any)
    .from("reuniao_convidado")
    .select(`reuniao:reuniao_id (${REUNIAO_COLUNAS})`)
    .eq("user_id", params.userId);
  if (error) throw error;

  const reunioes = ((data ?? []) as { reuniao: Reuniao | null }[])
    .map((row) => row.reuniao)
    .filter((r): r is Reuniao => !!r && r.etapa !== "cancelada" && r.id !== params.reuniaoIdIgnorar);

  const conflito = reunioes.find((r) => {
    const outroInicio = new Date(r.data_hora);
    const outroFim = new Date(outroInicio.getTime() + (r.duracao_minutos ?? 60) * 60_000);
    return inicio < outroFim && outroInicio < fim;
  });
  return conflito ?? null;
}

export function useUsuariosAtivos() {
  return useQuery({
    queryKey: ["reunioes-usuarios-ativos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("listar_usuarios_ativos");
      if (error) throw error;
      return (data ?? []) as Usuario[];
    },
  });
}

interface NovaPauta {
  titulo_topico: string;
  descricao: string;
  responsavel_user_id?: string | null;
  tempo_previsto_minutos?: number | null;
}

interface NovaReuniao {
  titulo: string;
  objetivo: string;
  data_hora: string;
  duracao_minutos: number;
  justificativa_alteracao_duracao?: string | null;
  tipo_local: TipoLocalReuniao;
  local_ou_link: string;
  link_online: string | null;
  organizador_user_id: string;
  responsavel_preenchimento_user_id: string;
  tipo_reuniao: TipoReuniao | null;
  finalidade: Finalidade[];
  resultado_esperado: ResultadoEsperado[];
  notificar_por: NotificarPor[];
  setor_responsavel: string | null;
  pauta: NovaPauta[];
  convidados: string[];
  observadores: string[];
  anexos?: File[];
}

const ANEXOS_BUCKET = "reunioes";

/** Cria uma reunião (linha reuniao + pauta + convidados/observadores + notificação + log). Usado tanto pra criação avulsa quanto, em loop, pra recorrência. */
async function criarUmaReuniao(nova: NovaReuniao): Promise<string> {
  const { data: reuniao, error } = await (supabase as any)
    .from("reuniao")
    .insert({
      titulo: nova.titulo,
      objetivo: nova.objetivo || null,
      data_hora: nova.data_hora,
      duracao_minutos: nova.duracao_minutos,
      tipo_local: nova.tipo_local,
      local_ou_link: nova.local_ou_link,
      link_online: nova.link_online,
      organizador_user_id: nova.organizador_user_id,
      responsavel_preenchimento_user_id: nova.responsavel_preenchimento_user_id,
      tipo_reuniao: nova.tipo_reuniao,
      finalidade: nova.finalidade,
      resultado_esperado: nova.resultado_esperado,
      notificar_por: nova.notificar_por,
      setor_responsavel: nova.setor_responsavel,
      justificativa_alteracao_duracao: nova.justificativa_alteracao_duracao || null,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23P01") {
      throw new Error(`Sala "${nova.local_ou_link}" já está reservada nesse horário.`);
    }
    throw error;
  }
  const reuniaoId = reuniao.id as string;

  if (nova.pauta.length > 0) {
    const { error: pautaErr } = await (supabase as any).from("reuniao_pauta").insert(
      nova.pauta.map((p, i) => ({
        reuniao_id: reuniaoId,
        ordem: i,
        titulo_topico: p.titulo_topico,
        descricao: p.descricao || null,
        responsavel_user_id: p.responsavel_user_id || null,
        tempo_previsto_minutos: p.tempo_previsto_minutos || null,
      })),
    );
    if (pautaErr) throw pautaErr;
  }

  const participantes = [
    ...nova.convidados.map((userId) => ({ reuniao_id: reuniaoId, user_id: userId, papel: "convidado" })),
    ...nova.observadores.map((userId) => ({ reuniao_id: reuniaoId, user_id: userId, papel: "observador" })),
  ];
  if (participantes.length > 0) {
    const { error: convidadosErr } = await (supabase as any).from("reuniao_convidado").insert(participantes);
    if (convidadosErr) throw convidadosErr;
  }

  if (nova.anexos && nova.anexos.length > 0) {
    for (const file of nova.anexos) {
      const nomeSanitizado = file.name
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${reuniaoId}/${Date.now()}-${nomeSanitizado}`;
      const up = await supabase.storage.from(ANEXOS_BUCKET).upload(path, file, { contentType: file.type });
      if (up.error) continue;
      await (supabase as any).from("reuniao_anexo").insert({
        reuniao_id: reuniaoId,
        storage_path: path,
        nome_arquivo: file.name,
        mime_type: file.type || null,
        tamanho_bytes: file.size,
      });
    }
  }

  supabase.functions
    .invoke("enviar-notificacao-push-reuniao", { body: { reuniao_id: reuniaoId, evento: "agendada" } })
    .catch(() => {});

  registrarLog(reuniaoId, "reuniao_agendada", `Reunião "${nova.titulo}" agendada`);

  return reuniaoId;
}

export function useCriarReuniao() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: criarUmaReuniao,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reuniao-calendario"] });
      qc.invalidateQueries({ queryKey: ["reuniao-minhas"] });
      toast({ title: "Reunião agendada" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao agendar reunião", description: error.message, variant: "destructive" });
    },
  });
}

interface ResultadoRecorrencia {
  criadas: number;
  puladas: { dataHoraIso: string; motivo: string }[];
}

/** Cria uma série de reuniões (mesmo conteúdo, datas diferentes) — cada data é uma tentativa independente, igual a criar uma avulsa; se uma data específica já estiver ocupada, só ela fica de fora. */
export function useCriarReunioesRecorrentes() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ base, datas }: { base: Omit<NovaReuniao, "data_hora">; datas: string[] }): Promise<ResultadoRecorrencia> => {
      const resultado: ResultadoRecorrencia = { criadas: 0, puladas: [] };
      for (const dataHoraIso of datas) {
        try {
          await criarUmaReuniao({ ...base, data_hora: dataHoraIso });
          resultado.criadas += 1;
        } catch (e) {
          resultado.puladas.push({ dataHoraIso, motivo: e instanceof Error ? e.message : String(e) });
        }
      }
      return resultado;
    },
    onSuccess: (resultado) => {
      qc.invalidateQueries({ queryKey: ["reuniao-calendario"] });
      qc.invalidateQueries({ queryKey: ["reuniao-minhas"] });
      if (resultado.puladas.length === 0) {
        toast({ title: `${resultado.criadas} reuniões agendadas` });
        return;
      }
      const datasPuladas = resultado.puladas
        .map((p) => new Date(p.dataHoraIso).toLocaleDateString("pt-BR"))
        .join(", ");
      toast({
        title: `${resultado.criadas} reuniões agendadas, ${resultado.puladas.length} pulada(s)`,
        description: `Datas com conflito: ${datasPuladas}`,
        variant: resultado.criadas === 0 ? "destructive" : undefined,
      });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao agendar reuniões recorrentes", description: error.message, variant: "destructive" });
    },
  });
}
