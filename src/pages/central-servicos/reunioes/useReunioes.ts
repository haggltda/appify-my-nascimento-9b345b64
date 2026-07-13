import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Reuniao, ReuniaoCalendario, Usuario } from "./types";
import { registrarLog } from "./registrarLog";

const REUNIAO_COLUNAS =
  "id, titulo, objetivo, data_hora, duracao_minutos, tipo_local, local_ou_link, etapa, criado_por, responsavel_preenchimento_user_id, motivo_cancelamento, created_at, updated_at";

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
    .eq("tipo_local", "presencial")
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
}

interface NovaReuniao {
  titulo: string;
  objetivo: string;
  data_hora: string;
  duracao_minutos: number;
  tipo_local: "presencial" | "online";
  local_ou_link: string;
  responsavel_preenchimento_user_id: string;
  pauta: NovaPauta[];
  convidados: string[];
}

export function useCriarReuniao() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (nova: NovaReuniao) => {
      const { data: reuniao, error } = await (supabase as any)
        .from("reuniao")
        .insert({
          titulo: nova.titulo,
          objetivo: nova.objetivo || null,
          data_hora: nova.data_hora,
          duracao_minutos: nova.duracao_minutos,
          tipo_local: nova.tipo_local,
          local_ou_link: nova.local_ou_link,
          responsavel_preenchimento_user_id: nova.responsavel_preenchimento_user_id,
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
          })),
        );
        if (pautaErr) throw pautaErr;
      }

      if (nova.convidados.length > 0) {
        const { error: convidadosErr } = await (supabase as any).from("reuniao_convidado").insert(
          nova.convidados.map((userId) => ({ reuniao_id: reuniaoId, user_id: userId })),
        );
        if (convidadosErr) throw convidadosErr;
      }

      supabase.functions
        .invoke("enviar-notificacao-push-reuniao", { body: { reuniao_id: reuniaoId, evento: "agendada" } })
        .catch(() => {});

      registrarLog(reuniaoId, "reuniao_agendada", `Reunião "${nova.titulo}" agendada`);

      return reuniaoId;
    },
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
