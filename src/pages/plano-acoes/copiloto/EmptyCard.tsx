import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  emptyText: string;
  badge?: string;
  accent?: "primary" | "amber" | "emerald" | "rose" | "sky";
  children?: React.ReactNode;
  className?: string;
}

const accentMap: Record<NonNullable<Props["accent"]>, string> = {
  primary: "from-primary/10 to-transparent text-primary",
  amber: "from-amber-500/10 to-transparent text-amber-600 dark:text-amber-400",
  emerald: "from-emerald-500/10 to-transparent text-emerald-600 dark:text-emerald-400",
  rose: "from-rose-500/10 to-transparent text-rose-600 dark:text-rose-400",
  sky: "from-sky-500/10 to-transparent text-sky-600 dark:text-sky-400",
};

export function EmptyCard({ icon: Icon, title, emptyText, badge, accent = "primary", children, className }: Props) {
  const accentCls = accentMap[accent];
  return (
    <Card className={cn("overflow-hidden border-primary/10", className)}>
      <div className={cn("flex items-center justify-between gap-2 p-3 border-b bg-gradient-to-br", accentCls)}>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {badge && (
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{badge}</Badge>
        )}
      </div>
      <div className="p-4">
        {children ?? (
          <p className="text-xs text-muted-foreground italic">{emptyText}</p>
        )}
      </div>
    </Card>
  );
}
