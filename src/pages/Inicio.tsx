import { BookOpen } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function Inicio() {
  const { user } = useAuth();
  const fullName =
    (user?.user_metadata as any)?.full_name ||
    (user?.user_metadata as any)?.name ||
    user?.email?.split("@")[0] ||
    "";
  const primeiroNome = fullName ? String(fullName).trim().split(" ")[0] : "";
  const saudacao = primeiroNome
    ? `Olá, ${primeiroNome.charAt(0).toUpperCase() + primeiroNome.slice(1)}!`
    : "Olá!";

  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center px-6">
      <div className="max-w-3xl text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground lg:text-6xl">
          {saudacao}
        </h1>

        <p className="mt-10 font-display text-3xl leading-snug text-foreground lg:text-5xl">
          <span className="font-bold">Consagre</span> ao Senhor tudo o que você
          faz, e os seus planos serão bem-sucedidos.
          <BookOpen
            className="ml-2 inline-block h-7 w-7 align-middle text-muted-foreground lg:h-9 lg:w-9"
            strokeWidth={1.5}
            aria-hidden
          />
        </p>

        <p className="mt-6 text-base text-muted-foreground lg:text-lg">
          — Provérbios 16:3
        </p>
      </div>
    </div>
  );
}
