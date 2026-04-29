ALTER TABLE public.request_files
  ADD COLUMN IF NOT EXISTS encryption_algorithm TEXT,
  ADD COLUMN IF NOT EXISTS encryption_key_id TEXT,
  ADD COLUMN IF NOT EXISTS encryption_iv TEXT,
  ADD COLUMN IF NOT EXISTS encrypted_key TEXT,
  ADD COLUMN IF NOT EXISTS encrypted_size_bytes BIGINT;
