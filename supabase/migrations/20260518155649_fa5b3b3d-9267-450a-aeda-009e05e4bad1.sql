-- Limpar batch de teste com 1499 linhas (parcial) e marcar demais travados como erro
DELETE FROM fcr_raw_excel WHERE batch_id = 'e28ed0b0-abec-4920-b2e6-f31f958840b3';
DELETE FROM fcr_parse_chunk_erro WHERE batch_id = 'e28ed0b0-abec-4920-b2e6-f31f958840b3';
DELETE FROM fcr_batch WHERE id = 'e28ed0b0-abec-4920-b2e6-f31f958840b3';

UPDATE fcr_batch
SET status = 'erro',
    ultimo_erro = COALESCE(ultimo_erro, 'Parse Excel travado (CPU Time exceeded) — marcado como erro pelo usuário. Substituir por carga CSV única do período 07–14/05/2026.'),
    parse_finalizado_em = COALESCE(parse_finalizado_em, now()),
    updated_at = now()
WHERE id IN (
  '896b565c-aca2-4249-a211-6dea55c1e7f9',
  'a2f6db24-6742-4c1e-b4fc-b26712c683af',
  '581ed042-53db-4bbb-8e4c-e3989431f625',
  '27311eff-19b1-45e1-bbbc-71f395bc55fc',
  '13c7526e-ef89-4c9a-8db4-62a17473feab'
)
AND status = 'parseando';