-- Schedule delayed request notifications from inside Supabase.
-- Run this in Supabase SQL Editor.
-- If you add CRON_SECRET in Vercel later, replace the empty headers below
-- with: jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

ALTER TABLE print_requests
  ADD COLUMN IF NOT EXISTS delay_notified_at timestamptz DEFAULT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'uoadrop_notify_delayed_every_minute') THEN
    PERFORM cron.unschedule('uoadrop_notify_delayed_every_minute');
  END IF;
END $$;

SELECT cron.schedule(
  'uoadrop_notify_delayed_every_minute',
  '* * * * *',
  $$
  SELECT net.http_get(
    url := 'https://uoadrop.vercel.app/api/cron/notify-delayed',
    headers := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'uoadrop_notify_delayed_every_minute';
