-- Atas de Reunião: alinhamento com o protótipo Figma aprovado pelo cliente —
-- a pauta vira uma tabela onde cada tópico tem seu próprio responsável,
-- prazo e status (não é mais só um texto por reunião inteira), editável
-- durante toda a reunião (não só na etapa "agendada" como antes — o
-- protótipo mostra "+ Nova Pauta" habilitado com a reunião "Em andamento").

ALTER TABLE public.reuniao_pauta
  ADD COLUMN IF NOT EXISTS responsavel_user_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS prazo date,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'nao_iniciada' CHECK (status IN (
    'nao_iniciada', 'pendente', 'em_andamento', 'concluida'
  ));

CREATE INDEX IF NOT EXISTS idx_reuniao_pauta_responsavel ON public.reuniao_pauta(responsavel_user_id);

-- Pauta: gerenciável (criar/editar/excluir tópico, e também status/prazo/
-- responsável) por quem organiza a reunião OU pela pessoa atribuída como
-- responsável daquele tópico especificamente — enquanto a reunião não
-- estiver concluída/cancelada.
DROP POLICY IF EXISTS reuniao_pauta_insert ON public.reuniao_pauta;
CREATE POLICY reuniao_pauta_insert ON public.reuniao_pauta
  FOR INSERT TO authenticated
  WITH CHECK (
    public.tem_acesso_menu('central_servicos_reunioes')
    AND EXISTS (
      SELECT 1 FROM public.reuniao r
       WHERE r.id = reuniao_id AND r.etapa IN ('agendada', 'em_andamento')
         AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id)
    )
  );

DROP POLICY IF EXISTS reuniao_pauta_update ON public.reuniao_pauta;
CREATE POLICY reuniao_pauta_update ON public.reuniao_pauta
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reuniao r
       WHERE r.id = reuniao_id AND r.etapa IN ('agendada', 'em_andamento')
         AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id, reuniao_pauta.responsavel_user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reuniao r
       WHERE r.id = reuniao_id AND r.etapa IN ('agendada', 'em_andamento')
         AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id, reuniao_pauta.responsavel_user_id)
    )
  );

DROP POLICY IF EXISTS reuniao_pauta_delete ON public.reuniao_pauta;
CREATE POLICY reuniao_pauta_delete ON public.reuniao_pauta
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reuniao r
       WHERE r.id = reuniao_id AND r.etapa IN ('agendada', 'em_andamento')
         AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id)
    )
  );

-- Resposta/Decisão do tópico: mesma regra — organizador ou responsável do
-- tópico, enquanto a reunião estiver "em_andamento" (a etapa
-- "aguardando_ata" deixou de existir, ver migration seguinte).
DROP POLICY IF EXISTS reuniao_resposta_insert ON public.reuniao_resposta;
CREATE POLICY reuniao_resposta_insert ON public.reuniao_resposta
  FOR INSERT TO authenticated
  WITH CHECK (
    public.tem_acesso_menu('central_servicos_reunioes')
    AND EXISTS (
      SELECT 1 FROM public.reuniao_pauta p JOIN public.reuniao r ON r.id = p.reuniao_id
       WHERE p.id = pauta_id AND r.etapa = 'em_andamento'
         AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id, p.responsavel_user_id)
    )
  );

DROP POLICY IF EXISTS reuniao_resposta_update ON public.reuniao_resposta;
CREATE POLICY reuniao_resposta_update ON public.reuniao_resposta
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reuniao_pauta p JOIN public.reuniao r ON r.id = p.reuniao_id
       WHERE p.id = pauta_id AND r.etapa = 'em_andamento'
         AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id, p.responsavel_user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reuniao_pauta p JOIN public.reuniao r ON r.id = p.reuniao_id
       WHERE p.id = pauta_id AND r.etapa = 'em_andamento'
         AND auth.uid() IN (r.criado_por, r.responsavel_preenchimento_user_id, p.responsavel_user_id)
    )
  );
