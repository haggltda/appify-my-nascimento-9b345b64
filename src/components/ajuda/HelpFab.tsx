import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { HelpCircle, X, Search, BookOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ARTIGOS, buscarArtigos, getArtigosPorRota } from "@/content/ajuda";
import { cn } from "@/lib/utils";

export function HelpFab() {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const { pathname } = useLocation();

  const contextuais = useMemo(() => getArtigosPorRota(pathname), [pathname]);
  const resultados = useMemo(
    () => (termo ? buscarArtigos(termo) : ARTIGOS),
    [termo],
  );

  // Não mostra na própria central de ajuda
  if (pathname.startsWith("/app/ajuda")) return null;

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 hover:shadow-xl"
        aria-label="Abrir ajuda"
      >
        <HelpCircle className="h-6 w-6" />
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={() => setAberto(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l bg-background shadow-2xl transition-transform",
          aberto ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!aberto}
      >
        <header className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold">Ajuda</div>
              <div className="text-xs text-muted-foreground">Base de conhecimento</div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setAberto(false)} aria-label="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="border-b p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Buscar artigo..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {contextuais.length > 0 && !termo && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Relacionados a esta tela
              </h3>
              <ul className="space-y-2">
                {contextuais.map((a) => (
                  <ArtigoLink key={a.slug} artigo={a} onClick={() => setAberto(false)} />
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {termo ? `${resultados.length} resultado(s)` : "Todos os artigos"}
            </h3>
            {resultados.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nada encontrado para "{termo}".</p>
            ) : (
              <ul className="space-y-2">
                {resultados.map((a) => (
                  <ArtigoLink key={`${a.modulo}/${a.slug}`} artigo={a} onClick={() => setAberto(false)} />
                ))}
              </ul>
            )}
          </section>
        </div>

        <footer className="border-t p-4">
          <Button asChild variant="outline" className="w-full" onClick={() => setAberto(false)}>
            <Link to="/app/ajuda">
              <ExternalLink className="mr-2 h-4 w-4" /> Abrir Central de Ajuda
            </Link>
          </Button>
        </footer>
      </aside>
    </>
  );
}

function ArtigoLink({
  artigo,
  onClick,
}: {
  artigo: (typeof ARTIGOS)[number];
  onClick: () => void;
}) {
  return (
    <li>
      <Link
        to={`/app/ajuda/${artigo.modulo}/${artigo.slug}`}
        onClick={onClick}
        className="block rounded-md border p-3 transition hover:border-primary hover:bg-accent/40"
      >
        <div className="mb-1 flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">
            {artigo.moduloLabel}
          </Badge>
        </div>
        <div className="text-sm font-medium">{artigo.titulo}</div>
        <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{artigo.resumo}</div>
      </Link>
    </li>
  );
}
