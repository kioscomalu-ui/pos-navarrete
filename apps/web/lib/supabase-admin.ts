import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Cliente con permisos totales. Saltea RLS.
 * Solo se puede importar desde código de servidor.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}