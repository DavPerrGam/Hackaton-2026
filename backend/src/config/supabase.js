import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// El backend siempre usa la service_role key, igual que en el Proyecto
// Integrador: el cliente nunca habla directo con Supabase, así que RLS
// no depende de la sesión del navegador.
export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
