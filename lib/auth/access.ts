import type { RealProfile } from "../chat/types";
import type { SupabaseClient } from "@supabase/supabase-js";
export type AccountProfile = RealProfile & {
  id: string;
  display_name: string;
  user_code: string;
  app_role: "admin" | "member";
  account_status: "active";
};
export type Account =
  | { kind: "configuration" | "unavailable" | "signed-out" }
  | { kind: "pending"; email: string }
  | { kind: "active"; email: string; profile: AccountProfile };
export async function loadAccount(client: SupabaseClient): Promise<Account> {
  try {
    // Revalidação remota; não confiar no usuário retornado apenas por getSession/cookies.
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user) return { kind: "signed-out" };
    if (!user.email_confirmed_at || !user.email)
      return { kind: "pending", email: user.email || "" };
    const { data: profile, error: profileError } = await client
      .from("menchat_profiles")
      .select(
        "id,display_name,user_code,app_role,account_status,status_message,avatar_path,show_code,allow_code_lookup,read_receipts,show_typing",
      )
      .eq("id", user.id)
      .eq("account_status", "active")
      .maybeSingle<AccountProfile>();
    if (profileError) return { kind: "unavailable" };
    if (
      !profile ||
      profile.id !== user.id ||
      profile.account_status !== "active"
    )
      return { kind: "pending", email: user.email };
    return { kind: "active", email: user.email, profile };
  } catch {
    return { kind: "unavailable" };
  }
}
