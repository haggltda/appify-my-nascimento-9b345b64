import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const UNIDADES = ["dias", "dias úteis", "semanas", "meses", "anos"] as const;
type Unidade = (typeof UNIDADES)[number];

function parsePrazo(v: string): { num: string; unit: Unidade } {
  if (!v) return { num: "", unit: "dias" };
  const m = v.match(/^(\d+)\s+(.+)$/i);
  if (m) {
    const rawUnit = m[2].toLowerCase().trim();
    const matched = UNIDADES.find((u) => rawUnit === u || rawUnit.startsWith(u.split(" ")[0]));
    return { num: m[1], unit: matched ?? "dias" };
  }
  // If it's just a number, return it
  if (/^\d+$/.test(v.trim())) return { num: v.trim(), unit: "dias" };
  return { num: "", unit: "dias" };
}

interface PrazoInputProps {
  value: string;
  onChange: (v: string) => void;
}

export function PrazoInput({ value, onChange }: PrazoInputProps) {
  const parsed = parsePrazo(value);
  const [num, setNum]   = useState(parsed.num);
  const [unit, setUnit] = useState<Unidade>(parsed.unit);

  // Sync when value changes externally (edit mode)
  useEffect(() => {
    const p = parsePrazo(value);
    setNum(p.num);
    setUnit(p.unit);
  }, [value]);

  function emit(n: string, u: Unidade) {
    onChange(n ? `${n} ${u}` : "");
  }

  return (
    <div className="flex gap-1">
      <Input
        type="number"
        min={0}
        value={num}
        onChange={(e) => { setNum(e.target.value); emit(e.target.value, unit); }}
        className="h-9 w-20 shrink-0"
        placeholder="0"
      />
      <Select value={unit} onValueChange={(u) => { const un = u as Unidade; setUnit(un); emit(num, un); }}>
        <SelectTrigger className="h-9 flex-1 min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {UNIDADES.map((u) => (
            <SelectItem key={u} value={u}>{u}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
