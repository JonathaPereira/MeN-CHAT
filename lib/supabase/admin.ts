import "server-only";
import { createClient } from "@supabase/supabase-js";
import { parseSupabaseConfig } from "./config";
import { authFetch } from "./request";
export function createAdminClient() {
  const config = parseSupabaseConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret || !/^sb_secret_[A-Za-z0-9_-]+$/.test(secret))
    throw new Error("Configure SUPABASE_SECRET_KEY somente no servidor.");
  return createClient(config.url, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: authFetch },
  });
}
