-- ================================================================
-- UOADrop — Payment Fields Migration
-- أعمدة الدفع: طريقة الدفع، رقم العملية، حالة الدفع
-- ================================================================

-- إضافة حقول الدفع إلى جدول الطلبات
ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS payment_method TEXT
  CHECK (payment_method IS NULL OR payment_method IN ('qicard','zaincash'));

ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS payment_transaction_ref TEXT;

ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT NULL
  CHECK (payment_status IS NULL OR payment_status IN ('pending','verified','rejected'));

ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS payment_submitted_at TIMESTAMPTZ;

ALTER TABLE print_requests ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ;

-- السماح للطالب (anon) بتحديث حقول الدفع فقط على طلباته الأونلاين
DROP POLICY IF EXISTS "anon submit payment" ON print_requests;
CREATE POLICY "anon submit payment"
  ON print_requests FOR UPDATE TO anon
  USING (
    source = 'online'
    AND status IN ('pending','printing','ready')
    AND (payment_status IS NULL OR payment_status = 'pending')
  )
  WITH CHECK (
    source = 'online'
    AND payment_method IN ('qicard','zaincash')
    AND payment_transaction_ref IS NOT NULL
    AND payment_status = 'pending'
  );

-- تأكد من أن Realtime يرسل الأعمدة الجديدة
ALTER TABLE print_requests REPLICA IDENTITY FULL;
