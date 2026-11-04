import { parseSupabaseConfig } from "./config";
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const config = parseSupabaseConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  return createBrowserClient(config.url, config.key);
}
