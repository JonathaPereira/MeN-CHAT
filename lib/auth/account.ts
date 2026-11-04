import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseSupabaseConfig } from "@/lib/supabase/config";
import { loadAccount, type Account } from "./access";
export async function getAccount(): Promise<Account> {
  try {
    parseSupabaseConfig(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
  } catch {
    return { kind: "configuration" };
  }
  try {
    return await loadAccount(await createClient());
  } catch {
    return { kind: "unavailable" };
  }
}
