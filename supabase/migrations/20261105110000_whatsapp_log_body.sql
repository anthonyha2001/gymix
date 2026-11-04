-- Keep the text of each automatic WhatsApp message, shown in the staff chat.
alter table public.whatsapp_log add column body text;
