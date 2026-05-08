
CREATE OR REPLACE FUNCTION public.promover_contas_aprovadas(_empresa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _promovidas int := 0;
  _ja_existentes int := 0;
  _sem_pai int := 0;
  _proxima_reduzida int;
  r record;
  _parent_id uuid;
  _dre_id uuid;
  _tipo conta_tipo;
  _nat conta_natureza;
  _grupo conta_grupo_dre;
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF NOT (
    public.has_role(_user, 'admin') OR
    public.has_role(_user, 'controladoria') OR
    public.has_role(_user, 'diretor_adm')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para promover contas';
  END IF;

  SELECT COALESCE(MAX(conta_reduzida), 0) + 1 INTO _proxima_reduzida
  FROM public.conta_contabil WHERE empresa_id = _empresa_id;

  FOR r IN
    SELECT a.id_sugestao_conta,
           a.codigo_conta_sugerido,
           a.nome_conta_sugerido,
           a.codigo_conta_pai_sugerido,
           a.linha_dre_padrao,
           s.natureza_sugerida,
           s.tipo_conta_sugerido,
           s.entra_orcamento,
           s.impacta_caixa
    FROM public.stg_aprovacao_contas a
    LEFT JOIN public.stg_sugestoes_novas_contas s USING (id_sugestao_conta)
    WHERE a.status_aprovacao = 'APROVADA'
      AND a.codigo_conta_sugerido IS NOT NULL
      AND a.nome_conta_sugerido IS NOT NULL
    ORDER BY length(a.codigo_conta_sugerido), a.codigo_conta_sugerido
  LOOP
    -- já existe?
    IF EXISTS (
      SELECT 1 FROM public.conta_contabil
      WHERE empresa_id = _empresa_id AND classificacao = r.codigo_conta_sugerido
    ) THEN
      UPDATE public.stg_aprovacao_contas
        SET status_aprovacao = 'PROMOVIDA',
            observacao_usuario = COALESCE(observacao_usuario,'') || ' [já existia]',
            updated_at = now()
      WHERE id_sugestao_conta = r.id_sugestao_conta;
      _ja_existentes := _ja_existentes + 1;
      CONTINUE;
    END IF;

    -- pai
    _parent_id := NULL;
    IF r.codigo_conta_pai_sugerido IS NOT NULL THEN
      SELECT id INTO _parent_id FROM public.conta_contabil
      WHERE empresa_id = _empresa_id AND classificacao = r.codigo_conta_pai_sugerido
      LIMIT 1;
      IF _parent_id IS NULL THEN
        _sem_pai := _sem_pai + 1;
        CONTINUE;
      END IF;
    END IF;

    -- linha dre
    _dre_id := NULL;
    IF r.linha_dre_padrao IS NOT NULL THEN
      SELECT id INTO _dre_id FROM public.dre_linhas
      WHERE empresa_id = _empresa_id AND codigo = r.linha_dre_padrao
      LIMIT 1;
    END IF;

    _tipo := CASE WHEN COALESCE(lower(r.tipo_conta_sugerido),'') = 'sintetica' THEN 'sintetica'::conta_tipo
                  ELSE 'analitica'::conta_tipo END;
    _nat  := CASE WHEN upper(COALESCE(r.natureza_sugerida,'D')) = 'C' THEN 'C'::conta_natureza
                  ELSE 'D'::conta_natureza END;
    _grupo := CASE WHEN _dre_id IS NOT NULL THEN 'dre'::conta_grupo_dre ELSE 'balanco'::conta_grupo_dre END;

    INSERT INTO public.conta_contabil (
      empresa_id, conta_reduzida, classificacao, descricao,
      tipo, natureza, grupo_dre, parent_id, dre_linha_id,
      entra_fluxo, entra_orcamento
    ) VALUES (
      _empresa_id, _proxima_reduzida, r.codigo_conta_sugerido, r.nome_conta_sugerido,
      _tipo, _nat, _grupo, _parent_id, _dre_id,
      COALESCE(lower(r.impacta_caixa) IN ('sim','s','true','t'), false),
      COALESCE(lower(r.entra_orcamento) IN ('sim','s','true','t'), false)
    );
    _proxima_reduzida := _proxima_reduzida + 1;
    _promovidas := _promovidas + 1;

    UPDATE public.stg_aprovacao_contas
      SET status_aprovacao = 'PROMOVIDA',
          aprovado_por = _user,
          aprovado_em = now(),
          updated_at = now()
    WHERE id_sugestao_conta = r.id_sugestao_conta;
  END LOOP;

  RETURN jsonb_build_object(
    'promovidas', _promovidas,
    'ja_existentes', _ja_existentes,
    'sem_pai', _sem_pai
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.promover_contas_aprovadas(uuid) TO authenticated;
