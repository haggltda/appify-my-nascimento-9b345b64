import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight } from "lucide-react";
import { COMPLEXIDADE_LABEL, type EtapaPanelProps } from "./types";

export function DefinicaoResponsavelPanel({ card, papeis, usuarios, onUpdate }: EtapaPanelProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Gerente de Sistemas define quem será o responsável por esta demanda e a complexidade dela.</p>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Responsável</label>
        <SearchableSelect
          value={card.responsavel_user_id}
          onChange={(v) => onUpdate({ responsavel_user_id: v })}
          options={usuarios.map((u) => ({ value: u.id, label: u.display_name }))}
          placeholder="Selecionar responsável…"
          searchPlaceholder="Buscar usuário..."
          disabled={!papeis.gerenteSistemas}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Complexidade</label>
        <Select
          value={card.complexidade ?? undefined}
          onValueChange={(v) => onUpdate({ complexidade: v })}
          disabled={!papeis.gerenteSistemas}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Selecionar complexidade…" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(COMPLEXIDADE_LABEL).map(([v, label]) => (
              <SelectItem key={v} value={v}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        className="gap-1.5"
        disabled={!papeis.gerenteSistemas || !card.responsavel_user_id || !card.complexidade}
        onClick={() => onUpdate({ etapa: "desenvolvimento_ajustes" })}
      >
        <ArrowRight className="h-3.5 w-3.5" /> Avançar para Desenvolvimento e Ajustes
      </Button>
      {!papeis.gerenteSistemas && <p className="text-[11px] text-muted-foreground">Só o Gerente de Sistemas age nesta etapa.</p>}
    </div>
  );
}
