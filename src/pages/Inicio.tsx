import { useAuth } from "@/hooks/useAuth";

export default function Inicio() {
  const { user } = useAuth();
  const fullName =
    (user?.user_metadata as any)?.full_name ||
    (user?.user_metadata as any)?.name ||
    user?.email?.split("@")[0] ||
    "";
  const primeiroNome = fullName
    ? String(fullName).trim().split(/[\s._-]+/)[0]
    : "";
  const nomeFmt = primeiroNome
    ? primeiroNome.charAt(0).toUpperCase() + primeiroNome.slice(1).toLowerCase()
    : "";

  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center px-6">
      <div className="max-w-3xl text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight text-foreground lg:text-6xl">
          Olá, <span className="text-primary">{nomeFmt || "amigo"}</span>!
        </h1>

        <h2 className="mt-4 font-display text-4xl font-bold tracking-tight text-foreground lg:text-6xl">
          <span className="text-primary">Consagre</span> o seu trabalho.
        </h2>

        <p className="mt-8 text-lg italic leading-relaxed text-muted-foreground lg:text-xl">
          Consagre ao Senhor tudo o que você faz, e os seus planos serão
          bem-sucedidos.
        </p>
        <p className="mt-1 text-center text-xl text-muted-foreground lg:text-2xl">
          (Provérbios 16:3)
        </p>
      </div>
    </div>
  );
}
