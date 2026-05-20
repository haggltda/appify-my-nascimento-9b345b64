import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaAtiva } from "@/context/EmpresaAtivaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Send, Gavel } from "lucide-react";
import { toast } from "sonner";
import { TimelineAprovacao } from "./TimelineAprovacao";

interface Props {
  licitacaoId: string;
  licitacaoCodigo: string;
  valorEstimado: number;
}

const STORE_KEY = "licitacao_aprov_uuid_v1";

/** Converte string arbitrária (mock seed id) em UUID v5-like determinístico via SHA-256. */
async function stableUuidFromString(input: string): Promise<string> {
  const enc = new TextEncoder().encode("licitacao:" + input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const b = Array.from(new Uint8Array(buf)).slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50; // version 5
  b[8] = (b[8] & 0x3f) | 0x80; // variant
  const hex = b.map((n) => n.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function LicitacaoAprovacaoBox({ licitacaoId, licitacaoCodigo, valorEstimado }: Props) {
  const { empresaAtiva } = useEmpresaAtiva();
  const qc = useQueryClient();
  const [refUuid, setRefUuid] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const cache = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
        if (cache[licitacaoId]) { setRefUuid(cache[licitacaoId]); return; }
        const uuid = await stableUuidFromString(licitacaoId);
        cache[licitacaoId] = uuid;
        localStorage.setItem(STORE_KEY, JSON.stringify(cache));
        setRefUuid(uuid);
      } catch (e) {
        console.warn("uuid gen failed", e);
      }
    })();
  }, [licitacaoId]);

  const enviar = useMutation({
    mutationFn: async () => {
      if (!empresaAtiva?.id) throw new Error("Selecione uma empresa ativa no topo");
      if (!refUuid) throw new Error("Aguardando referência");
      const { data: u } = await supabase.auth.getUser();
      const { data: fluxoId, error: e1 } = await (supabase as any).rpc("sup_aprov_fluxo_padrao", {
        _empresa_id: empresaAtiva.id, _alvo: "licitacao_etapa",
      });
      if (e1) throw e1;
      if (!fluxoId) throw new Error("Nenhum fluxo de aprovação cadastrado para Licitação nesta empresa. Cadastre em Administração → Alçadas.");
      const { error } = await (supabase as any).rpc("sup_aprov_abrir_instancia", {
        _fluxo_id: fluxoId,
        _referencia_id: refUuid,
        _referencia_codigo: licitacaoCodigo,
        _valor: valorEstimado || 0,
        _centro_custo_id: null,
        _solicitante: u.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Licitação enviada para alçada");
      qc.invalidateQueries({ queryKey: ["timeline-aprovacao"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Gavel className="h-4 w-4 text-primary" /> Alçadas da licitação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => enviar.mutate()} disabled={enviar.isPending || !refUuid}>
            <Send className="mr-2 h-3.5 w-3.5" /> Enviar à alçada
          </Button>
        </div>
        {refUuid && <TimelineAprovacao alvo="licitacao_etapa" referenciaId={refUuid} />}
      </CardContent>
    </Card>
  );
}
