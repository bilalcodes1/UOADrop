-- ================================================================
-- UOADrop — Supabase Schema (Phase 2 Online)
-- شغّل هذا في: Supabase Dashboard → SQL Editor → New Query
-- ================================================================

-- ── print_requests ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS print_requests (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket           TEXT        NOT NULL UNIQUE,
  student_name     TEXT,
  student_email    TEXT,
  pickup_pin_hash  TEXT,
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','printing','ready','done','canceled','blocked')),
  price_iqd        INTEGER     DEFAULT 0,
  source           TEXT        NOT NULL DEFAULT 'online'
                               CHECK (source IN ('local','online')),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  printed_at       TIMESTAMPTZ,
  picked_up_at     TIMESTAMPTZ
);

-- ── request_files ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS request_files (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       UUID        NOT NULL REFERENCES print_requests(id) ON DELETE CASCADE,
  filename         TEXT        NOT NULL,
  mime_type        TEXT,
  size_bytes       BIGINT      DEFAULT 0,
  storage_path     TEXT        NOT NULL,
  copies           INTEGER     DEFAULT 1,
  color            BOOLEAN     DEFAULT false,
  double_sided     BOOLEAN     DEFAULT false,
  pages_per_sheet  INTEGER     DEFAULT 1,
  page_range       TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ── updated_at trigger ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_requests_updated_at
  BEFORE UPDATE ON print_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────
ALTER TABLE print_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_files  ENABLE ROW LEVEL SECURITY;

-- حذف الـ policies إن وجدت (لتجنب خطأ عند إعادة التشغيل)
DROP POLICY IF EXISTS "anon insert requests"    ON print_requests;
DROP POLICY IF EXISTS "anon select own request" ON print_requests;
DROP POLICY IF EXISTS "anon insert files"       ON request_files;
DROP POLICY IF EXISTS "anon select files"       ON request_files;

-- الطالب يقدر يضيف طلب
CREATE POLICY "anon insert requests"
  ON print_requests FOR INSERT TO anon
  WITH CHECK (source = 'online');

-- الطالب يقدر يقرأ طلبه بالـ ticket فقط (للـ tracking لاحقاً)
CREATE POLICY "anon select own request"
  ON print_requests FOR SELECT TO anon
  USING (true);

-- الطالب يقدر يضيف ملفات
CREATE POLICY "anon insert files"
  ON request_files FOR INSERT TO anon
  WITH CHECK (true);

-- الطالب يقدر يقرأ ملفاته
CREATE POLICY "anon select files"
  ON request_files FOR SELECT TO anon
  USING (true);

-- ── Storage Bucket ───────────────────────────────────────────────
-- شغّل هذا بشكل منفصل في SQL Editor:

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'print-files',
  'print-files',
  false,
  52428800,  -- 50 MB
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- السماح للـ anon بالرفع إلى bucket
CREATE POLICY "anon upload print-files"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'print-files');

-- السماح بقراءة الملفات (للدشبورد والتحميل)
CREATE POLICY "anon read print-files"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'print-files');

-- ── Realtime ─────────────────────────────────────────────────────
-- فعّل Realtime على الجدولين من:
-- Supabase Dashboard → Database → Replication → print_requests ✓ + request_files ✓

-- ── Indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_requests_ticket   ON print_requests (ticket);
CREATE INDEX IF NOT EXISTS idx_requests_status   ON print_requests (status);
CREATE INDEX IF NOT EXISTS idx_requests_created  ON print_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_request_id  ON request_files  (request_id);
