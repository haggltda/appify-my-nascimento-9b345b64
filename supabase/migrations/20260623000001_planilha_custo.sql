-- Planilha de Custo: equivalente web do "Banco de Dados" do Excel
CREATE TABLE IF NOT EXISTS public.planilha_custo (
  id                          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id                  uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

  -- Identificação (colunas A-J do Excel)
  orexec                      text,          -- EXECUTADO | ORÇADO
  cliente                     text NOT NULL,
  contrato                    text NOT NULL,
  posto                       text NOT NULL,
  servico                     text,
  sindicato                   text,
  data_vigencia               date,
  qt_postos                   numeric DEFAULT 0,
  arquivo_origem              text,

  -- Remuneração (K-R)
  salario                     numeric DEFAULT 0,
  insalubridade               numeric DEFAULT 0,
  periculosidade              numeric DEFAULT 0,
  lideranca                   numeric DEFAULT 0,
  adicional_noturno_reduzido  numeric DEFAULT 0,
  adicional_noturno           numeric DEFAULT 0,
  adicional_extra             numeric DEFAULT 0,
  dsr                         numeric DEFAULT 0,

  -- Encargos (S-AD)
  decimo_terceiro             numeric DEFAULT 0,
  adicional_ferias            numeric DEFAULT 0,
  incidencia_enc_41           numeric DEFAULT 0,
  inss                        numeric DEFAULT 0,
  salario_educacao            numeric DEFAULT 0,
  rat_fap                     numeric DEFAULT 0,
  sesi                        numeric DEFAULT 0,
  senai                       numeric DEFAULT 0,
  sebrae                      numeric DEFAULT 0,
  incra                       numeric DEFAULT 0,
  fgts                        numeric DEFAULT 0,
  seguro_acidente_trabalho    numeric DEFAULT 0,

  -- Benefícios (AE-BD)
  transporte                  numeric DEFAULT 0,
  aux_alimentacao             numeric DEFAULT 0,
  aux_alimentacao_desconto    numeric DEFAULT 0,
  aux_refeicao                numeric DEFAULT 0,
  beneficio_familiar          numeric DEFAULT 0,
  aux_lanche                  numeric DEFAULT 0,
  seguro_vida                 numeric DEFAULT 0,
  abono_indenizatorio         numeric DEFAULT 0,
  aux_educacao                numeric DEFAULT 0,
  cesta_basica                numeric DEFAULT 0,
  assistencia_medica          numeric DEFAULT 0,
  hospedagem                  numeric DEFAULT 0,
  odontologico                numeric DEFAULT 0,
  manutencao_profissional     numeric DEFAULT 0,
  cafe                        numeric DEFAULT 0,
  almoco                      numeric DEFAULT 0,
  janta                       numeric DEFAULT 0,
  ceia                        numeric DEFAULT 0,
  funeral                     numeric DEFAULT 0,
  assiduidade                 numeric DEFAULT 0,
  beneficio_trabalhador       numeric DEFAULT 0,
  patronal                    numeric DEFAULT 0,
  fundo_assistencial          numeric DEFAULT 0,
  fundo_profissional          numeric DEFAULT 0,
  natalidade                  numeric DEFAULT 0,
  deducoes                    numeric DEFAULT 0,

  -- Rescisão / Provisão (BE-BK)
  aviso_indenizado            numeric DEFAULT 0,
  incidencia_fgts             numeric DEFAULT 0,
  multa_rescisoria            numeric DEFAULT 0,
  aviso_trabalhado            numeric DEFAULT 0,
  incidencia_aviso_trabalhado numeric DEFAULT 0,
  multa_aviso_indenizado      numeric DEFAULT 0,
  contratualidade             numeric DEFAULT 0,

  -- Reposição de Profissional Ausente (BL-BW)
  sub_ferias                  numeric DEFAULT 0,
  sub_ausencias_legais        numeric DEFAULT 0,
  sub_paternidade             numeric DEFAULT 0,
  sub_acidente_trabalho       numeric DEFAULT 0,
  sub_maternidade             numeric DEFAULT 0,
  sub_doenca                  numeric DEFAULT 0,
  sub_repouso                 numeric DEFAULT 0,
  incidencia_maternidade      numeric DEFAULT 0,
  incidencia_enc_reposicao    numeric DEFAULT 0,
  incidencia_enc_reposicao_2  numeric DEFAULT 0,
  incidencia_enc_reposicao_3  numeric DEFAULT 0,
  incidencia_enc_reposicao_4  numeric DEFAULT 0,

  -- Insumos Diversos (BX-CE)
  uniforme                    numeric DEFAULT 0,
  epi                         numeric DEFAULT 0,
  epc                         numeric DEFAULT 0,
  materiais                   numeric DEFAULT 0,
  equipamentos                numeric DEFAULT 0,
  relogio_digital             numeric DEFAULT 0,
  ponto_eletronico            numeric DEFAULT 0,
  outros_insumos              numeric DEFAULT 0,

  -- Custos Indiretos / Lucro / Tributos (CF-CM)
  custos_indiretos            numeric DEFAULT 0,
  lucro                       numeric DEFAULT 0,
  cofins                      numeric DEFAULT 0,
  pis                         numeric DEFAULT 0,
  irpj_csll                   numeric DEFAULT 0,
  iss                         numeric DEFAULT 0,

  -- Extras livres (CU-CZ)
  outros_1                    numeric DEFAULT 0,
  outros_1_descricao          text,
  outros_2                    numeric DEFAULT 0,
  outros_2_descricao          text,
  outros_3                    numeric DEFAULT 0,
  outros_3_descricao          text,

  -- Total por empregado (informado ou calculado)
  total_por_empregado         numeric DEFAULT 0,

  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.planilha_custo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresa_isolation" ON public.planilha_custo
  USING (empresa_id IN (
    SELECT empresa_id FROM public.user_empresa WHERE user_id = auth.uid()
  ));
