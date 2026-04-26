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
                              CHECK (status IN ('uploading','pending','printing','ready','done','canceled','blocked')),
  total_pages      INTEGER     DEFAULT 0,
  price_iqd        INTEGER     DEFAULT 0,
  source           TEXT        NOT NULL DEFAULT 'online'
                              CHECK (source IN ('local','online')),
  desk_received_at TIMESTAMPTZ,
  source_of_truth  TEXT        NOT NULL DEFAULT 'supabase_intake'
                              CHECK (source_of_truth IN ('supabase_intake','desktop')),
  import_state     TEXT        DEFAULT 'pending'
                              CHECK (import_state IN ('pending','download_started','downloaded','imported','cleanup_pending','cleanup_done')),
  final_price_confirmed_at TIMESTAMPTZ,
  online_files_cleanup_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  printed_at       TIMESTAMPTZ,
  picked_up_at     TIMESTAMPTZ
);

-- تأكد من وجود الحقل حتى لو كان الجدول منشأ سابقاً
ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS desk_received_at TIMESTAMPTZ;
ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS total_pages INTEGER DEFAULT 0;
ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS price_iqd INTEGER DEFAULT 0;
ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS source_of_truth TEXT NOT NULL DEFAULT 'supabase_intake';
ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS import_state TEXT DEFAULT 'pending';
ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS final_price_confirmed_at TIMESTAMPTZ;
ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS online_files_cleanup_at TIMESTAMPTZ;

-- حدّث قيد الحالة للأنظمة القديمة
ALTER TABLE print_requests DROP CONSTRAINT IF EXISTS print_requests_status_check;
ALTER TABLE print_requests
  ADD CONSTRAINT print_requests_status_check
  CHECK (status IN ('uploading','pending','printing','ready','done','canceled','blocked'));

-- ── request_files ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS request_files (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       UUID        NOT NULL REFERENCES print_requests(id) ON DELETE CASCADE,
  filename         TEXT        NOT NULL,
  mime_type        TEXT,
  size_bytes       BIGINT      DEFAULT 0,
  storage_path     TEXT        NOT NULL,
  pages            INTEGER     DEFAULT 0,
  copies           INTEGER     DEFAULT 1,
  color            BOOLEAN     DEFAULT false,
  double_sided     BOOLEAN     DEFAULT false,
  pages_per_sheet  INTEGER     DEFAULT 1,
  page_range       TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE request_files ADD COLUMN IF NOT EXISTS pages INTEGER DEFAULT 0;

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
DROP POLICY IF EXISTS "anon delete online requests" ON print_requests;
DROP POLICY IF EXISTS "anon insert files"       ON request_files;
DROP POLICY IF EXISTS "anon select files"       ON request_files;
DROP POLICY IF EXISTS "anon delete files"       ON request_files;

REVOKE ALL ON print_requests FROM anon;
REVOKE ALL ON request_files FROM anon;
GRANT INSERT, SELECT ON print_requests TO anon;
GRANT UPDATE (status) ON print_requests TO anon;
GRANT INSERT, SELECT ON request_files TO anon;

-- السماح للـ anon بإدراج طلب جديد (المصدر لازم يكون online)
CREATE POLICY "anon insert requests"
  ON print_requests FOR INSERT TO anon
  WITH CHECK (source = 'online');

-- السماح للـ anon بتحديث حالة الطلب (لتغييره إلى received عند استلامه)
DROP POLICY IF EXISTS "anon update online status" ON print_requests;
CREATE POLICY "anon update online status"
  ON print_requests FOR UPDATE TO anon
  USING (source = 'online' AND source_of_truth = 'supabase_intake' AND desk_received_at IS NULL)
  WITH CHECK (
    source = 'online'
    AND source_of_truth = 'supabase_intake'
    AND desk_received_at IS NULL
    AND printed_at IS NULL
    AND picked_up_at IS NULL
    AND final_price_confirmed_at IS NULL
    AND online_files_cleanup_at IS NULL
    AND status IN ('uploading', 'pending')
  );

-- الطالب يقدر يقرأ طلبه بالـ ticket فقط (للـ tracking لاحقاً)
CREATE POLICY "anon select own request"
  ON print_requests FOR SELECT TO anon
  USING (source = 'online');

-- السماح للدشبورد بحذف الطلبات الأونلاين بعد استيرادها محلياً
CREATE POLICY "anon delete online requests"
  ON print_requests FOR DELETE TO anon
  USING (
    source = 'online'
    AND source_of_truth = 'desktop'
    AND desk_received_at IS NOT NULL
  );

-- الطالب يقدر يضيف ملفات
CREATE POLICY "anon insert files"
  ON request_files FOR INSERT TO anon
  WITH CHECK (
    request_id IN (
      SELECT id FROM print_requests
      WHERE source = 'online' AND source_of_truth = 'supabase_intake'
    )
  );

-- الطالب يقدر يقرأ ملفاته
CREATE POLICY "anon select files"
  ON request_files FOR SELECT TO anon
  USING (
    request_id IN (
      SELECT id FROM print_requests
      WHERE source = 'online'
    )
  );

-- السماح للدشبورد بحذف صفوف الملفات المرتبطة بالطلبات الأونلاين
CREATE POLICY "anon delete files"
  ON request_files FOR DELETE TO anon
  USING (
    request_id IN (
      SELECT id FROM print_requests
      WHERE source = 'online'
        AND source_of_truth = 'desktop'
        AND desk_received_at IS NOT NULL
    )
  );

-- ── Storage Bucket ───────────────────────────────────────────────
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

-- حذف policies الـ storage إن وجدت
DROP POLICY IF EXISTS "anon upload print-files" ON storage.objects;
DROP POLICY IF EXISTS "anon read print-files"   ON storage.objects;
DROP POLICY IF EXISTS "anon delete print-files" ON storage.objects;

-- السماح للـ anon بالرفع إلى bucket
CREATE POLICY "anon upload print-files"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'print-files'
    AND split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  );

-- السماح بقراءة الملفات (للدشبورد والتحميل)
CREATE POLICY "anon read print-files"
  ON storage.objects FOR SELECT TO anon
  USING (
    bucket_id = 'print-files'
    AND split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  );

-- السماح بحذف الملفات من الـ bucket بعد تنزيلها محلياً
CREATE POLICY "anon delete print-files"
  ON storage.objects FOR DELETE TO anon
  USING (
    bucket_id = 'print-files'
    AND EXISTS (
      SELECT 1
      FROM request_files rf
      JOIN print_requests pr ON pr.id = rf.request_id
      WHERE rf.storage_path = name
        AND pr.source = 'online'
        AND pr.source_of_truth = 'desktop'
        AND pr.desk_received_at IS NOT NULL
    )
  );

-- ── Realtime ─────────────────────────────────────────────────────
-- مطلوب لإرسال البيانات الكاملة مع كل تغيير
ALTER TABLE print_requests REPLICA IDENTITY FULL;
ALTER TABLE request_files  REPLICA IDENTITY FULL;

-- فعّل Realtime على الجدولين من:
-- Supabase Dashboard → Database → Replication → print_requests ✓ + request_files ✓

-- ── Indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_requests_ticket   ON print_requests (ticket);
CREATE INDEX IF NOT EXISTS idx_requests_status   ON print_requests (status);
CREATE INDEX IF NOT EXISTS idx_requests_created  ON print_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_request_id  ON request_files  (request_id);
