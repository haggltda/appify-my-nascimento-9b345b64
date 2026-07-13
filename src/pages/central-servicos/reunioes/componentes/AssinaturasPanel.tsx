import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2 } from "lucide-react";
import { FONTE_ASSINATURA, gerarPngAssinatura } from "@/lib/assinatura";
import { nomeUsuario, type ReuniaoAssinatura, type Usuario } from "../types";

export function AssinaturasPanel({
  assinaturas, usuarios, userId, nomePadrao, onAssinar,
}: {
  assinaturas: ReuniaoAssinatura[];
  usuarios: Usuario[];
  userId: string | undefined;
  nomePadrao: string;
  onAssinar: (assinaturaPng: string) => Promise<boolean>;
}) {
  const [nome, setNome] = useState(nomePadrao);
  const [salvando, setSalvando] = useState(false);
  const jaAssinei = assinaturas.some((a) => a.user_id === userId);

  const assinar = async () => {
    if (!nome.trim()) return;
    setSalvando(true);
    const png = await gerarPngAssinatura(nome.trim());
    await onAssinar(png);
    setSalvando(false);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {assinaturas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma assinatura registrada ainda.</p>}
        {assinaturas.map((a) => (
          <div key={a.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <div>
              <p className="font-medium">{nomeUsuario(usuarios, a.user_id) ?? "Usuário"}</p>
              <p className="text-xs text-muted-foreground">Assinou em {new Date(a.created_at).toLocaleString("pt-BR")}</p>
            </div>
          </div>
        ))}
      </div>

      {!jaAssinei && (
        <div className="space-y-2 rounded-lg border border-border p-4">
          <h3 className="text-sm font-bold">Assinar</h3>
          <p className="text-xs text-muted-foreground">
            Assinatura opcional - digite seu nome, a assinatura é gerada em letra emendada. Não bloqueia a conclusão da ata.
          </p>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Digite seu nome" className="text-sm" />
          <div className="flex h-24 items-center justify-center rounded border border-border bg-white px-4">
            <p style={{ fontFamily: FONTE_ASSINATURA, fontWeight: 700 }} className="max-w-full truncate text-3xl text-slate-800">
              {nome || "Sua assinatura"}
            </p>
          </div>
          <Button size="sm" disabled={!nome.trim() || salvando} onClick={assinar}>
            {salvando ? "Salvando…" : "Salvar assinatura"}
          </Button>
        </div>
      )}
    </div>
  );
}
