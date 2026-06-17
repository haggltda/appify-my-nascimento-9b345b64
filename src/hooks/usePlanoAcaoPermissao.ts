import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissoes } from "@/context/PermissoesContext";
import { useEmpresaAtiva } from "@/context/EmpresaAtivaContext";
import type { PermissaoFlag } from "@/types/planoAcao";

export interface PlanoAcaoPermissao {
  pode_visualizar: boolean;
  pode_dashboard: boolean;
  pode_criar: boolean;
  pode_editar: boolean;
  pode_excluir: boolean;
  pode_importar: boolean;
  pode_aprovar: boolean;
  pode_administrar: boolean;
  pode_ver_todas: boolean;
}

const NONE: PlanoAcaoPermissao = {
  pode_visualizar: false, pode_dashboard: false, pode_criar: false, pode_editar: false,
  pode_excluir: false, pode_importar: false, pode_aprovar: false, pode_administrar: false,
  pode_ver_todas: false,
};

<<<<<<< HEAD
export function usePlanoAcaoPermissao() {
  const { loading } = usePermissoes();
  const { empresa, loading: loadingEmp } = useEmpresaAtiva();
  const empresaId = empresa?.id ?? null;

  const q = useQuery({
    queryKey: ["plano_acao_permissao", empresaId],
    enabled: !loading && !loadingEmp && !!empresaId,
=======
const ALL: PlanoAcaoPermissao = {
  pode_visualizar: true, pode_dashboard: true, pode_criar: true, pode_editar: true,
  pode_excluir: true, pode_importar: true, pode_aprovar: true, pode_administrar: true,
  pode_ver_todas: true,
};

export function usePlanoAcaoPermissao() {
  const { roles, loading } = usePermissoes();
  const { empresa, loading: loadingEmp } = useEmpresaAtiva();
  const empresaId = empresa?.id ?? null;
  const isAdmin = roles.includes("admin");

  const q = useQuery({
    queryKey: ["plano_acao_permissao", empresaId, isAdmin],
    enabled: !loading && !loadingEmp && !!empresaId && !isAdmin,
>>>>>>> d8769230573772fd4a4c14d334af721a471b0f8a
    queryFn: async (): Promise<PlanoAcaoPermissao> => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return NONE;
      const { data } = await supabase
        .from("plano_acao_usuario_permissao")
        .select("pode_visualizar,pode_dashboard,pode_criar,pode_editar,pode_excluir,pode_importar,pode_aprovar,pode_administrar,pode_ver_todas")
        .eq("empresa_id", empresaId!)
        .eq("profile_id", uid)
        .maybeSingle();
      return (data as PlanoAcaoPermissao) ?? NONE;
    },
  });

<<<<<<< HEAD
  const perms = q.data ?? NONE;
  const can = (p: PermissaoFlag) => perms[`pode_${p}` as keyof PlanoAcaoPermissao];
  return { perms, can, loading: loading || loadingEmp || q.isLoading };
=======
  const perms = isAdmin ? ALL : (q.data ?? NONE);
  const can = (p: PermissaoFlag) => perms[`pode_${p}` as keyof PlanoAcaoPermissao];
  return { perms, can, loading: loading || loadingEmp || q.isLoading, isAdmin };
>>>>>>> d8769230573772fd4a4c14d334af721a471b0f8a
}
