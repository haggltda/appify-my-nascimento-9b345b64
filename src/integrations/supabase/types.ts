export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          diff: Json | null
          id: number
          op: string
          pk: string | null
          schema_name: string
          table_name: string
          ts: string
          user_id: string | null
        }
        Insert: {
          diff?: Json | null
          id?: number
          op: string
          pk?: string | null
          schema_name: string
          table_name: string
          ts?: string
          user_id?: string | null
        }
        Update: {
          diff?: Json | null
          id?: number
          op?: string
          pk?: string | null
          schema_name?: string
          table_name?: string
          ts?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_04: {
        Row: {
          diff: Json | null
          id: number
          op: string
          pk: string | null
          schema_name: string
          table_name: string
          ts: string
          user_id: string | null
        }
        Insert: {
          diff?: Json | null
          id?: number
          op: string
          pk?: string | null
          schema_name: string
          table_name: string
          ts?: string
          user_id?: string | null
        }
        Update: {
          diff?: Json | null
          id?: number
          op?: string
          pk?: string | null
          schema_name?: string
          table_name?: string
          ts?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_05: {
        Row: {
          diff: Json | null
          id: number
          op: string
          pk: string | null
          schema_name: string
          table_name: string
          ts: string
          user_id: string | null
        }
        Insert: {
          diff?: Json | null
          id?: number
          op: string
          pk?: string | null
          schema_name: string
          table_name: string
          ts?: string
          user_id?: string | null
        }
        Update: {
          diff?: Json | null
          id?: number
          op?: string
          pk?: string | null
          schema_name?: string
          table_name?: string
          ts?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_2026_06: {
        Row: {
          diff: Json | null
          id: number
          op: string
          pk: string | null
          schema_name: string
          table_name: string
          ts: string
          user_id: string | null
        }
        Insert: {
          diff?: Json | null
          id?: number
          op: string
          pk?: string | null
          schema_name: string
          table_name: string
          ts?: string
          user_id?: string | null
        }
        Update: {
          diff?: Json | null
          id?: number
          op?: string
          pk?: string | null
          schema_name?: string
          table_name?: string
          ts?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_default: {
        Row: {
          diff: Json | null
          id: number
          op: string
          pk: string | null
          schema_name: string
          table_name: string
          ts: string
          user_id: string | null
        }
        Insert: {
          diff?: Json | null
          id?: number
          op: string
          pk?: string | null
          schema_name: string
          table_name: string
          ts?: string
          user_id?: string | null
        }
        Update: {
          diff?: Json | null
          id?: number
          op?: string
          pk?: string | null
          schema_name?: string
          table_name?: string
          ts?: string
          user_id?: string | null
        }
        Relationships: []
      }
      centros_custo: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          empresa_id: string
          id: string
          nome: string
          responsavel: string | null
          tipo: Database["public"]["Enums"]["cc_tipo"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          responsavel?: string | null
          tipo?: Database["public"]["Enums"]["cc_tipo"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          responsavel?: string | null
          tipo?: Database["public"]["Enums"]["cc_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "centros_custo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      classificador_valores: {
        Row: {
          ativo: boolean
          classificador_id: string
          codigo: string
          created_at: string
          descricao: string
          id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          classificador_id: string
          codigo: string
          created_at?: string
          descricao: string
          id?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          classificador_id?: string
          codigo?: string
          created_at?: string
          descricao?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classificador_valores_classificador_id_fkey"
            columns: ["classificador_id"]
            isOneToOne: false
            referencedRelation: "classificadores"
            referencedColumns: ["id"]
          },
        ]
      }
      classificadores: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classificadores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_linhas: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string
          empresa_id: string
          id: string
          natureza: Database["public"]["Enums"]["dre_natureza"]
          nivel: number
          ordem: number
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao: string
          empresa_id: string
          id?: string
          natureza: Database["public"]["Enums"]["dre_natureza"]
          nivel?: number
          ordem?: number
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string
          empresa_id?: string
          id?: string
          natureza?: Database["public"]["Enums"]["dre_natureza"]
          nivel?: number
          ordem?: number
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dre_linhas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dre_linhas_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "dre_linhas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          ativa: boolean
          cnpj: string
          codigo: string
          created_at: string
          id: string
          nome_fantasia: string | null
          razao_social: string
          regime: Database["public"]["Enums"]["regime_tributario"]
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          cnpj: string
          codigo: string
          created_at?: string
          id?: string
          nome_fantasia?: string | null
          razao_social: string
          regime: Database["public"]["Enums"]["regime_tributario"]
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          cnpj?: string
          codigo?: string
          created_at?: string
          id?: string
          nome_fantasia?: string | null
          razao_social?: string
          regime?: Database["public"]["Enums"]["regime_tributario"]
          updated_at?: string
        }
        Relationships: []
      }
      obz_periodos: {
        Row: {
          created_at: string
          id: string
          mes: number
          status: Database["public"]["Enums"]["periodo_status"]
          updated_at: string
          versao_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mes: number
          status?: Database["public"]["Enums"]["periodo_status"]
          updated_at?: string
          versao_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mes?: number
          status?: Database["public"]["Enums"]["periodo_status"]
          updated_at?: string
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obz_periodos_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "obz_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      obz_valores: {
        Row: {
          centro_custo_id: string | null
          classificadores: Json
          created_at: string
          dre_linha_id: string
          id: string
          memoria_calculo: string | null
          periodo_id: string
          updated_at: string
          valor: number
          versao_id: string
        }
        Insert: {
          centro_custo_id?: string | null
          classificadores?: Json
          created_at?: string
          dre_linha_id: string
          id?: string
          memoria_calculo?: string | null
          periodo_id: string
          updated_at?: string
          valor?: number
          versao_id: string
        }
        Update: {
          centro_custo_id?: string | null
          classificadores?: Json
          created_at?: string
          dre_linha_id?: string
          id?: string
          memoria_calculo?: string | null
          periodo_id?: string
          updated_at?: string
          valor?: number
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obz_valores_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obz_valores_dre_linha_id_fkey"
            columns: ["dre_linha_id"]
            isOneToOne: false
            referencedRelation: "dre_linhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obz_valores_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "obz_periodos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obz_valores_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "obz_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      obz_versoes: {
        Row: {
          ano: number
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string
          criado_por: string | null
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          revisao: number
          status: Database["public"]["Enums"]["obz_status"]
          updated_at: string
          versao: number
        }
        Insert: {
          ano: number
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          revisao?: number
          status?: Database["public"]["Enums"]["obz_status"]
          updated_at?: string
          versao: number
        }
        Update: {
          ano?: number
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          revisao?: number
          status?: Database["public"]["Enums"]["obz_status"]
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "obz_versoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          display_name: string | null
          email: string | null
          empresa_id: string | null
          id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          display_name?: string | null
          email?: string | null
          empresa_id?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          display_name?: string | null
          email?: string | null
          empresa_id?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_fk"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          acao: Database["public"]["Enums"]["app_acao"]
          created_at: string
          id: string
          modulo: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          acao: Database["public"]["Enums"]["app_acao"]
          created_at?: string
          id?: string
          modulo: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          acao?: Database["public"]["Enums"]["app_acao"]
          created_at?: string
          id?: string
          modulo?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_empresa: { Args: { _user_id: string }; Returns: string }
      has_permission: {
        Args: {
          _acao: Database["public"]["Enums"]["app_acao"]
          _modulo: string
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_acao:
        | "visualizar"
        | "incluir"
        | "alterar"
        | "excluir"
        | "aprovar"
        | "exportar"
        | "executar_ia"
        | "alterar_dre"
      app_role:
        | "admin"
        | "controladoria"
        | "comercial"
        | "operacional"
        | "juridico"
        | "sst"
        | "diretor_adm"
        | "diretor_op"
        | "visitante"
      cc_tipo: "adm" | "operacional"
      dre_natureza:
        | "receita"
        | "deducao"
        | "custo"
        | "despesa"
        | "resultado"
        | "tributo"
        | "financeiro"
      obz_status: "rascunho" | "em_aprovacao" | "aprovada" | "arquivada"
      periodo_status: "aberto" | "fechado"
      regime_tributario: "lucro_real" | "lucro_presumido" | "simples_nacional"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_acao: [
        "visualizar",
        "incluir",
        "alterar",
        "excluir",
        "aprovar",
        "exportar",
        "executar_ia",
        "alterar_dre",
      ],
      app_role: [
        "admin",
        "controladoria",
        "comercial",
        "operacional",
        "juridico",
        "sst",
        "diretor_adm",
        "diretor_op",
        "visitante",
      ],
      cc_tipo: ["adm", "operacional"],
      dre_natureza: [
        "receita",
        "deducao",
        "custo",
        "despesa",
        "resultado",
        "tributo",
        "financeiro",
      ],
      obz_status: ["rascunho", "em_aprovacao", "aprovada", "arquivada"],
      periodo_status: ["aberto", "fechado"],
      regime_tributario: ["lucro_real", "lucro_presumido", "simples_nacional"],
    },
  },
} as const
