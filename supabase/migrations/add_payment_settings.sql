CREATE TABLE IF NOT EXISTS public.payment_settings (
  key TEXT PRIMARY KEY CHECK (key IN ('qicard', 'zaincash')),
  account_number TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon read payment settings" ON public.payment_settings;
CREATE POLICY "anon read payment settings"
  ON public.payment_settings FOR SELECT TO anon
  USING (true);

INSERT INTO public.payment_settings(key, account_number)
VALUES ('qicard', ''), ('zaincash', '')
ON CONFLICT (key) DO NOTHING;
