import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type {
  Reuniao, ReuniaoAnexo, ReuniaoAssinatura, ReuniaoComentario, ReuniaoConvidado, ReuniaoEtapa, ReuniaoLog,
  ReuniaoPauta, ReuniaoPautaAnexo, ReuniaoResposta, Usuario,
} from "./types";
import { gerarAtaFinalPdfBlob } from "./pdf/ataFinalPdf";
import { registrarLog } from "./registrarLog";

const BUCKET = "reunioes";

export function useReuniaoDetalhe(id: string | undefined) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: reuniao, isLoading } = useQuery({
    queryKey: ["reuniao", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reuniao")
        .select("id, titulo, objetivo, data_hora, duracao_minutos, tipo_local, local_ou_link, etapa, criado_por, responsavel_preenchimento_user_id, motivo_cancelamento, created_at, updated_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Reuniao | null;
    },
  });

  const { data: pauta = [] } = useQuery({
    queryKey: ["reuniao_pauta", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reuniao_pauta")
        .select("id, reuniao_id, ordem, titulo_topico, descricao, responsavel_user_id, prazo, status, created_at")
        .eq("reuniao_id", id)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ReuniaoPauta[];
    },
  });

  const { data: respostas = [] } = useQuery({
    queryKey: ["reuniao_resposta", id],
    enabled: !!id && pauta.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reuniao_resposta")
        .select("id, pauta_id, texto_resposta, encaminhamento, respondido_por, created_at, updated_at")
        .in("pauta_id", pauta.map((p) => p.id));
      if (error) throw error;
      return (data ?? []) as ReuniaoResposta[];
    },
  });

  const { data: convidados = [] } = useQuery({
    queryKey: ["reuniao_convidado", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reuniao_convidado")
        .select("id, reuniao_id, user_id, created_at")
        .eq("reuniao_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ReuniaoConvidado[];
    },
  });

  const { data: anexos = [] } = useQuery({
    queryKey: ["reuniao_anexo", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reuniao_anexo")
        .select("id, reuniao_id, storage_path, nome_arquivo, mime_type, tamanho_bytes, enviado_por, created_at")
        .eq("reuniao_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ReuniaoAnexo[];
    },
  });

  const { data: comentarios = [] } = useQuery({
    queryKey: ["reuniao_comentario", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reuniao_comentario")
        .select("id, reuniao_id, autor_id, texto, created_at")
        .eq("reuniao_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ReuniaoComentario[];
    },
  });

  const { data: assinaturas = [] } = useQuery({
    queryKey: ["reuniao_assinatura", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reuniao_assinatura")
        .select("id, reuniao_id, user_id, assinatura_png, created_at")
        .eq("reuniao_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ReuniaoAssinatura[];
    },
  });

  const { data: pautaAnexos = [] } = useQuery({
    queryKey: ["reuniao_pauta_anexo", id],
    enabled: !!id && pauta.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reuniao_pauta_anexo")
        .select("id, pauta_id, storage_path, nome_arquivo, mime_type, tamanho_bytes, enviado_por, created_at")
        .in("pauta_id", pauta.map((p) => p.id))
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ReuniaoPautaAnexo[];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["reuniao_log", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reuniao_log")
        .select("id, reuniao_id, user_id, acao, detalhe, created_at")
        .eq("reuniao_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReuniaoLog[];
    },
  });

  const invalidarReuniao = () => {
    qc.invalidateQueries({ queryKey: ["reuniao", id] });
    qc.invalidateQueries({ queryKey: ["reuniao"] });
  };

  const notificar = (evento: string) => {
    if (!id) return;
    supabase.functions.invoke("enviar-notificacao-push-reuniao", { body: { reuniao_id: id, evento } }).catch(() => {});
  };

  const mudarEtapa = async (
    novaEtapa: ReuniaoEtapa,
    extra?: Record<string, unknown>,
    log?: { acao: string; detalhe: string },
  ): Promise<boolean> => {
    if (!id) return false;
    const { error } = await (supabase as any).from("reuniao").update({ etapa: novaEtapa, ...extra }).eq("id", id);
    if (error) {
      toast({ title: "Erro ao mudar etapa", description: error.message, variant: "destructive" });
      return false;
    }
    invalidarReuniao();
    notificar(novaEtapa);
    if (log) registrarLog(id, log.acao, log.detalhe);
    toast({ title: "Etapa atualizada" });
    return true;
  };

  const cancelarReuniao = async (motivo: string): Promise<boolean> => {
    return mudarEtapa(
      "cancelada",
      { motivo_cancelamento: motivo },
      { acao: "reuniao_cancelada", detalhe: `Reunião cancelada. Motivo: ${motivo}` },
    );
  };

  const iniciarReuniao = async (): Promise<boolean> =>
    mudarEtapa("em_andamento", undefined, { acao: "reuniao_iniciada", detalhe: "Reunião iniciada" });

  // Ao encerrar, gera o PDF final da ata (mesmo gerador usado no botão
  // manual) e sobe pro Storage - o worker externo (whatsapp-web.js +
  // Nodemailer) usa esse arquivo pra mandar por e-mail automaticamente,
  // sem precisar portar a geração de PDF pra fora do navegador.
  const encerrarReuniao = async (usuarios: Usuario[]): Promise<boolean> => {
    if (!id || !reuniao) return false;
    try {
      const blob = gerarAtaFinalPdfBlob(reuniao, pauta, respostas, assinaturas, usuarios);
      const path = `${id}/ata-final.pdf`;
      const up = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: "application/pdf",
        upsert: true,
      });
      if (up.error) {
        toast({ title: "Erro ao gerar PDF final", description: up.error.message, variant: "destructive" });
        return false;
      }
      return mudarEtapa(
        "concluida",
        { pdf_final_storage_path: path },
        { acao: "reuniao_encerrada", detalhe: "Reunião encerrada" },
      );
    } catch (e) {
      toast({ title: "Erro ao gerar PDF final", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
      return false;
    }
  };

  // Edição de campos gerais (data/hora, local, organizador) - não é uma
  // transição de etapa, então não deve disparar a notificação de "mudou de
  // status"; o trigger reuniao_etapa_notificar já ignora updates onde a
  // etapa não muda, mas o push do cliente precisa da mesma checagem.
  const atualizarCampos = async (
    patch: Record<string, unknown>,
    log?: { acao: string; detalhe: string },
  ): Promise<boolean> => {
    if (!id) return false;
    const { error } = await (supabase as any).from("reuniao").update(patch).eq("id", id);
    if (error) {
      if (error.code === "23P01") {
        toast({ title: "Sala já reservada", description: "Já existe uma reunião nesse horário para o local selecionado.", variant: "destructive" });
      } else {
        toast({ title: "Erro ao atualizar reunião", description: error.message, variant: "destructive" });
      }
      return false;
    }
    invalidarReuniao();
    if (log) registrarLog(id, log.acao, log.detalhe);
    toast({ title: "Reunião atualizada" });
    return true;
  };

  const salvarPautaItem = async (item: { titulo_topico: string; descricao: string; responsavel_user_id?: string | null; prazo?: string | null }): Promise<boolean> => {
    if (!id) return false;
    const { error } = await (supabase as any).from("reuniao_pauta").insert({
      reuniao_id: id,
      ordem: pauta.length,
      titulo_topico: item.titulo_topico,
      descricao: item.descricao || null,
      responsavel_user_id: item.responsavel_user_id ?? null,
      prazo: item.prazo ?? null,
    });
    if (error) {
      toast({ title: "Erro ao adicionar tópico", description: error.message, variant: "destructive" });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["reuniao_pauta", id] });
    if (id) registrarLog(id, "pauta_topico_criado", `Tópico adicionado: "${item.titulo_topico}"`);
    return true;
  };

  const atualizarPautaItem = async (
    pautaId: string,
    patch: Partial<Pick<ReuniaoPauta, "titulo_topico" | "descricao" | "responsavel_user_id" | "prazo" | "status">>,
  ): Promise<boolean> => {
    const { error } = await (supabase as any).from("reuniao_pauta").update(patch).eq("id", pautaId);
    if (error) {
      toast({ title: "Erro ao atualizar tópico", description: error.message, variant: "destructive" });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["reuniao_pauta", id] });
    return true;
  };

  const reordenarPauta = async (itensOrdenados: string[]): Promise<boolean> => {
    const updates = itensOrdenados.map((pautaId, ordem) =>
      (supabase as any).from("reuniao_pauta").update({ ordem }).eq("id", pautaId),
    );
    const resultados = await Promise.all(updates);
    const erro = resultados.find((r) => r.error)?.error;
    if (erro) {
      toast({ title: "Erro ao reordenar pauta", description: erro.message, variant: "destructive" });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["reuniao_pauta", id] });
    return true;
  };

  const removerPautaItem = async (pautaId: string): Promise<boolean> => {
    const titulo = pauta.find((p) => p.id === pautaId)?.titulo_topico ?? pautaId;
    const { error } = await (supabase as any).from("reuniao_pauta").delete().eq("id", pautaId);
    if (error) {
      toast({ title: "Erro ao remover tópico", description: error.message, variant: "destructive" });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["reuniao_pauta", id] });
    if (id) registrarLog(id, "pauta_topico_removido", `Tópico removido: "${titulo}"`);
    return true;
  };

  const salvarResposta = async (pautaId: string, texto: string, encaminhamento: string): Promise<boolean> => {
    const existente = respostas.find((r) => r.pauta_id === pautaId);
    const { error } = existente
      ? await (supabase as any)
          .from("reuniao_resposta")
          .update({ texto_resposta: texto || null, encaminhamento: encaminhamento || null })
          .eq("id", existente.id)
      : await (supabase as any)
          .from("reuniao_resposta")
          .insert({ pauta_id: pautaId, texto_resposta: texto || null, encaminhamento: encaminhamento || null });
    if (error) {
      toast({ title: "Erro ao salvar resposta", description: error.message, variant: "destructive" });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["reuniao_resposta", id] });
    return true;
  };

  const uploadAnexo = async (file: File): Promise<boolean> => {
    if (!id) return false;
    const nomeSanitizado = file.name
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${id}/${Date.now()}-${nomeSanitizado}`;
    const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
    if (up.error) {
      toast({ title: `Erro ao enviar "${file.name}"`, description: up.error.message, variant: "destructive" });
      return false;
    }
    const { error } = await (supabase as any).from("reuniao_anexo").insert({
      reuniao_id: id,
      storage_path: path,
      nome_arquivo: file.name,
      mime_type: file.type || null,
      tamanho_bytes: file.size,
    });
    if (error) {
      toast({ title: "Erro ao registrar anexo", description: error.message, variant: "destructive" });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["reuniao_anexo", id] });
    registrarLog(id, "anexo_adicionado", `Anexo adicionado: "${file.name}"`);
    return true;
  };

  const removerAnexo = async (anexoId: string): Promise<boolean> => {
    const alvo = anexos.find((a) => a.id === anexoId);
    if (!alvo || !id) return false;
    await supabase.storage.from(BUCKET).remove([alvo.storage_path]);
    const { error } = await (supabase as any).from("reuniao_anexo").delete().eq("id", anexoId);
    if (error) {
      toast({ title: "Erro ao remover anexo", description: error.message, variant: "destructive" });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["reuniao_anexo", id] });
    registrarLog(id, "anexo_removido", `Anexo removido: "${alvo.nome_arquivo}"`);
    return true;
  };

  const downloadAnexo = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast({ title: "Erro ao abrir anexo", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const uploadPautaAnexo = async (pautaId: string, file: File): Promise<boolean> => {
    const nomeSanitizado = file.name
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${pautaId}/${Date.now()}-${nomeSanitizado}`;
    const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
    if (up.error) {
      toast({ title: `Erro ao enviar "${file.name}"`, description: up.error.message, variant: "destructive" });
      return false;
    }
    const { error } = await (supabase as any).from("reuniao_pauta_anexo").insert({
      pauta_id: pautaId,
      storage_path: path,
      nome_arquivo: file.name,
      mime_type: file.type || null,
      tamanho_bytes: file.size,
    });
    if (error) {
      toast({ title: "Erro ao registrar anexo", description: error.message, variant: "destructive" });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["reuniao_pauta_anexo", id] });
    const topico = pauta.find((p) => p.id === pautaId)?.titulo_topico ?? "";
    if (id) registrarLog(id, "anexo_pauta_adicionado", `Anexo adicionado no tópico "${topico}": "${file.name}"`);
    return true;
  };

  const removerPautaAnexo = async (anexoId: string): Promise<boolean> => {
    const alvo = pautaAnexos.find((a) => a.id === anexoId);
    if (!alvo) return false;
    await supabase.storage.from(BUCKET).remove([alvo.storage_path]);
    const { error } = await (supabase as any).from("reuniao_pauta_anexo").delete().eq("id", anexoId);
    if (error) {
      toast({ title: "Erro ao remover anexo", description: error.message, variant: "destructive" });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["reuniao_pauta_anexo", id] });
    const topico = pauta.find((p) => p.id === alvo.pauta_id)?.titulo_topico ?? "";
    if (id) registrarLog(id, "anexo_pauta_removido", `Anexo removido do tópico "${topico}": "${alvo.nome_arquivo}"`);
    return true;
  };

  const adicionarConvidado = async (userId: string, nomeDisplay?: string): Promise<boolean> => {
    if (!id) return false;
    const { error } = await (supabase as any).from("reuniao_convidado").insert({ reuniao_id: id, user_id: userId });
    if (error) {
      toast({ title: "Erro ao adicionar convidado", description: error.message, variant: "destructive" });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["reuniao_convidado", id] });
    notificar("convidado");
    registrarLog(id, "convidado_adicionado", `Adicionou ${nomeDisplay ?? "um participante"}`);
    return true;
  };

  const removerConvidado = async (convidadoId: string, nomeDisplay?: string): Promise<boolean> => {
    const { error } = await (supabase as any).from("reuniao_convidado").delete().eq("id", convidadoId);
    if (error) {
      toast({ title: "Erro ao remover convidado", description: error.message, variant: "destructive" });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["reuniao_convidado", id] });
    if (id) registrarLog(id, "convidado_removido", `Removeu ${nomeDisplay ?? "um participante"}`);
    return true;
  };

  const adicionarComentario = async (texto: string): Promise<boolean> => {
    if (!id) return false;
    const { error } = await (supabase as any).from("reuniao_comentario").insert({ reuniao_id: id, texto });
    if (error) {
      toast({ title: "Erro ao comentar", description: error.message, variant: "destructive" });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["reuniao_comentario", id] });
    registrarLog(id, "comentario_adicionado", "Adicionou um comentário");
    return true;
  };

  const removerComentario = async (comentarioId: string): Promise<boolean> => {
    const { error } = await (supabase as any).from("reuniao_comentario").delete().eq("id", comentarioId);
    if (error) {
      toast({ title: "Erro ao remover comentário", description: error.message, variant: "destructive" });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["reuniao_comentario", id] });
    if (id) registrarLog(id, "comentario_removido", "Removeu um comentário");
    return true;
  };

  const salvarAssinatura = async (assinaturaPng: string): Promise<boolean> => {
    if (!id) return false;
    const { error } = await (supabase as any)
      .from("reuniao_assinatura")
      .upsert({ reuniao_id: id, user_id: user?.id, assinatura_png: assinaturaPng }, { onConflict: "reuniao_id,user_id" });
    if (error) {
      toast({ title: "Erro ao assinar", description: error.message, variant: "destructive" });
      return false;
    }
    qc.invalidateQueries({ queryKey: ["reuniao_assinatura", id] });
    registrarLog(id, "assinatura_registrada", "Registrou assinatura");
    toast({ title: "Assinatura registrada" });
    return true;
  };

  return {
    reuniao, isLoading, pauta, respostas, convidados, anexos, pautaAnexos, comentarios, assinaturas, logs,
    mudarEtapa, cancelarReuniao, iniciarReuniao, encerrarReuniao, atualizarCampos,
    salvarPautaItem, atualizarPautaItem, reordenarPauta, removerPautaItem, salvarResposta,
    uploadAnexo, removerAnexo, downloadAnexo, uploadPautaAnexo, removerPautaAnexo,
    adicionarConvidado, removerConvidado, adicionarComentario, removerComentario, salvarAssinatura,
  };
}
