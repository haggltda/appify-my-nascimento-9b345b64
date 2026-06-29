import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { FileDown, Eraser, PenLine } from "lucide-react";
import { ETAPAS, nomeUsuario, type Assinatura, type Usuario } from "./types";

const ETAPA_LABEL: Record<string, string> = Object.fromEntries(ETAPAS.map((e) => [e.key, e.label]));

function CanvasAssinatura({ onSalvar }: { onSalvar: (png: string) => Promise<void> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const vazio = useRef(true);
  const [salvando, setSalvando] = useState(false);

  const pos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const ponto = "touches" in e ? e.touches[0] : e;
    return { x: ponto.clientX - rect.left, y: ponto.clientY - rect.top };
  };

  const iniciar = (e: React.MouseEvent | React.TouchEvent) => {
    desenhando.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const desenhar = (e: React.MouseEvent | React.TouchEvent) => {
    if (!desenhando.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    vazio.current = false;
  };

  const parar = () => { desenhando.current = false; };

  const limpar = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    vazio.current = true;
  };

  const salvar = async () => {
    if (vazio.current) return;
    setSalvando(true);
    await onSalvar(canvasRef.current!.toDataURL("image/png"));
    limpar();
    setSalvando(false);
  };

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assinar nesta etapa</p>
      <canvas
        ref={canvasRef}
        width={460}
        height={140}
        className="w-full cursor-crosshair rounded border border-dashed border-border bg-white touch-none"
        onMouseDown={iniciar}
        onMouseMove={desenhar}
        onMouseUp={parar}
        onMouseLeave={parar}
        onTouchStart={iniciar}
        onTouchMove={desenhar}
        onTouchEnd={parar}
      />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={limpar}>
          <Eraser className="h-3.5 w-3.5" /> Limpar
        </Button>
        <Button size="sm" className="gap-1.5" disabled={salvando} onClick={salvar}>
          <PenLine className="h-3.5 w-3.5" /> {salvando ? "Salvando…" : "Assinar"}
        </Button>
      </div>
    </div>
  );
}

export function AssinaturasTab({
  solicitacaoId, etapaAtual, usuarios, userId, titulo,
}: {
  solicitacaoId: string;
  etapaAtual: string;
  usuarios: Usuario[];
  userId: string | null;
  titulo: string;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: assinaturas = [] } = useQuery({
    queryKey: ["sistema_solicitacao_assinatura", solicitacaoId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sistema_solicitacao_assinatura")
        .select("id, user_id, etapa, assinatura_png, created_at")
        .eq("solicitacao_id", solicitacaoId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Assinatura[];
    },
  });

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

  const exportarPdf = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const margemX = 15;
    let y = 18;

    doc.setFontSize(14);
    doc.text(`Assinaturas — ${titulo}`, margemX, y);
    y += 10;
    doc.setFontSize(9);
    doc.setTextColor(120);

    assinaturas.forEach((a) => {
      if (y > 260) { doc.addPage(); y = 18; }
      const nome = nomeUsuario(usuarios, a.user_id) ?? "Usuário";
      const etapaLabel = ETAPA_LABEL[a.etapa] ?? a.etapa;
      const dataFmt = new Date(a.created_at).toLocaleString("pt-BR");

      doc.setTextColor(30);
      doc.setFontSize(10);
      doc.text(`${nome} — ${etapaLabel}`, margemX, y);
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(dataFmt, margemX, y + 5);
      try {
        doc.addImage(a.assinatura_png, "PNG", margemX, y + 7, 70, 21);
      } catch {
        // imagem inválida — segue sem travar o PDF inteiro.
      }
      y += 34;
    });

    if (assinaturas.length === 0) {
      doc.setFontSize(10);
      doc.text("Nenhuma assinatura registrada.", margemX, y);
    }

    doc.save(`assinaturas-${titulo.replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`);
  };

  return (
    <div className="max-h-[480px] space-y-3 overflow-y-auto py-2">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={exportarPdf}>
          <FileDown className="h-3.5 w-3.5" /> Exportar PDF
        </Button>
      </div>

      <CanvasAssinatura onSalvar={salvarAssinatura} />

      <div className="space-y-2">
        {assinaturas.map((a) => (
          <div key={a.id} className="space-y-1.5 rounded-md border border-border p-3">
            <p className="text-xs">
              <span className="font-medium">{nomeUsuario(usuarios, a.user_id) ?? "Usuário"}</span>{" "}
              <span className="text-muted-foreground">— {ETAPA_LABEL[a.etapa] ?? a.etapa}</span>
            </p>
            <p className="text-[11px] text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR")}</p>
            <img src={a.assinatura_png} alt="Assinatura" className="h-20 rounded border border-border bg-white" />
          </div>
        ))}
        {assinaturas.length === 0 && <p className="text-[11px] text-muted-foreground">Nenhuma assinatura ainda.</p>}
      </div>
    </div>
  );
}
