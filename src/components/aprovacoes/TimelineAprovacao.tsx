import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, Bot, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const TIPO_TONE: Record<string, string> = {
  bloqueante: "bg-destructive/15 text-destructive border-destructive/30",
  consultivo: "bg-blue-500/15 text-blue-700 border-blue-300",
  ciencia: "bg-muted text-muted-foreground border-border",
};

const STATUS_ICON: Record<string, JSX.Element> = {
  aprovado:      <Check className="h-3.5 w-3.5 text-emerald-600" />,
  reprovado:     <X className="h-3.5 w-3.5 text-destructive" />,
  auto_aprovado: <Bot className="h-3.5 w-3.5 text-emerald-600" />,
  pendente:      <Clock className="h-3.5 w-3.5 text-amber-600" />,
  cancelado:     <X className="h-3.5 w-3.5 text-muted-foreground" />,
};

interface Props {
  alvo: "requisicao_compra" | "pedido_compra" | "licitacao_etapa" | "programacao_pagamento";
  referenciaId: string;
}

/**
 * Trilha visual da instância de aprovação para um documento.
 * Procura a instância pendente OU a última encerrada por (alvo, referencia_id).
 */
export function TimelineAprovacao({ alvo, referenciaId }: Props) {
  const q = useQuery({
    queryKey: ["timeline-aprovacao", alvo, referenciaId],
    enabled: !!referenciaId,
    queryFn: async () => {
      const { data: inst, error: e1 } = await (supabase as any)
        .from("sup_aprov_instancia")
        .select("*")
        .eq("alvo", alvo)
        .eq("referencia_id", referenciaId)
        .order("aberta_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (e1) throw e1;
      if (!inst) return { instancia: null, etapas: [], votos: [] };

      const [{ data: etapas }, { data: votos }] = await Promise.all([
        (supabase as any).from("sup_aprov_etapa").select("*").eq("instancia_id", inst.id).order("ordem"),
        (supabase as any).from("sup_aprov_voto").select("*").eq("instancia_id", inst.id).order("votado_em"),
      ]);

      // Enriquecer nomes de usuários
      const uids = new Set<string>();
      (etapas ?? []).forEach((e: any) => e.responsavel_user_id && uids.add(e.responsavel_user_id));
      (votos ?? []).forEach((v: any) => v.usuario_id && uids.add(v.usuario_id));
      let profilesMap: Record<string, any> = {};
      if (uids.size) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name, email")
          .in("id", Array.from(uids));
        (profs ?? []).forEach((p: any) => (profilesMap[p.id] = p));
      }
      return { instancia: inst, etapas: etapas ?? [], votos: votos ?? [], profiles: profilesMap };
    },
  });

  if (q.isLoading) return <p className="text-xs text-muted-foreground">Carregando trilha…</p>;
  if (!q.data?.instancia) return <p className="text-xs text-muted-foreground">Nenhuma aprovação registrada para este documento.</p>;

  const { instancia, etapas, votos, profiles = {} } = q.data;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Instância</span>
          <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{instancia.id.slice(0, 8)}</code>
          <Badge variant="outline" className={
            instancia.status === "aprovado" ? "bg-emerald-500/15 text-emerald-700 border-emerald-300" :
            instancia.status === "reprovado" ? "bg-destructive/15 text-destructive border-destructive/30" :
            "bg-amber-500/15 text-amber-700 border-amber-300"
          }>{instancia.status}</Badge>
        </div>
        <span className="text-muted-foreground">
          aberta {formatDistanceToNow(new Date(instancia.aberta_em), { addSuffix: true, locale: ptBR })}
        </span>
      </div>

      <ol className="relative border-l-2 border-border pl-4 space-y-3">
        {etapas.map((e: any) => {
          const votosEtapa = votos.filter((v: any) => v.etapa_id === e.id);
          const resp = profiles[e.responsavel_user_id];
          const tone = TIPO_TONE[e.tipo_parecer] ?? TIPO_TONE.consultivo;
          return (
            <li key={e.id} className="relative">
              <span className="absolute -left-[1.42rem] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-background border-2 border-border">
                {STATUS_ICON[e.status] ?? STATUS_ICON.pendente}
              </span>
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <p className="text-sm font-medium">{e.ordem}. {e.nome}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Responsável: {resp?.display_name || resp?.email || "—"}
                      {e.prazo_horas && <> · Prazo: {e.prazo_horas}h</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="outline" className={tone}>{e.tipo_parecer}</Badge>
                    <Badge variant="outline" className="capitalize">{e.status}</Badge>
                  </div>
                </div>
                {votosEtapa.length > 0 && (
                  <ul className="mt-2 space-y-1.5 border-t border-border pt-2">
                    {votosEtapa.map((v: any) => {
                      const u = profiles[v.usuario_id];
                      return (
                        <li key={v.id} className="flex items-start gap-2 text-xs">
                          <MessageSquare className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                          <div className="flex-1">
                            <p>
                              <strong>{u?.display_name || u?.email || "Usuário"}</strong>{" "}
                              <span className={
                                v.parecer === "aprovado" ? "text-emerald-700" :
                                v.parecer === "reprovado" ? "text-destructive" : "text-muted-foreground"
                              }>{v.parecer}</span>{" "}
                              <span className="text-muted-foreground">
                                · {formatDistanceToNow(new Date(v.votado_em), { addSuffix: true, locale: ptBR })}
                              </span>
                            </p>
                            {v.justificativa && <p className="text-muted-foreground italic mt-0.5">"{v.justificativa}"</p>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
