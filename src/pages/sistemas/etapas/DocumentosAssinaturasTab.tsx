import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText } from "lucide-react";
import { ETAPAS, nomeUsuario, type Anexo, type Comentario, type Convidado, type Solicitacao, type Usuario } from "./types";
import { FONTE_ASSINATURA, gerarPngAssinatura } from "@/lib/assinatura";

const ETAPA_LABEL: Record<string, string> = Object.fromEntries(ETAPAS.map((e) => [e.key, e.label]));
import { DOCUMENTOS_OFICIAIS, documentoDisponivel, type DocumentoOficial } from "./documentos";
import { DocumentoDetalheModal } from "./DocumentoDetalheModal";

function AssinarForm({ nomePadrao, onSalvar }: { nomePadrao: string; onSalvar: (png: string) => Promise<void> }) {
  const [nome, setNome] = useState(nomePadrao);
  const [salvando, setSalvando] = useState(false);

  const assinar = async () => {
    if (!nome.trim()) return;
    setSalvando(true);
    const png = await gerarPngAssinatura(nome.trim());
    await onSalvar(png);
    setSalvando(false);
  };

  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <h3 className="text-lg font-bold">Assinar</h3>
      <p className="text-sm text-muted-foreground">digite seu nome — a assinatura é gerada em letra emendada</p>
      <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Digite seu nome" className="text-sm" />
      <div className="flex h-32 items-center justify-center rounded border border-border bg-white px-4">
        <p style={{ fontFamily: FONTE_ASSINATURA, fontWeight: 700 }} className="max-w-full truncate text-4xl text-slate-800">
          {nome || "Sua assinatura"}
        </p>
      </div>
      <div className="flex gap-2">
        <Button disabled={!nome.trim() || salvando} onClick={assinar}>{salvando ? "Salvando…" : "Salvar"}</Button>
        <Button variant="outline" onClick={() => setNome("")}>Limpar</Button>
      </div>
    </div>
  );
}

export function DocumentosAssinaturasTab({
  solicitacaoId, etapaAtual, usuarios, userId, titulo, card, anexos, comentarios, convidados, onDownloadAnexo,
}: {
  solicitacaoId: string;
  etapaAtual: string;
  usuarios: Usuario[];
  userId: string | null;
  titulo: string;
  card: Solicitacao;
  anexos: Anexo[];
  comentarios: Comentario[];
  convidados: Convidado[];
  onDownloadAnexo: (path: string) => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [documentoAberto, setDocumentoAberto] = useState<DocumentoOficial | null>(null);

  const salvarAssinatura = async (png: string) => {
    if (!userId) return;
    const { error } = await (supabase as any).from("sistema_solicitacao_assinatura").insert({
      solicitacao_id: solicitacaoId,
      user_id: userId,
      etapa: etapaAtual,
      assinatura_png: png,
    });
    if (error) {
      toast({ title: "Erro ao assinar", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["sistema_solicitacao_assinatura", solicitacaoId] });
    toast({ title: "Assinatura salva" });
  };

  const disponiveis = DOCUMENTOS_OFICIAIS.filter((doc) => documentoDisponivel(doc, card, anexos, comentarios, convidados));

  return (
    <div className="max-h-[480px] space-y-3 overflow-y-auto py-2">
      <AssinarForm nomePadrao={nomeUsuario(usuarios, userId) ?? ""} onSalvar={salvarAssinatura} />

      <div className="space-y-2">
        {disponiveis.map((doc) => (
          <div key={doc.numero} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-bold">Anexo {doc.numero} – {doc.nome} ({doc.sigla})</p>
                <p className="text-xs text-muted-foreground">Documento da etapa "{ETAPA_LABEL[doc.etapaOrigem] ?? doc.etapaOrigem}"</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setDocumentoAberto(doc)}>abrir</Button>
          </div>
        ))}
        {disponiveis.length === 0 && (
          <p className="text-[11px] text-muted-foreground">Nenhum documento disponível ainda — vai aparecendo conforme o card avança no fluxo.</p>
        )}
      </div>

      <DocumentoDetalheModal
        documento={documentoAberto}
        onClose={() => setDocumentoAberto(null)}
        card={card}
        anexos={anexos}
        comentarios={comentarios}
        convidados={convidados}
        usuarios={usuarios}
        onDownloadAnexo={onDownloadAnexo}
        titulo={titulo}
        solicitacaoId={solicitacaoId}
      />
    </div>
  );
}
