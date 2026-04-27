-- Add column to track whether a delay notification was sent to the student
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
ALTER TABLE print_requests
  ADD COLUMN IF NOT EXISTS delay_notified_at timestamptz DEFAULT NULL;

-- Add notes column for student notes on print requests
ALTER TABLE print_requests
  ADD COLUMN IF NOT EXISTS notes text DEFAULT NULL;
