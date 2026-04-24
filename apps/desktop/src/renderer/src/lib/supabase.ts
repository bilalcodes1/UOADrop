import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { params: { eventsPerSecond: 10 } },
});

export type SupabaseRequestRow = {
  id: string;
  ticket: string;
  student_name: string | null;
  student_email: string | null;
  pickup_pin_hash: string | null;
  status: string;
  price_iqd: number;
  source: 'local' | 'online';
  created_at: string;
  updated_at: string;
  printed_at: string | null;
  picked_up_at: string | null;
};
