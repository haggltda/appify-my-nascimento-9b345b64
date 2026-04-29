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
      anexos: {
        Row: {
          created_at: string
          empresa_id: string
          enviado_por: string | null
          id: string
          mime_type: string | null
          modulo: string
          nome: string
          observacoes: string | null
          registro_id: string | null
          storage_path: string
          tamanho_bytes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          enviado_por?: string | null
          id?: string
          mime_type?: string | null
          modulo: string
          nome: string
          observacoes?: string | null
          registro_id?: string | null
          storage_path: string
          tamanho_bytes: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          enviado_por?: string | null
          id?: string
          mime_type?: string | null
          modulo?: string
          nome?: string
          observacoes?: string | null
          registro_id?: string | null
          storage_path?: string
          tamanho_bytes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anexos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_ia_contexto_empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      aprov_etapa: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          nome: string
          ordem: number
          role_required: Database["public"]["Enums"]["app_role"]
          updated_at: string
          valor_max: number | null
          valor_min: number | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          ordem: number
          role_required: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          valor_max?: number | null
          valor_min?: number | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          ordem?: number
          role_required?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          valor_max?: number | null
          valor_min?: number | null
        }
        Relationships: []
      }
      aprov_instancia: {
        Row: {
          comentario: string | null
          created_at: string
          decidido_em: string | null
          decidido_por: string | null
          decisao: Database["public"]["Enums"]["aprov_decisao"]
          empresa_id: string
          etapa_id: string
          id: string
          orcamento_contrato_id: string
          ordem: number
          updated_at: string
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          decidido_em?: string | null
          decidido_por?: string | null
          decisao?: Database["public"]["Enums"]["aprov_decisao"]
          empresa_id: string
          etapa_id: string
          id?: string
          orcamento_contrato_id: string
          ordem: number
          updated_at?: string
        }
        Update: {
          comentario?: string | null
          created_at?: string
          decidido_em?: string | null
          decidido_por?: string | null
          decisao?: Database["public"]["Enums"]["aprov_decisao"]
          empresa_id?: string
          etapa_id?: string
          id?: string
          orcamento_contrato_id?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aprov_instancia_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "aprov_etapa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprov_instancia_orcamento_contrato_id_fkey"
            columns: ["orcamento_contrato_id"]
            isOneToOne: false
            referencedRelation: "orcamento_contrato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprov_instancia_orcamento_contrato_id_fkey"
            columns: ["orcamento_contrato_id"]
            isOneToOne: false
            referencedRelation: "vw_dre_contrato"
            referencedColumns: ["orcamento_contrato_id"]
          },
        ]
      }
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
      base_dissidio_categoria: {
        Row: {
          ativo: boolean
          cbo: string | null
          codigo: string
          created_at: string
          data_base_mes: number | null
          empresa_id: string | null
          id: string
          nome: string
          observacoes: string | null
          sindicato: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cbo?: string | null
          codigo: string
          created_at?: string
          data_base_mes?: number | null
          empresa_id?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          sindicato?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cbo?: string | null
          codigo?: string
          created_at?: string
          data_base_mes?: number | null
          empresa_id?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          sindicato?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "base_dissidio_categoria_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_dissidio_categoria_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_ia_contexto_empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
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
          {
            foreignKeyName: "centros_custo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_ia_contexto_empresa"
            referencedColumns: ["empresa_id"]
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
          {
            foreignKeyName: "classificadores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_ia_contexto_empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      conciliacao_regras: {
        Row: {
          ativo: boolean
          centro_custo_id: string | null
          created_at: string
          dre_linha_id: string | null
          empresa_id: string
          id: string
          nome: string
          pattern_contraparte: string | null
          pattern_descricao: string | null
          pattern_documento: string | null
          prioridade: number
          updated_at: string
          valor_max: number | null
          valor_min: number | null
        }
        Insert: {
          ativo?: boolean
          centro_custo_id?: string | null
          created_at?: string
          dre_linha_id?: string | null
          empresa_id: string
          id?: string
          nome: string
          pattern_contraparte?: string | null
          pattern_descricao?: string | null
          pattern_documento?: string | null
          prioridade?: number
          updated_at?: string
          valor_max?: number | null
          valor_min?: number | null
        }
        Update: {
          ativo?: boolean
          centro_custo_id?: string | null
          created_at?: string
          dre_linha_id?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          pattern_contraparte?: string | null
          pattern_descricao?: string | null
          pattern_documento?: string | null
          prioridade?: number
          updated_at?: string
          valor_max?: number | null
          valor_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conciliacao_regras_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacao_regras_dre_linha_id_fkey"
            columns: ["dre_linha_id"]
            isOneToOne: false
            referencedRelation: "dre_linhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacao_regras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacao_regras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_ia_contexto_empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      conta_bancaria: {
        Row: {
          agencia: string
          ativa: boolean
          banco_codigo: string
          banco_nome: string
          conta: string
          conta_contabil_id: string | null
          created_at: string
          digito: string | null
          empresa_id: string
          id: string
          observacoes: string | null
          tipo: Database["public"]["Enums"]["banco_tipo"]
          titular: string | null
          updated_at: string
        }
        Insert: {
          agencia: string
          ativa?: boolean
          banco_codigo: string
          banco_nome: string
          conta: string
          conta_contabil_id?: string | null
          created_at?: string
          digito?: string | null
          empresa_id: string
          id?: string
          observacoes?: string | null
          tipo?: Database["public"]["Enums"]["banco_tipo"]
          titular?: string | null
          updated_at?: string
        }
        Update: {
          agencia?: string
          ativa?: boolean
          banco_codigo?: string
          banco_nome?: string
          conta?: string
          conta_contabil_id?: string | null
          created_at?: string
          digito?: string | null
          empresa_id?: string
          id?: string
          observacoes?: string | null
          tipo?: Database["public"]["Enums"]["banco_tipo"]
          titular?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conta_bancaria_conta_contabil_id_fkey"
            columns: ["conta_contabil_id"]
            isOneToOne: false
            referencedRelation: "conta_contabil"
            referencedColumns: ["id"]
          },
        ]
      }
      conta_contabil: {
        Row: {
          ativo: boolean
          centro_custo_padrao: string | null
          classificacao: string
          conta_reduzida: number
          created_at: string
          descricao: string
          dre_linha_id: string | null
          empresa_id: string
          entra_fluxo: boolean
          entra_orcamento: boolean
          exige_contrato: Database["public"]["Enums"]["conta_exige_contrato"]
          grupo_dre: Database["public"]["Enums"]["conta_grupo_dre"]
          id: string
          master_id: string | null
          natureza: Database["public"]["Enums"]["conta_natureza"]
          parent_id: string | null
          saldo_inicial: number
          tipo: Database["public"]["Enums"]["conta_tipo"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          centro_custo_padrao?: string | null
          classificacao: string
          conta_reduzida: number
          created_at?: string
          descricao: string
          dre_linha_id?: string | null
          empresa_id: string
          entra_fluxo?: boolean
          entra_orcamento?: boolean
          exige_contrato?: Database["public"]["Enums"]["conta_exige_contrato"]
          grupo_dre?: Database["public"]["Enums"]["conta_grupo_dre"]
          id?: string
          master_id?: string | null
          natureza: Database["public"]["Enums"]["conta_natureza"]
          parent_id?: string | null
          saldo_inicial?: number
          tipo: Database["public"]["Enums"]["conta_tipo"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          centro_custo_padrao?: string | null
          classificacao?: string
          conta_reduzida?: number
          created_at?: string
          descricao?: string
          dre_linha_id?: string | null
          empresa_id?: string
          entra_fluxo?: boolean
          entra_orcamento?: boolean
          exige_contrato?: Database["public"]["Enums"]["conta_exige_contrato"]
          grupo_dre?: Database["public"]["Enums"]["conta_grupo_dre"]
          id?: string
          master_id?: string | null
          natureza?: Database["public"]["Enums"]["conta_natureza"]
          parent_id?: string | null
          saldo_inicial?: number
          tipo?: Database["public"]["Enums"]["conta_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conta_contabil_dre_linha_id_fkey"
            columns: ["dre_linha_id"]
            isOneToOne: false
            referencedRelation: "dre_linhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conta_contabil_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "plano_contas_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conta_contabil_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "conta_contabil"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato: {
        Row: {
          centro_custo_id: string | null
          created_at: string
          empresa_id: string
          faturamento_mensal: number
          gestor: string | null
          id: string
          licitacao_id: string | null
          numero: string
          objeto: string
          observacoes: string | null
          orgao: string
          origem_licitacao_texto: string | null
          status: Database["public"]["Enums"]["contrato_status"]
          updated_at: string
          valor_total: number
          vigencia_fim: string
          vigencia_inicio: string
        }
        Insert: {
          centro_custo_id?: string | null
          created_at?: string
          empresa_id: string
          faturamento_mensal?: number
          gestor?: string | null
          id?: string
          licitacao_id?: string | null
          numero: string
          objeto: string
          observacoes?: string | null
          orgao: string
          origem_licitacao_texto?: string | null
          status?: Database["public"]["Enums"]["contrato_status"]
          updated_at?: string
          valor_total?: number
          vigencia_fim: string
          vigencia_inicio: string
        }
        Update: {
          centro_custo_id?: string | null
          created_at?: string
          empresa_id?: string
          faturamento_mensal?: number
          gestor?: string | null
          id?: string
          licitacao_id?: string | null
          numero?: string
          objeto?: string
          observacoes?: string | null
          orgao?: string
          origem_licitacao_texto?: string | null
          status?: Database["public"]["Enums"]["contrato_status"]
          updated_at?: string
          valor_total?: number
          vigencia_fim?: string
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "contrato_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_ia_contexto_empresa"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "contrato_licitacao_id_fkey"
            columns: ["licitacao_id"]
            isOneToOne: false
            referencedRelation: "licitacao"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_comprovacao: {
        Row: {
          anexo_id: string | null
          contrato_id: string
          created_at: string
          data_documento: string
          descricao: string | null
          id: string
          numero: string
          observacoes: string | null
          tipo: Database["public"]["Enums"]["comprovacao_tipo"]
          updated_at: string
          valor: number
        }
        Insert: {
          anexo_id?: string | null
          contrato_id: string
          created_at?: string
          data_documento: string
          descricao?: string | null
          id?: string
          numero: string
          observacoes?: string | null
          tipo: Database["public"]["Enums"]["comprovacao_tipo"]
          updated_at?: string
          valor?: number
        }
        Update: {
          anexo_id?: string | null
          contrato_id?: string
          created_at?: string
          data_documento?: string
          descricao?: string | null
          id?: string
          numero?: string
          observacoes?: string | null
          tipo?: Database["public"]["Enums"]["comprovacao_tipo"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "contrato_comprovacao_anexo_id_fkey"
            columns: ["anexo_id"]
            isOneToOne: false
            referencedRelation: "anexos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_comprovacao_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contrato"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_dissidio: {
        Row: {
          aplicado: boolean
          base_calculo: Database["public"]["Enums"]["dissidio_base_calculo"]
          base_dissidio_id: string | null
          competencia: string
          contrato_id: string
          contrato_posto_id: string | null
          created_at: string
          criterio: Database["public"]["Enums"]["dissidio_criterio"]
          documento_referencia: string | null
          id: string
          indice_referencia: string | null
          observacoes: string | null
          percentual: number
          updated_at: string
          valor_fixo: number
        }
        Insert: {
          aplicado?: boolean
          base_calculo?: Database["public"]["Enums"]["dissidio_base_calculo"]
          base_dissidio_id?: string | null
          competencia: string
          contrato_id: string
          contrato_posto_id?: string | null
          created_at?: string
          criterio: Database["public"]["Enums"]["dissidio_criterio"]
          documento_referencia?: string | null
          id?: string
          indice_referencia?: string | null
          observacoes?: string | null
          percentual?: number
          updated_at?: string
          valor_fixo?: number
        }
        Update: {
          aplicado?: boolean
          base_calculo?: Database["public"]["Enums"]["dissidio_base_calculo"]
          base_dissidio_id?: string | null
          competencia?: string
          contrato_id?: string
          contrato_posto_id?: string | null
          created_at?: string
          criterio?: Database["public"]["Enums"]["dissidio_criterio"]
          documento_referencia?: string | null
          id?: string
          indice_referencia?: string | null
          observacoes?: string | null
          percentual?: number
          updated_at?: string
          valor_fixo?: number
        }
        Relationships: [
          {
            foreignKeyName: "contrato_dissidio_base_dissidio_id_fkey"
            columns: ["base_dissidio_id"]
            isOneToOne: false
            referencedRelation: "base_dissidio_categoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_dissidio_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contrato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_dissidio_contrato_posto_id_fkey"
            columns: ["contrato_posto_id"]
            isOneToOne: false
            referencedRelation: "contrato_posto"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_posto: {
        Row: {
          ativo: boolean
          base_dissidio_id: string | null
          cargo: string
          contrato_id: string
          created_at: string
          epis: number
          id: string
          insalubridade_pct: number
          jornada: Database["public"]["Enums"]["posto_jornada"]
          local: string | null
          observacoes: string | null
          periculosidade_pct: number
          quantidade: number
          salario_base: number
          uniformes: number
          updated_at: string
          va: number
          vt: number
        }
        Insert: {
          ativo?: boolean
          base_dissidio_id?: string | null
          cargo: string
          contrato_id: string
          created_at?: string
          epis?: number
          id?: string
          insalubridade_pct?: number
          jornada?: Database["public"]["Enums"]["posto_jornada"]
          local?: string | null
          observacoes?: string | null
          periculosidade_pct?: number
          quantidade?: number
          salario_base?: number
          uniformes?: number
          updated_at?: string
          va?: number
          vt?: number
        }
        Update: {
          ativo?: boolean
          base_dissidio_id?: string | null
          cargo?: string
          contrato_id?: string
          created_at?: string
          epis?: number
          id?: string
          insalubridade_pct?: number
          jornada?: Database["public"]["Enums"]["posto_jornada"]
          local?: string | null
          observacoes?: string | null
          periculosidade_pct?: number
          quantidade?: number
          salario_base?: number
          uniformes?: number
          updated_at?: string
          va?: number
          vt?: number
        }
        Relationships: [
          {
            foreignKeyName: "contrato_posto_base_dissidio_id_fkey"
            columns: ["base_dissidio_id"]
            isOneToOne: false
            referencedRelation: "base_dissidio_categoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_posto_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contrato"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_faturamento: {
        Row: {
          competencia: string
          contrato_id: string
          created_at: string
          data_emissao_prevista: string | null
          data_recebimento_previsto: string | null
          empresa_id: string
          id: string
          numero_nf: string | null
          observacoes: string | null
          orcamento_contrato_id: string | null
          status: Database["public"]["Enums"]["cronograma_status"]
          updated_at: string
          valor_emitido: number
          valor_previsto: number
          valor_recebido: number
        }
        Insert: {
          competencia: string
          contrato_id: string
          created_at?: string
          data_emissao_prevista?: string | null
          data_recebimento_previsto?: string | null
          empresa_id: string
          id?: string
          numero_nf?: string | null
          observacoes?: string | null
          orcamento_contrato_id?: string | null
          status?: Database["public"]["Enums"]["cronograma_status"]
          updated_at?: string
          valor_emitido?: number
          valor_previsto?: number
          valor_recebido?: number
        }
        Update: {
          competencia?: string
          contrato_id?: string
          created_at?: string
          data_emissao_prevista?: string | null
          data_recebimento_previsto?: string | null
          empresa_id?: string
          id?: string
          numero_nf?: string | null
          observacoes?: string | null
          orcamento_contrato_id?: string | null
          status?: Database["public"]["Enums"]["cronograma_status"]
          updated_at?: string
          valor_emitido?: number
          valor_previsto?: number
          valor_recebido?: number
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_faturamento_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contrato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_faturamento_orcamento_contrato_id_fkey"
            columns: ["orcamento_contrato_id"]
            isOneToOne: false
            referencedRelation: "orcamento_contrato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_faturamento_orcamento_contrato_id_fkey"
            columns: ["orcamento_contrato_id"]
            isOneToOne: false
            referencedRelation: "vw_dre_contrato"
            referencedColumns: ["orcamento_contrato_id"]
          },
        ]
      }
      dre_linhas: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string
          empresa_id: string | null
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
          empresa_id?: string | null
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
          empresa_id?: string | null
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
            foreignKeyName: "dre_linhas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_ia_contexto_empresa"
            referencedColumns: ["empresa_id"]
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
      fluxo_caixa_projetado: {
        Row: {
          contrato_id: string | null
          created_at: string
          data_prevista: string
          descricao: string | null
          empresa_id: string
          id: string
          orcamento_contrato_id: string | null
          origem: string | null
          tipo: Database["public"]["Enums"]["fluxo_tipo"]
          updated_at: string
          valor: number
        }
        Insert: {
          contrato_id?: string | null
          created_at?: string
          data_prevista: string
          descricao?: string | null
          empresa_id: string
          id?: string
          orcamento_contrato_id?: string | null
          origem?: string | null
          tipo: Database["public"]["Enums"]["fluxo_tipo"]
          updated_at?: string
          valor?: number
        }
        Update: {
          contrato_id?: string | null
          created_at?: string
          data_prevista?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          orcamento_contrato_id?: string | null
          origem?: string | null
          tipo?: Database["public"]["Enums"]["fluxo_tipo"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fluxo_caixa_projetado_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contrato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fluxo_caixa_projetado_orcamento_contrato_id_fkey"
            columns: ["orcamento_contrato_id"]
            isOneToOne: false
            referencedRelation: "orcamento_contrato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fluxo_caixa_projetado_orcamento_contrato_id_fkey"
            columns: ["orcamento_contrato_id"]
            isOneToOne: false
            referencedRelation: "vw_dre_contrato"
            referencedColumns: ["orcamento_contrato_id"]
          },
        ]
      }
      ia_feedback: {
        Row: {
          comentario: string | null
          created_at: string
          id: string
          triagem_id: string
          user_id: string
          util: boolean
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          id?: string
          triagem_id: string
          user_id: string
          util: boolean
        }
        Update: {
          comentario?: string | null
          created_at?: string
          id?: string
          triagem_id?: string
          user_id?: string
          util?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ia_feedback_triagem_id_fkey"
            columns: ["triagem_id"]
            isOneToOne: false
            referencedRelation: "ia_triagens"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_provedores: {
        Row: {
          ativo: boolean
          base_url: string | null
          codigo: string
          config: Json
          created_at: string
          id: string
          is_default: boolean
          modelo_default: string
          nome: string
          ordem: number
          secret_name: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          base_url?: string | null
          codigo: string
          config?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          modelo_default: string
          nome: string
          ordem?: number
          secret_name?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          base_url?: string | null
          codigo?: string
          config?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          modelo_default?: string
          nome?: string
          ordem?: number
          secret_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ia_triagens: {
        Row: {
          contexto: Json
          created_at: string
          custo_usd: number | null
          duracao_ms: number | null
          empresa_id: string
          erro_msg: string | null
          id: string
          modelo: string
          modulo: string
          prompt: string
          provedor_id: string
          registro_id: string | null
          resposta: string | null
          resposta_estruturada: Json | null
          solicitado_por: string | null
          status: Database["public"]["Enums"]["ia_status"]
          tokens_input: number | null
          tokens_output: number | null
          updated_at: string
        }
        Insert: {
          contexto?: Json
          created_at?: string
          custo_usd?: number | null
          duracao_ms?: number | null
          empresa_id: string
          erro_msg?: string | null
          id?: string
          modelo: string
          modulo: string
          prompt: string
          provedor_id: string
          registro_id?: string | null
          resposta?: string | null
          resposta_estruturada?: Json | null
          solicitado_por?: string | null
          status?: Database["public"]["Enums"]["ia_status"]
          tokens_input?: number | null
          tokens_output?: number | null
          updated_at?: string
        }
        Update: {
          contexto?: Json
          created_at?: string
          custo_usd?: number | null
          duracao_ms?: number | null
          empresa_id?: string
          erro_msg?: string | null
          id?: string
          modelo?: string
          modulo?: string
          prompt?: string
          provedor_id?: string
          registro_id?: string | null
          resposta?: string | null
          resposta_estruturada?: Json | null
          solicitado_por?: string | null
          status?: Database["public"]["Enums"]["ia_status"]
          tokens_input?: number | null
          tokens_output?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ia_triagens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ia_triagens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_ia_contexto_empresa"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "ia_triagens_provedor_id_fkey"
            columns: ["provedor_id"]
            isOneToOne: false
            referencedRelation: "ia_provedores"
            referencedColumns: ["id"]
          },
        ]
      }
      licitacao: {
        Row: {
          abertura: string | null
          created_at: string
          empresa_id: string
          id: string
          modalidade: string | null
          numero: string
          objeto: string
          observacoes: string | null
          orgao: string
          status: Database["public"]["Enums"]["licitacao_status"]
          updated_at: string
          valor_estimado: number
        }
        Insert: {
          abertura?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          modalidade?: string | null
          numero: string
          objeto: string
          observacoes?: string | null
          orgao: string
          status?: Database["public"]["Enums"]["licitacao_status"]
          updated_at?: string
          valor_estimado?: number
        }
        Update: {
          abertura?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          modalidade?: string | null
          numero?: string
          objeto?: string
          observacoes?: string | null
          orgao?: string
          status?: Database["public"]["Enums"]["licitacao_status"]
          updated_at?: string
          valor_estimado?: number
        }
        Relationships: [
          {
            foreignKeyName: "licitacao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licitacao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_ia_contexto_empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
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
          {
            foreignKeyName: "obz_versoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_ia_contexto_empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      orcamento_ciclo: {
        Row: {
          ano: number
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          empresa_id: string
          id: string
          nome: string
          observacoes: string | null
          status: Database["public"]["Enums"]["orcamento_ciclo_status"]
          updated_at: string
        }
        Insert: {
          ano: number
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id: string
          id?: string
          nome: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["orcamento_ciclo_status"]
          updated_at?: string
        }
        Update: {
          ano?: number
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["orcamento_ciclo_status"]
          updated_at?: string
        }
        Relationships: []
      }
      orcamento_contrato: {
        Row: {
          ciclo_id: string
          contrato_id: string
          created_at: string
          empresa_id: string
          gerado_em: string | null
          gerado_por: string | null
          id: string
          margem_estimada: number
          observacoes: string | null
          status: Database["public"]["Enums"]["orcamento_contrato_status"]
          updated_at: string
          valor_custo_total: number
          valor_receita_total: number
        }
        Insert: {
          ciclo_id: string
          contrato_id: string
          created_at?: string
          empresa_id: string
          gerado_em?: string | null
          gerado_por?: string | null
          id?: string
          margem_estimada?: number
          observacoes?: string | null
          status?: Database["public"]["Enums"]["orcamento_contrato_status"]
          updated_at?: string
          valor_custo_total?: number
          valor_receita_total?: number
        }
        Update: {
          ciclo_id?: string
          contrato_id?: string
          created_at?: string
          empresa_id?: string
          gerado_em?: string | null
          gerado_por?: string | null
          id?: string
          margem_estimada?: number
          observacoes?: string | null
          status?: Database["public"]["Enums"]["orcamento_contrato_status"]
          updated_at?: string
          valor_custo_total?: number
          valor_receita_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_contrato_ciclo_id_fkey"
            columns: ["ciclo_id"]
            isOneToOne: false
            referencedRelation: "orcamento_ciclo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_contrato_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contrato"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_contrato_linha: {
        Row: {
          centro_custo_id: string | null
          competencia: string
          created_at: string
          dre_linha_id: string
          empresa_id: string
          id: string
          locked: boolean
          memoria_calculo: string | null
          orcamento_contrato_id: string
          source: Database["public"]["Enums"]["orcamento_linha_source"]
          updated_at: string
          valor_previsto: number
        }
        Insert: {
          centro_custo_id?: string | null
          competencia: string
          created_at?: string
          dre_linha_id: string
          empresa_id: string
          id?: string
          locked?: boolean
          memoria_calculo?: string | null
          orcamento_contrato_id: string
          source?: Database["public"]["Enums"]["orcamento_linha_source"]
          updated_at?: string
          valor_previsto?: number
        }
        Update: {
          centro_custo_id?: string | null
          competencia?: string
          created_at?: string
          dre_linha_id?: string
          empresa_id?: string
          id?: string
          locked?: boolean
          memoria_calculo?: string | null
          orcamento_contrato_id?: string
          source?: Database["public"]["Enums"]["orcamento_linha_source"]
          updated_at?: string
          valor_previsto?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_contrato_linha_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_contrato_linha_dre_linha_id_fkey"
            columns: ["dre_linha_id"]
            isOneToOne: false
            referencedRelation: "dre_linhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_contrato_linha_orcamento_contrato_id_fkey"
            columns: ["orcamento_contrato_id"]
            isOneToOne: false
            referencedRelation: "orcamento_contrato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_contrato_linha_orcamento_contrato_id_fkey"
            columns: ["orcamento_contrato_id"]
            isOneToOne: false
            referencedRelation: "vw_dre_contrato"
            referencedColumns: ["orcamento_contrato_id"]
          },
        ]
      }
      parametro_orcamento: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          observacoes: string | null
          pct_encargos_sociais: number
          pct_fgts: number
          pct_lucro_meta: number
          pct_provisoes: number
          pct_tributos_receita: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          observacoes?: string | null
          pct_encargos_sociais?: number
          pct_fgts?: number
          pct_lucro_meta?: number
          pct_provisoes?: number
          pct_tributos_receita?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          observacoes?: string | null
          pct_encargos_sociais?: number
          pct_fgts?: number
          pct_lucro_meta?: number
          pct_provisoes?: number
          pct_tributos_receita?: number
          updated_at?: string
        }
        Relationships: []
      }
      plano_contas_master: {
        Row: {
          ativo: boolean
          centro_custo_padrao: string | null
          classificacao: string
          conta_reduzida: number
          created_at: string
          descricao: string
          dre_linha_id: string | null
          entra_fluxo: boolean
          entra_orcamento: boolean
          exige_contrato: Database["public"]["Enums"]["conta_exige_contrato"]
          grupo_dre: Database["public"]["Enums"]["conta_grupo_dre"]
          id: string
          natureza: Database["public"]["Enums"]["conta_natureza"]
          parent_id: string | null
          tipo: Database["public"]["Enums"]["conta_tipo"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          centro_custo_padrao?: string | null
          classificacao: string
          conta_reduzida: number
          created_at?: string
          descricao: string
          dre_linha_id?: string | null
          entra_fluxo?: boolean
          entra_orcamento?: boolean
          exige_contrato?: Database["public"]["Enums"]["conta_exige_contrato"]
          grupo_dre?: Database["public"]["Enums"]["conta_grupo_dre"]
          id?: string
          natureza: Database["public"]["Enums"]["conta_natureza"]
          parent_id?: string | null
          tipo: Database["public"]["Enums"]["conta_tipo"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          centro_custo_padrao?: string | null
          classificacao?: string
          conta_reduzida?: number
          created_at?: string
          descricao?: string
          dre_linha_id?: string | null
          entra_fluxo?: boolean
          entra_orcamento?: boolean
          exige_contrato?: Database["public"]["Enums"]["conta_exige_contrato"]
          grupo_dre?: Database["public"]["Enums"]["conta_grupo_dre"]
          id?: string
          natureza?: Database["public"]["Enums"]["conta_natureza"]
          parent_id?: string | null
          tipo?: Database["public"]["Enums"]["conta_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_contas_master_dre_linha_id_fkey"
            columns: ["dre_linha_id"]
            isOneToOne: false
            referencedRelation: "dre_linhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_contas_master_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "plano_contas_master"
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
            foreignKeyName: "profiles_empresa_fk"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_ia_contexto_empresa"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_ia_contexto_empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      realizado_lancamentos: {
        Row: {
          centro_custo_id: string | null
          classificadores: Json
          contraparte: string | null
          created_at: string
          data_competencia: string
          data_lancamento: string
          descricao: string
          documento: string | null
          dre_linha_id: string | null
          empresa_id: string
          hash_dedup: string | null
          id: string
          lote_id: string | null
          observacoes: string | null
          origem_externa_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          centro_custo_id?: string | null
          classificadores?: Json
          contraparte?: string | null
          created_at?: string
          data_competencia: string
          data_lancamento: string
          descricao: string
          documento?: string | null
          dre_linha_id?: string | null
          empresa_id: string
          hash_dedup?: string | null
          id?: string
          lote_id?: string | null
          observacoes?: string | null
          origem_externa_id?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          centro_custo_id?: string | null
          classificadores?: Json
          contraparte?: string | null
          created_at?: string
          data_competencia?: string
          data_lancamento?: string
          descricao?: string
          documento?: string | null
          dre_linha_id?: string | null
          empresa_id?: string
          hash_dedup?: string | null
          id?: string
          lote_id?: string | null
          observacoes?: string | null
          origem_externa_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "realizado_lancamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realizado_lancamentos_dre_linha_id_fkey"
            columns: ["dre_linha_id"]
            isOneToOne: false
            referencedRelation: "dre_linhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realizado_lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realizado_lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_ia_contexto_empresa"
            referencedColumns: ["empresa_id"]
          },
          {
            foreignKeyName: "realizado_lancamentos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "realizado_lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      realizado_lotes: {
        Row: {
          arquivo_nome: string | null
          arquivo_path: string | null
          created_at: string
          empresa_id: string
          erro_msg: string | null
          id: string
          importado_em: string
          importado_por: string | null
          observacoes: string | null
          origem: Database["public"]["Enums"]["lote_origem"]
          processado_em: string | null
          referencia_ano: number
          referencia_mes: number
          status: Database["public"]["Enums"]["lote_status"]
          total_lancamentos: number
          total_valor: number
          updated_at: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_path?: string | null
          created_at?: string
          empresa_id: string
          erro_msg?: string | null
          id?: string
          importado_em?: string
          importado_por?: string | null
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["lote_origem"]
          processado_em?: string | null
          referencia_ano: number
          referencia_mes: number
          status?: Database["public"]["Enums"]["lote_status"]
          total_lancamentos?: number
          total_valor?: number
          updated_at?: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_path?: string | null
          created_at?: string
          empresa_id?: string
          erro_msg?: string | null
          id?: string
          importado_em?: string
          importado_por?: string | null
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["lote_origem"]
          processado_em?: string | null
          referencia_ano?: number
          referencia_mes?: number
          status?: Database["public"]["Enums"]["lote_status"]
          total_lancamentos?: number
          total_valor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "realizado_lotes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realizado_lotes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_ia_contexto_empresa"
            referencedColumns: ["empresa_id"]
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
      solicitacao_desbloqueio: {
        Row: {
          comentario_decisor: string | null
          created_at: string
          decidido_em: string | null
          decidido_por: string | null
          empresa_id: string
          id: string
          linha_id: string
          motivo: string
          novo_valor: number | null
          solicitado_por: string
          status: Database["public"]["Enums"]["desbloqueio_status"]
          updated_at: string
        }
        Insert: {
          comentario_decisor?: string | null
          created_at?: string
          decidido_em?: string | null
          decidido_por?: string | null
          empresa_id: string
          id?: string
          linha_id: string
          motivo: string
          novo_valor?: number | null
          solicitado_por: string
          status?: Database["public"]["Enums"]["desbloqueio_status"]
          updated_at?: string
        }
        Update: {
          comentario_decisor?: string | null
          created_at?: string
          decidido_em?: string | null
          decidido_por?: string | null
          empresa_id?: string
          id?: string
          linha_id?: string
          motivo?: string
          novo_valor?: number | null
          solicitado_por?: string
          status?: Database["public"]["Enums"]["desbloqueio_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacao_desbloqueio_linha_id_fkey"
            columns: ["linha_id"]
            isOneToOne: false
            referencedRelation: "orcamento_contrato_linha"
            referencedColumns: ["id"]
          },
        ]
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
      v_dre_comparativo: {
        Row: {
          ano: number | null
          centro_custo_id: string | null
          dre_linha_id: string | null
          empresa_id: string | null
          mes: number | null
          valor_orcado: number | null
          valor_realizado: number | null
          variacao_abs: number | null
          variacao_pct: number | null
        }
        Relationships: []
      }
      v_fluxo_caixa_mensal: {
        Row: {
          ano: number | null
          empresa_id: string | null
          entradas: number | null
          mes: number | null
          saidas: number | null
          saldo: number | null
        }
        Relationships: [
          {
            foreignKeyName: "realizado_lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realizado_lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_ia_contexto_empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      v_ia_contexto_empresa: {
        Row: {
          ano_referencia: number | null
          codigo: string | null
          empresa_id: string | null
          entradas_ytd: number | null
          orcado_ytd: number | null
          razao_social: string | null
          realizado_ytd: number | null
          saidas_ytd: number | null
          saldo_ytd: number | null
          variacao_abs_ytd: number | null
        }
        Relationships: []
      }
      v_obz_mensal: {
        Row: {
          ano: number | null
          centro_custo_id: string | null
          dre_linha_id: string | null
          empresa_id: string | null
          mes: number | null
          revisao: number | null
          valor_orcado: number | null
          versao: number | null
          versao_status: Database["public"]["Enums"]["obz_status"] | null
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
            foreignKeyName: "obz_versoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obz_versoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_ia_contexto_empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      v_realizado_mensal: {
        Row: {
          ano: number | null
          centro_custo_id: string | null
          dre_linha_id: string | null
          empresa_id: string | null
          mes: number | null
          qtd_lancamentos: number | null
          valor_realizado: number | null
        }
        Relationships: [
          {
            foreignKeyName: "realizado_lancamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realizado_lancamentos_dre_linha_id_fkey"
            columns: ["dre_linha_id"]
            isOneToOne: false
            referencedRelation: "dre_linhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realizado_lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realizado_lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "v_ia_contexto_empresa"
            referencedColumns: ["empresa_id"]
          },
        ]
      }
      vw_dre_contrato: {
        Row: {
          ciclo_id: string | null
          competencia: string | null
          contrato_id: string | null
          dre_codigo: string | null
          dre_descricao: string | null
          dre_linha_id: string | null
          dre_natureza: Database["public"]["Enums"]["dre_natureza"] | null
          empresa_id: string | null
          orcamento_contrato_id: string | null
          valor_previsto: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_contrato_ciclo_id_fkey"
            columns: ["ciclo_id"]
            isOneToOne: false
            referencedRelation: "orcamento_ciclo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_contrato_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contrato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_contrato_linha_dre_linha_id_fkey"
            columns: ["dre_linha_id"]
            isOneToOne: false
            referencedRelation: "dre_linhas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      aplicar_plano_mestre: { Args: { _empresa_id: string }; Returns: number }
      gerar_orcamento_contrato: {
        Args: { _ciclo_id: string; _contrato_id: string }
        Returns: Json
      }
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
      storage_path_empresa: { Args: { _name: string }; Returns: string }
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
      aprov_decisao: "pendente" | "aprovado" | "rejeitado" | "devolvido"
      banco_tipo: "corrente" | "poupanca" | "aplicacao" | "vinculada"
      cc_tipo: "adm" | "operacional"
      comprovacao_tipo:
        | "empenho"
        | "ordem_servico"
        | "aditivo"
        | "apostilamento"
        | "nota_fiscal"
        | "contrato_assinado"
        | "publicacao_doe"
        | "outro"
      conta_exige_contrato: "sim" | "nao" | "opcional"
      conta_grupo_dre: "balanco" | "balanco_gerencial" | "dre"
      conta_natureza: "D" | "C"
      conta_tipo: "sintetica" | "analitica"
      contrato_status: "implantacao" | "ativo" | "suspenso" | "encerrado"
      cronograma_status:
        | "previsto"
        | "emitido"
        | "recebido"
        | "atrasado"
        | "cancelado"
      desbloqueio_status: "pendente" | "aprovado" | "rejeitado"
      dissidio_base_calculo: "salario_base" | "total_remuneracao" | "posto"
      dissidio_criterio:
        | "indice"
        | "percentual_fixo"
        | "cct"
        | "acordo_coletivo"
        | "judicial"
      dre_natureza:
        | "receita"
        | "deducao"
        | "custo"
        | "despesa"
        | "resultado"
        | "tributo"
        | "financeiro"
      fluxo_tipo: "entrada" | "saida"
      ia_status: "pendente" | "processando" | "concluida" | "erro" | "cancelada"
      licitacao_status:
        | "rascunho"
        | "oportunidade"
        | "em_andamento"
        | "vencida"
        | "perdida"
        | "cancelada"
      lote_origem: "manual" | "erp" | "extrato_bancario" | "planilha" | "api"
      lote_status: "pendente" | "processado" | "erro" | "cancelado"
      obz_status: "rascunho" | "em_aprovacao" | "aprovada" | "arquivada"
      orcamento_ciclo_status:
        | "aberto"
        | "em_aprovacao"
        | "aprovado"
        | "encerrado"
      orcamento_contrato_status:
        | "rascunho"
        | "em_aprovacao"
        | "aprovado"
        | "rejeitado"
        | "encerrado"
      orcamento_linha_source:
        | "licitacao"
        | "obz"
        | "manual"
        | "recorrente"
        | "dissidio"
        | "calculado"
      periodo_status: "aberto" | "fechado"
      posto_jornada:
        | "12x36"
        | "8h"
        | "6h"
        | "4h"
        | "escala_5x2"
        | "escala_6x1"
        | "outra"
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
      aprov_decisao: ["pendente", "aprovado", "rejeitado", "devolvido"],
      banco_tipo: ["corrente", "poupanca", "aplicacao", "vinculada"],
      cc_tipo: ["adm", "operacional"],
      comprovacao_tipo: [
        "empenho",
        "ordem_servico",
        "aditivo",
        "apostilamento",
        "nota_fiscal",
        "contrato_assinado",
        "publicacao_doe",
        "outro",
      ],
      conta_exige_contrato: ["sim", "nao", "opcional"],
      conta_grupo_dre: ["balanco", "balanco_gerencial", "dre"],
      conta_natureza: ["D", "C"],
      conta_tipo: ["sintetica", "analitica"],
      contrato_status: ["implantacao", "ativo", "suspenso", "encerrado"],
      cronograma_status: [
        "previsto",
        "emitido",
        "recebido",
        "atrasado",
        "cancelado",
      ],
      desbloqueio_status: ["pendente", "aprovado", "rejeitado"],
      dissidio_base_calculo: ["salario_base", "total_remuneracao", "posto"],
      dissidio_criterio: [
        "indice",
        "percentual_fixo",
        "cct",
        "acordo_coletivo",
        "judicial",
      ],
      dre_natureza: [
        "receita",
        "deducao",
        "custo",
        "despesa",
        "resultado",
        "tributo",
        "financeiro",
      ],
      fluxo_tipo: ["entrada", "saida"],
      ia_status: ["pendente", "processando", "concluida", "erro", "cancelada"],
      licitacao_status: [
        "rascunho",
        "oportunidade",
        "em_andamento",
        "vencida",
        "perdida",
        "cancelada",
      ],
      lote_origem: ["manual", "erp", "extrato_bancario", "planilha", "api"],
      lote_status: ["pendente", "processado", "erro", "cancelado"],
      obz_status: ["rascunho", "em_aprovacao", "aprovada", "arquivada"],
      orcamento_ciclo_status: [
        "aberto",
        "em_aprovacao",
        "aprovado",
        "encerrado",
      ],
      orcamento_contrato_status: [
        "rascunho",
        "em_aprovacao",
        "aprovado",
        "rejeitado",
        "encerrado",
      ],
      orcamento_linha_source: [
        "licitacao",
        "obz",
        "manual",
        "recorrente",
        "dissidio",
        "calculado",
      ],
      periodo_status: ["aberto", "fechado"],
      posto_jornada: [
        "12x36",
        "8h",
        "6h",
        "4h",
        "escala_5x2",
        "escala_6x1",
        "outra",
      ],
      regime_tributario: ["lucro_real", "lucro_presumido", "simples_nacional"],
    },
  },
} as const
