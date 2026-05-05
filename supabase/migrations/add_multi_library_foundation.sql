-- ================================================================
-- UOADrop — Multi-library foundation
-- Adds libraries, desktop device ownership, activation codes, and
-- library scoping for online requests, files, and payment settings.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.libraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.libraries(slug, name, status)
VALUES ('main-library', 'UOADrop Main Library', 'active')
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    status = EXCLUDED.status,
    updated_at = NOW();

CREATE OR REPLACE FUNCTION public.uoadrop_default_library_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM public.libraries WHERE slug = 'main-library' LIMIT 1
$$;

CREATE TABLE IF NOT EXISTS public.desktop_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL UNIQUE,
  library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE RESTRICT,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.library_activation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  label TEXT,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  used_by_device_id TEXT,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.print_requests ADD COLUMN IF NOT EXISTS library_id UUID;
UPDATE public.print_requests
SET library_id = public.uoadrop_default_library_id()
WHERE library_id IS NULL;
ALTER TABLE public.print_requests ALTER COLUMN library_id SET DEFAULT public.uoadrop_default_library_id();
ALTER TABLE public.print_requests ALTER COLUMN library_id SET NOT NULL;
ALTER TABLE public.print_requests DROP CONSTRAINT IF EXISTS print_requests_library_id_fkey;
ALTER TABLE public.print_requests
  ADD CONSTRAINT print_requests_library_id_fkey
  FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE RESTRICT;

ALTER TABLE public.request_files ADD COLUMN IF NOT EXISTS library_id UUID;
UPDATE public.request_files rf
SET library_id = pr.library_id
FROM public.print_requests pr
WHERE rf.request_id = pr.id
  AND rf.library_id IS NULL;
ALTER TABLE public.request_files DROP CONSTRAINT IF EXISTS request_files_library_id_fkey;
ALTER TABLE public.request_files
  ADD CONSTRAINT request_files_library_id_fkey
  FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.set_request_file_library_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT library_id INTO NEW.library_id
  FROM public.print_requests
  WHERE id = NEW.request_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_request_files_library_id ON public.request_files;
CREATE TRIGGER trg_request_files_library_id
  BEFORE INSERT OR UPDATE OF request_id, library_id ON public.request_files
  FOR EACH ROW EXECUTE FUNCTION public.set_request_file_library_id();

UPDATE public.request_files rf
SET library_id = pr.library_id
FROM public.print_requests pr
WHERE rf.request_id = pr.id
  AND rf.library_id IS NULL;
ALTER TABLE public.request_files ALTER COLUMN library_id SET NOT NULL;

ALTER TABLE public.payment_settings ADD COLUMN IF NOT EXISTS library_id UUID;
UPDATE public.payment_settings
SET library_id = public.uoadrop_default_library_id()
WHERE library_id IS NULL;
ALTER TABLE public.payment_settings ALTER COLUMN library_id SET DEFAULT public.uoadrop_default_library_id();
ALTER TABLE public.payment_settings ALTER COLUMN library_id SET NOT NULL;
ALTER TABLE public.payment_settings DROP CONSTRAINT IF EXISTS payment_settings_library_id_fkey;
ALTER TABLE public.payment_settings
  ADD CONSTRAINT payment_settings_library_id_fkey
  FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;
ALTER TABLE public.payment_settings DROP CONSTRAINT IF EXISTS payment_settings_pkey;
ALTER TABLE public.payment_settings
  ADD CONSTRAINT payment_settings_pkey PRIMARY KEY (library_id, key);

INSERT INTO public.payment_settings(library_id, key, account_number)
SELECT public.uoadrop_default_library_id(), method, ''
FROM (VALUES ('qicard'), ('zaincash')) AS methods(method)
ON CONFLICT (library_id, key) DO NOTHING;

ALTER TABLE public.libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_activation_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon read active libraries" ON public.libraries;
CREATE POLICY "anon read active libraries"
  ON public.libraries FOR SELECT TO anon
  USING (status = 'active');

DROP POLICY IF EXISTS "anon read payment settings" ON public.payment_settings;
CREATE POLICY "anon read payment settings"
  ON public.payment_settings FOR SELECT TO anon
  USING (
    library_id IN (
      SELECT id FROM public.libraries WHERE status = 'active'
    )
  );

CREATE INDEX IF NOT EXISTS idx_libraries_slug ON public.libraries(slug);
CREATE INDEX IF NOT EXISTS idx_desktop_devices_device_id ON public.desktop_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_desktop_devices_library_id ON public.desktop_devices(library_id);
CREATE INDEX IF NOT EXISTS idx_activation_codes_code_hash ON public.library_activation_codes(code_hash);
CREATE INDEX IF NOT EXISTS idx_requests_library_status_created ON public.print_requests(library_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_library_request ON public.request_files(library_id, request_id);
CREATE INDEX IF NOT EXISTS idx_payment_settings_library ON public.payment_settings(library_id);
