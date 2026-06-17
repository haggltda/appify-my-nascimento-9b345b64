import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ARTIGOS, MODULOS, PERSONAS, buscarArtigos, type ArtigoMeta, type ArtigoStatus, type Persona } from "@/content/ajuda";
import { BookOpen, Search, ArrowRight } from "lucide-react";

const STATUS_LABEL: Record<ArtigoStatus, string> = {
  disponivel: "Disponível",
  em_implantacao: "Em implantação",
  pendente: "Pendente",
};

const STATUS_VARIANT: Record<ArtigoStatus, "default" | "secondary" | "outline"> = {
  disponivel: "default",
  em_implantacao: "secondary",
  pendente: "outline",
};

export default function Ajuda() {
  const [termo, setTermo] = useState("");
  const [persona, setPersona] = useState<Persona | undefined>(undefined);
  const resultados = useMemo(() => buscarArtigos(termo, persona), [termo, persona]);
  const filtrando = Boolean(termo || persona);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <BookOpen className="h-5 w-5" />
          <span className="text-sm font-medium uppercase tracking-wider">Base de Conhecimento</span>
        </div>
        <h1 className="text-3xl font-bold">Central de Ajuda</h1>
        <p className="text-muted-foreground">
          Manuais, passo a passo e respostas rápidas sobre cada módulo do ERP.
        </p>
      </header>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar por título, tag ou módulo..."
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Persona:</span>
        <Button
          size="sm"
          variant={persona === undefined ? "default" : "outline"}
          onClick={() => setPersona(undefined)}
        >
          Todas
        </Button>
        {PERSONAS.map((p) => (
          <Button
            key={p.id}
            size="sm"
            variant={persona === p.id ? "default" : "outline"}
            onClick={() => setPersona(p.id)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {filtrando ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            {resultados.length} resultado{resultados.length === 1 ? "" : "s"}
          </h2>
          {resultados.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground">
              Nenhum artigo encontrado para os filtros atuais.
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {resultados.map((a) => (
                <ArtigoCard key={`${a.modulo}/${a.slug}`} artigo={a} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="space-y-8">
          {MODULOS.map((m) => {
            const artigos = ARTIGOS.filter((a) => a.modulo === m.id);
            return (
              <section key={m.id} className="space-y-3">
                <div>
                  <h2 className="text-xl font-semibold">{m.label}</h2>
                  <p className="text-sm text-muted-foreground">{m.descricao}</p>
                </div>
                {artigos.length === 0 ? (
                  <Card className="p-4 text-sm text-muted-foreground">
                    Nenhum artigo publicado ainda neste módulo.
                  </Card>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {artigos.map((a) => (
                      <ArtigoCard key={a.slug} artigo={a} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ArtigoCard({ artigo }: { artigo: ArtigoMeta }) {
  const status = artigo.status ?? "disponivel";
  const rotaPrincipal = artigo.rotasRelacionadas[0];
  return (
    <Card className="flex h-full flex-col p-4 transition hover:border-primary hover:shadow-md">
      <Link to={`/app/ajuda/${artigo.modulo}/${artigo.slug}`} className="flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{artigo.moduloLabel}</Badge>
          <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
          <span className="text-xs text-muted-foreground">Atualizado em {artigo.updatedAt}</span>
        </div>
        <h3 className="font-semibold">{artigo.titulo}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{artigo.resumo}</p>
        <div className="mt-3 flex flex-wrap gap-1">
          {artigo.tags.slice(0, 4).map((t) => (
            <Badge key={t} variant="outline" className="text-[10px]">
              {t}
            </Badge>
          ))}
        </div>
      </Link>
      {rotaPrincipal && (
        <div className="mt-3 flex justify-end">
          <Button asChild size="sm" variant="ghost">
            <Link to={rotaPrincipal}>
              Ir para a tela <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      )}
    </Card>
  );
}
