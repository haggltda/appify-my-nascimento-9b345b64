-- Migration: adiciona roles rh, sistemas, treinamentos
-- Novos valores no ENUM app_role + metadados dos cards no modal de usuários

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'rh';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'sistemas';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'treinamentos';

INSERT INTO perfil_metadata (role, nome, descricao)
VALUES
  ('rh',            'RH',            'Recursos Humanos'),
  ('sistemas',      'Sistemas',      'TI e Sistemas'),
  ('treinamentos',  'Treinamentos',  'Gestão de Treinamentos')
ON CONFLICT (role) DO NOTHING;
