-- Central de Serviços: tela "Atas de Reunião" — agendamento de reunião com
-- pauta obrigatória, gera PDF de convocação; depois da reunião o responsável
-- preenche as respostas de cada tópico e gera o PDF final da ata. Mesmo
-- modelo de permissão por usuário do resto do ERP (tem_acesso_menu, sem
-- bypass de role) — ver 20260619000001_modulo_sistemas_solicitacoes_erp.sql
-- pro padrão original.

-- 1) Menus sob o módulo "central_servicos" (já existe, ver
--    20260625000003_modulo_central_servicos.sql) ----------------------------
INSERT INTO public.app_menu (modulo_id, codigo, nome, rota, ordem)
SELECT m.id, x.codigo, x.nome, x.rota, x.ordem
  FROM (VALUES
    ('central_servicos_reunioes', 'Atas de Reunião', '/app/central-servicos/reunioes', 20),
    ('central_servicos_criar_reuniao', 'Agendar Reunião', NULL, 30)
  ) AS x(codigo, nome, rota, ordem)
  JOIN public.app_modulo m ON m.codigo = 'central_servicos'
ON CONFLICT (modulo_id, codigo) DO NOTHING;

-- 2) Tabela principal ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reuniao (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo                          text NOT NULL,
  objetivo                        text,
  data_hora                       timestamptz NOT NULL,
  tipo_local                      text NOT NULL CHECK (tipo_local IN ('presencial', 'online')),
  local_ou_link                   text NOT NULL,
  etapa                           text NOT NULL DEFAULT 'agendada' CHECK (etapa IN (
                                    'agendada', 'aguardando_ata', 'aguardando_assinaturas', 'concluida', 'cancelada'
                                  )),
  criado_por                      uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  responsavel_preenchimento_user_id uuid NOT NULL REFERENCES public.profiles(id),
  motivo_cancelamento             text,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reuniao_etapa ON public.reuniao(etapa);
CREATE INDEX IF NOT EXISTS idx_reuniao_data_hora ON public.reuniao(data_hora);

DROP TRIGGER IF EXISTS trg_reuniao_updated ON public.reuniao;
CREATE TRIGGER trg_reuniao_updated
  BEFORE UPDATE ON public.reuniao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) RLS ------------------------------------------------------------------
ALTER TABLE public.reuniao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reuniao_select ON public.reuniao;
CREATE POLICY reuniao_select ON public.reuniao
  FOR SELECT TO authenticated
  USING (public.tem_acesso_menu('central_servicos_reunioes'));

DROP POLICY IF EXISTS reuniao_insert ON public.reuniao;
CREATE POLICY reuniao_insert ON public.reuniao
  FOR INSERT TO authenticated
  WITH CHECK (
    public.tem_acesso_menu('central_servicos_reunioes')
    AND public.tem_acesso_menu('central_servicos_criar_reuniao')
    AND etapa = 'agendada'
  );

DROP POLICY IF EXISTS reuniao_update ON public.reuniao;
CREATE POLICY reuniao_update ON public.reuniao
  FOR UPDATE TO authenticated
  USING (public.tem_acesso_menu('central_servicos_reunioes'))
  WITH CHECK (public.tem_acesso_menu('central_servicos_reunioes'));

-- 4) Trigger de transição de etapa -------------------------------------------
-- Fluxo linear agendada → aguardando_ata → aguardando_assinaturas → concluida,
-- com "cancelada" como saída de exceção a partir de qualquer etapa que não
-- seja concluida/cancelada. Só o criador ou o responsável pelo preenchimento
-- podem mudar a etapa — sem matriz de permissão por transição (diferente de
-- sistema_solicitacao) porque aqui não há papéis diferentes por etapa.
CREATE OR REPLACE FUNCTION public.checar_transicao_reuniao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.etapa = OLD.etapa THEN
    RETURN NEW;
  END IF;

  IF auth.uid() NOT IN (OLD.criado_por, OLD.responsavel_preenchimento_user_id) THEN
    RAISE EXCEPTION 'Só o criador ou o responsável pelo preenchimento podem mudar a etapa da reunião.';
  END IF;

  IF NEW.etapa = 'cancelada' THEN
    IF OLD.etapa IN ('concluida', 'cancelada') THEN
      RAISE EXCEPTION 'Não é possível cancelar uma reunião % .', OLD.etapa;
    END IF;
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.etapa = 'agendada' AND NEW.etapa = 'aguardando_ata')
    OR (OLD.etapa = 'aguardando_ata' AND NEW.etapa = 'aguardando_assinaturas')
    OR (OLD.etapa = 'aguardando_assinaturas' AND NEW.etapa = 'concluida')
  ) THEN
    RAISE EXCEPTION 'Transição de etapa não permitida: % → %', OLD.etapa, NEW.etapa;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checar_transicao_reuniao ON public.reuniao;
CREATE TRIGGER trg_checar_transicao_reuniao
  BEFORE UPDATE ON public.reuniao
  FOR EACH ROW EXECUTE FUNCTION public.checar_transicao_reuniao();
