-- Suporte às automações do worker externo (whatsapp-web.js + Nodemailer):
-- lembrete de WhatsApp 10min antes da reunião, e e-mail do PDF final da ata
-- assim que a reunião é encerrada. Colunas de controle evitam reenvio
-- duplicado a cada ciclo do polling do worker.

ALTER TABLE public.reuniao
  ADD COLUMN IF NOT EXISTS lembrete_10min_enviado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pdf_final_storage_path text,
  ADD COLUMN IF NOT EXISTS email_ata_enviado boolean NOT NULL DEFAULT false;
