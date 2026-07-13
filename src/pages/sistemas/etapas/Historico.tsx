import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { APROVACOES_TESTES_INTERNOS, CRITERIO_TRIAGEM_LABEL, ETAPAS, STATUS_DESENVOLVIMENTO_LABEL, nomeUsuario, type Usuario } from "./types";

interface LogRow {
  id: string;
  user_id: string | null;
  acao: string;
  etapa_de: string | null;
  etapa_para: string | null;
  detalhe: string | null;
  created_at: string;
}

const ETAPA_LABEL: Record<string, string> = Object.fromEntries(ETAPAS.map((e) => [e.key, e.label]));

const ACAO_LABEL: Record<string, (l: LogRow) => string> = {
  criado: () => "criou a solicitação",
  mover_etapa: (l) => `moveu de "${ETAPA_LABEL[l.etapa_de ?? ""] ?? l.etapa_de}" para "${ETAPA_LABEL[l.etapa_para ?? ""] ?? l.etapa_para}"`,
  recusado: (l) => (l.detalhe === "true" ? "recusou o card" : "reativou o card"),
  definir_responsavel: () => "definiu o responsável",
  definir_prioridade: (l) => `definiu a prioridade ${l.detalhe}`,
  atualizar_progresso: (l) => `atualizou o progresso para ${l.detalhe}%`,
  definir_prazo: (l) => `definiu o prazo para ${l.detalhe}`,
  definir_status_desenvolvimento: (l) => `definiu o status de desenvolvimento como "${STATUS_DESENVOLVIMENTO_LABEL[l.detalhe ?? ""] ?? l.detalhe}"`,
  definir_status_implantacao: (l) => `marcou implantação como "${l.detalhe}"`,
  finalizado: (l) => (l.detalhe === "true" ? "finalizou a demanda" : "reabriu a demanda"),
  definir_criterio_triagem: (l) => `definiu o critério como "${CRITERIO_TRIAGEM_LABEL[l.detalhe ?? ""] ?? l.detalhe}"`,
  aprovacao_testes_internos_1: (l) => `${l.detalhe === "true" ? "marcou" : "desmarcou"} o botão "${APROVACOES_TESTES_INTERNOS.testes_interno_aprov_1}"`,
  aprovacao_testes_internos_2: (l) => `${l.detalhe === "true" ? "marcou" : "desmarcou"} o botão "${APROVACOES_TESTES_INTERNOS.testes_interno_aprov_2}"`,
  aprovacao_testes_internos_3: (l) => `${l.detalhe === "true" ? "marcou" : "desmarcou"} o botão "${APROVACOES_TESTES_INTERNOS.testes_interno_aprov_3}"`,
};

export function Historico({ solicitacaoId, usuarios }: { solicitacaoId: string; usuarios: Usuario[] }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["sistema_solicitacao_log", solicitacaoId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sistema_solicitacao_log")
        .select("id, user_id, acao, etapa_de, etapa_para, detalhe, created_at")
        .eq("solicitacao_id", solicitacaoId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });

  if (isLoading) return <p className="text-[11px] text-muted-foreground">Carregando histórico…</p>;
  if (logs.length === 0) return <p className="text-[11px] text-muted-foreground">Sem histórico ainda.</p>;

  return (
    <div className="space-y-2">
      {logs.map((l) => {
        const nome = nomeUsuario(usuarios, l.user_id) ?? "Usuário";
        const descrever = ACAO_LABEL[l.acao];
        return (
          <div key={l.id} className="text-[11px]">
            <span className="font-medium">{nome}</span>{" "}
            <span className="text-muted-foreground">{descrever ? descrever(l) : l.acao}</span>{" "}
            <span className="text-muted-foreground">- {new Date(l.created_at).toLocaleString("pt-BR")}</span>
          </div>
        );
      })}
    </div>
  );
}
