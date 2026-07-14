import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Mail, MessageSquare, AlertTriangle, Eye, Check, X, Send } from "lucide-react";
import { toast } from "sonner";

const canalIcon = (c: string) => {
  if (c === "email") return <Mail className="h-3.5 w-3.5" />;
  if (c === "whatsapp") return <MessageSquare className="h-3.5 w-3.5" />;
  return <AlertTriangle className="h-3.5 w-3.5" />;
};

export default function AprovacaoCobrancaTab() {
  const qc = useQueryClient();
  const [preview, setPreview] = useState<any | null>(null);

  const { data: pendentes = [], isLoading } = useQuery<any[]>({
    queryKey: ["regua-aguardando-aprovacao"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("regua_cobranca_execucao")
        .select("*, titulo_receber(numero, sacado_nome, valor), regua_cobranca_etapa(setor_remetente, ordem)")
        .eq("status", "aguardando_aprovacao")
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const acionar = useMutation({
    mutationFn: async ({ execucao_id, acao }: { execucao_id: string; acao: "aprovar" | "rejeitar" | "confirmar_manual" }) => {
      const { data, error } = await supabase.functions.invoke("regua-cobranca-aprovar", { body: { execucao_id, acao } });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error);
      return data;
    },
    onSuccess: (_data, variables) => {
      const msg = variables.acao === "rejeitar" ? "Envio rejeitado." : "Envio confirmado!";
      toast.success(msg);
      setPreview(null);
      qc.invalidateQueries({ queryKey: ["regua-aguardando-aprovacao"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Fila de aprovação ({pendentes.length})
          </CardTitle>
          <CardDescription>
            Etapas jurídicas graves e canais não automatizados (WhatsApp) sempre passam por aqui antes de sair -
            ninguém envia sozinho sem revisão.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : pendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhum envio aguardando aprovação.</p>
          ) : (
            <div className="space-y-2">
              {pendentes.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3 border rounded-md">
                  <Badge variant="outline" className="text-xs gap-1">{canalIcon(p.canal)} {p.canal}</Badge>
                  {p.regua_cobranca_etapa?.setor_remetente && (
                    <Badge variant="secondary" className="text-xs capitalize">{p.regua_cobranca_etapa.setor_remetente}</Badge>
                  )}
                  <div className="flex-1 text-sm">
                    <span className="font-medium">{p.titulo_receber?.sacado_nome}</span>
                    <span className="text-muted-foreground"> - Título {p.titulo_receber?.numero} - {p.destinatario ?? "sem destinatário"}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setPreview(p)}>
                    <Eye className="h-3.5 w-3.5 mr-1" /> Ver
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {preview && (
        <Dialog open onOpenChange={(o) => !o && setPreview(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{preview.assunto || "(sem assunto - canal " + preview.canal + ")"}</DialogTitle>
              <DialogDescription>
                {preview.titulo_receber?.sacado_nome} • Título {preview.titulo_receber?.numero} • Para: {preview.destinatario ?? "-"}
              </DialogDescription>
            </DialogHeader>

            <div
              className="border rounded-md p-4 max-h-[50vh] overflow-y-auto text-sm whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: preview.canal === "email" ? preview.conteudo ?? "" : "" }}
            />
            {preview.canal !== "email" && (
              <div className="border rounded-md p-4 max-h-[50vh] overflow-y-auto text-sm whitespace-pre-wrap">
                {preview.conteudo}
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => acionar.mutate({ execucao_id: preview.id, acao: "rejeitar" })}
                disabled={acionar.isPending}
              >
                <X className="h-4 w-4 mr-1" /> Rejeitar
              </Button>

              {preview.canal === "email" ? (
                <Button onClick={() => acionar.mutate({ execucao_id: preview.id, acao: "aprovar" })} disabled={acionar.isPending}>
                  <Check className="h-4 w-4 mr-1" /> Aprovar e enviar
                </Button>
              ) : preview.canal === "whatsapp" ? (
                <>
                  <Button variant="secondary" asChild>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(preview.conteudo ?? "")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Send className="h-4 w-4 mr-1" /> Abrir WhatsApp
                    </a>
                  </Button>
                  <Button onClick={() => acionar.mutate({ execucao_id: preview.id, acao: "confirmar_manual" })} disabled={acionar.isPending}>
                    <Check className="h-4 w-4 mr-1" /> Marcar como enviado
                  </Button>
                </>
              ) : (
                <Button onClick={() => acionar.mutate({ execucao_id: preview.id, acao: "confirmar_manual" })} disabled={acionar.isPending}>
                  <Check className="h-4 w-4 mr-1" /> Marcar como enviado
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
