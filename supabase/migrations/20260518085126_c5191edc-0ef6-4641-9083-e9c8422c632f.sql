UPDATE public.fcr_batch
SET status='erro',
    ultimo_erro='OOM no parse server-side — descartado; será substituído por carga em 3 partes',
    parse_finalizado_em=now()
WHERE id='3276f3fe-5c5c-4975-a8cb-04df4757972d';