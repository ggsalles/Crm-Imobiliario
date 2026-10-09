-- Ajuste rápido de tipo para Chat e Atividades
ALTER TABLE public.conversations ALTER COLUMN unread_count TYPE JSONB USING '{}'::jsonb;
ALTER TABLE public.conversations ALTER COLUMN unread_count SET DEFAULT '{}'::jsonb;

ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_status_check;
ALTER TABLE public.activities ADD CONSTRAINT activities_status_check 
  CHECK (status IN ('pendente', 'concluida', 'cancelada', 'completed', 'pending', 'cancelled'));

NOTIFY pgrst, 'reload schema';
