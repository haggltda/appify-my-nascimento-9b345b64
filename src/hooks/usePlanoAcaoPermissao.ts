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

export function usePlanoAcaoPermissao() {
  const { loading } = usePermissoes();
  const { empresa, loading: loadingEmp } = useEmpresaAtiva();
  const empresaId = empresa?.id ?? null;

  const q = useQuery({
    queryKey: ["plano_acao_permissao", empresaId],
    enabled: !loading && !loadingEmp && !!empresaId,
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

  const perms = q.data ?? NONE;
  const can = (p: PermissaoFlag) => perms[`pode_${p}` as keyof PlanoAcaoPermissao];
  return { perms, can, loading: loading || loadingEmp || q.isLoading };
}
