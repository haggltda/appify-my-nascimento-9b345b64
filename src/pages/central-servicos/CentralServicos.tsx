import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { BookOpen, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

// Serviços disponíveis na Central de Serviços (cada um é um card que leva à sua tela).
const servicos = [
  {
    to: "/app/central-servicos/orientacoes-juridicas",
    icon: BookOpen,
    title: "Orientações Jurídicas",
    desc: "Biblioteca de perguntas e respostas jurídicas publicadas pelo Jurídico. Consulte as dúvidas mais comuns ou envie a sua.",
  },
];

export default function CentralServicos() {
  return (
    <div>
      <PageHeader
        title="Central de Serviços"
        subtitle="Atendimento e orientações ao colaborador."
        module="Central de Serviços"
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {servicos.map((s) => (
          <Link key={s.to} to={s.to} className="group">
            <Card className="flex h-full flex-col gap-3 p-5 transition-all hover:border-primary/40 hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  {s.title}
                  <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
