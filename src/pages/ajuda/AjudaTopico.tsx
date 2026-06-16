import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { getArtigo } from "@/content/ajuda";

export default function AjudaTopico() {
  const { modulo, slug } = useParams();
  const artigo = modulo && slug ? getArtigo(modulo, slug) : undefined;

  if (!artigo) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/app/ajuda">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar à Central
          </Link>
        </Button>
        <Card className="p-6">
          <h1 className="text-xl font-semibold">Artigo não encontrado</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verifique se o link está correto ou volte à Central de Ajuda.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/app/ajuda">
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar à Central
        </Link>
      </Button>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{artigo.moduloLabel}</Badge>
          <span className="text-xs text-muted-foreground">Atualizado em {artigo.updatedAt}</span>
        </div>
      </div>

      <Card className="p-6">
        <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-3xl prose-h2:text-xl prose-h2:mt-6 prose-table:text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{artigo.conteudo}</ReactMarkdown>
        </article>
      </Card>

      <div className="flex flex-wrap gap-1">
        {artigo.tags.map((t) => (
          <Badge key={t} variant="outline" className="text-[10px]">
            {t}
          </Badge>
        ))}
      </div>
    </div>
  );
}
