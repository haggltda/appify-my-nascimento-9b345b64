alter table planilha_posto_localizacao
  add column if not exists lat double precision,
  add column if not exists lng double precision;
