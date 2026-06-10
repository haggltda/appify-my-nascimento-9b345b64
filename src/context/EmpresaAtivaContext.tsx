import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { empresasGrupo, type EmpresaGrupo } from "@/data/controladoria";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface EmpresaAtivaContextValue {
  empresa: EmpresaGrupo;
  empresas: EmpresaGrupo[];
  setEmpresa: (id: string) => void;
  loading: boolean;
}

const EmpresaAtivaContext = createContext<EmpresaAtivaContextValue | null>(null);

const LS_KEY = "gn:empresa_ativa";

// Mapeia a row do banco para o shape EmpresaGrupo usado pela UI.
function mapEmpresa(row: any): EmpresaGrupo {
  return {
    id: row.id,
    sigla: row.codigo ?? (row.razao_social ?? "—").slice(0, 6),
    razao: row.razao_social ?? row.nome_fantasia ?? row.codigo ?? "Empresa",
    cnpj: row.cnpj ?? "",
    regime: (row.regime ?? "Lucro Real") as EmpresaGrupo["regime"],
    papel: row.nome_fantasia ?? row.codigo ?? "Empresa do grupo",
    validacaoDocumentalObrigatoria: false,
  };
}

export function EmpresaAtivaProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [empresas, setEmpresas] = useState<EmpresaGrupo[]>(empresasGrupo);
  const [empresaId, setEmpresaId] = useState<string>(() => {
    if (typeof window === "undefined") return empresasGrupo[0].id;
    return localStorage.getItem(LS_KEY) ?? empresasGrupo[0].id;
  });
  const [loading, setLoading] = useState(true);

  // Carrega as empresas do usuário autenticado, respeitando acessa_todas_empresas e user_empresa.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      console.log('[EmpresaAtivaContext] load() iniciado', new Date().toISOString());
      // Modo demo (sem usuário): mantém o mock.
      if (!user) {
        if (!cancelled) {
          setEmpresas(empresasGrupo);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        // Profile (flag + empresa atual + empresa_id fallback)
        const { data: profile } = await supabase
          .from("profiles")
          .select("empresa_atual_id, empresa_id, acessa_todas_empresas")
          .eq("id", user.id)
          .maybeSingle();

        let rows: any[] = [];
        if ((profile as any)?.acessa_todas_empresas) {
          const { data } = await supabase
            .from("empresas")
            .select("id,codigo,razao_social,nome_fantasia,cnpj,regime,ativa")
            .eq("ativa", true)
            .order("codigo");
          rows = data ?? [];
        } else {
          // Empresas via vínculo
          const { data: vinculos } = await supabase
            .from("user_empresa")
            .select("empresa_id, empresas:empresa_id(id,codigo,razao_social,nome_fantasia,cnpj,regime,ativa)")
            .eq("user_id", user.id);
          rows = (vinculos ?? [])
            .map((v: any) => v.empresas)
            .filter((e: any) => e && e.ativa);
          // Fallback: garante a empresa_id do profile
          if (profile?.empresa_id && !rows.some((r) => r.id === profile.empresa_id)) {
            const { data: own } = await supabase
              .from("empresas")
              .select("id,codigo,razao_social,nome_fantasia,cnpj,regime,ativa")
              .eq("id", profile.empresa_id)
              .maybeSingle();
            if (own && own.ativa) rows.unshift(own);
          }
        }

        const mapped = rows.map(mapEmpresa);
        if (cancelled) return;

        if (mapped.length === 0) {
          // Usuário sem nenhuma empresa: mantém o mock para não quebrar a UI, mas sinaliza.
          setEmpresas(empresasGrupo);
          setLoading(false);
          return;
        }
        setEmpresas(mapped);

        // Define empresa ativa: empresa_atual_id se for válida, senão primeira do conjunto.
        const ativa =
          (profile?.empresa_atual_id && mapped.find((e) => e.id === profile.empresa_atual_id)?.id) ||
          mapped[0].id;
        setEmpresaId(ativa);
        try { localStorage.setItem(LS_KEY, ativa); } catch { /* noop */ }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (!authLoading) load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  const setEmpresa = useCallback((id: string) => {
    setEmpresaId(id);
    try { localStorage.setItem(LS_KEY, id); } catch { /* noop */ }
    if (user) {
      // Persiste no profile. O trigger valida o vínculo no banco.
      supabase.from("profiles").update({ empresa_atual_id: id }).eq("id", user.id).then(({ error }) => {
        if (error) {
          // Reverte localmente se o banco recusar.
          // eslint-disable-next-line no-console
          console.warn("Falha ao trocar empresa ativa:", error.message);
        }
      });
    }
  }, [user]);

  const value = useMemo<EmpresaAtivaContextValue>(() => {
    const empresa = empresas.find((e) => e.id === empresaId) ?? empresas[0];
    return { empresa, empresas, setEmpresa, loading };
  }, [empresas, empresaId, setEmpresa, loading]);

  return <EmpresaAtivaContext.Provider value={value}>{children}</EmpresaAtivaContext.Provider>;
}

export function useEmpresaAtiva() {
  const ctx = useContext(EmpresaAtivaContext);
  if (!ctx) throw new Error("useEmpresaAtiva deve ser usado dentro de EmpresaAtivaProvider");
  return ctx;
}
