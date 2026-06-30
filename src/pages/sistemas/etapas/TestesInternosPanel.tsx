import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, ArrowLeft, FileDown } from "lucide-react";
import { APROVACOES_TESTES_INTERNOS, type EtapaPanelProps } from "./types";
import { AnexoSimples } from "./AnexoSimples";
import { exportarPdfEtapa } from "./documentoPdf";

const APROVACOES = Object.entries(APROVACOES_TESTES_INTERNOS).map(([campo, nome]) => ({
  campo: campo as keyof typeof APROVACOES_TESTES_INTERNOS,
  nome,
}));

export function TestesInternosPanel({
  card, papeis, userId, aprovadoresTestesInternos, anexos, onUpdate, onComentar, onAnexar, onDownloadAnexo,
}: EtapaPanelProps) {
  const [justificativa, setJustificativa] = useState("");
  const podeVoltar = papeis.desenvolvedores;
  const podeAvancar = papeis.desenvolvedores;
  const todasAprovadas = APROVACOES.every((a) => card[a.campo]);

  const voltar = async () => {
    if (!justificativa.trim()) return;
    const ok = await onComentar(justificativa, "justificativa_retorno");
    if (ok) {
      setJustificativa("");
      await onUpdate({ etapa: "desenvolvimento" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportarPdfEtapa("testes_internos", card, anexos, comentarios, usuarios)}>
          <FileDown className="h-3.5 w-3.5" /> Exportar PDF
        </Button>
      </div>
      <div className="space-y-2 rounded-md border border-border p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aguardando Aprovações Necessárias</p>
        {APROVACOES.map((a, i) => {
          const aprovador = aprovadoresTestesInternos.find((ap) => ap.slot === i + 1);
          const souEu = !!aprovador?.user_id && aprovador.user_id === userId;
          return (
            <label key={a.campo} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={card[a.campo]}
                disabled={!souEu}
                onCheckedChange={(checked) => onUpdate({ [a.campo]: checked === true })}
              />
              {a.nome}
            </label>
          );
        })}
        <p className="text-[11px] text-muted-foreground">Cada aprovação só pode ser marcada pela própria pessoa.</p>
      </div>

      <AnexoSimples
        titulo="Relatório de Testes Internos (anexo)"
        campo="testes_internos"
        podeAnexar={papeis.desenvolvedores}
        anexos={anexos}
        onAnexar={(f) => onAnexar(f, "testes_internos")}
        onDownloadAnexo={onDownloadAnexo}
      />

      <Button className="gap-1.5" disabled={!podeAvancar || !todasAprovadas} onClick={() => onUpdate({ etapa: "homologacao_area_solicitante" })}>
        <ArrowRight className="h-3.5 w-3.5" /> Avançar para Homologação da Área Solicitante
      </Button>
      {!podeAvancar && <p className="text-[11px] text-muted-foreground">Só Desenvolvedores podem avançar esta etapa.</p>}
      {podeAvancar && !todasAprovadas && (
        <p className="text-[11px] text-muted-foreground">As 3 aprovações precisam estar marcadas para avançar.</p>
      )}

      <div className="space-y-2 rounded-md border border-border p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Voltar para Desenvolvimento</p>
        <Textarea
          placeholder="Justificativa do retorno (obrigatória)…"
          value={justificativa}
          disabled={!podeVoltar}
          onChange={(e) => setJustificativa(e.target.value)}
          className="text-xs"
        />
        <Button variant="outline" className="gap-1.5" disabled={!podeVoltar || !justificativa.trim()} onClick={voltar}>
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar com justificativa
        </Button>
      </div>
      {!podeVoltar && <p className="text-[11px] text-muted-foreground">Só Desenvolvedores agem nesta etapa.</p>}
    </div>
  );
}
