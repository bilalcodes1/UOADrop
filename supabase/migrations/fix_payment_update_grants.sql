GRANT UPDATE (payment_method, payment_transaction_ref, payment_status, payment_submitted_at) ON print_requests TO anon;

DROP POLICY IF EXISTS "anon submit payment" ON print_requests;
CREATE POLICY "anon submit payment"
  ON print_requests FOR UPDATE TO anon
  USING (
    source = 'online'
    AND final_price_confirmed_at IS NOT NULL
    AND price_iqd > 0
    AND status IN ('pending','printing','ready')
    AND (payment_status IS NULL OR payment_status = 'pending')
  )
  WITH CHECK (
    source = 'online'
    AND final_price_confirmed_at IS NOT NULL
    AND price_iqd > 0
    AND status IN ('pending','printing','ready')
    AND payment_method IN ('qicard','zaincash')
    AND payment_transaction_ref IS NOT NULL
    AND length(trim(payment_transaction_ref)) >= 4
    AND payment_status = 'pending'
  );
