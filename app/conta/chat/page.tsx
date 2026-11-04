import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth/account";
import { createClient } from "@/lib/supabase/server";
import { PrivateChat } from "@/components/chat/private-chat";
export const dynamic = "force-dynamic";
export default async function Page() {
  const account = await getAccount();
  if (account.kind === "pending") redirect("/primeiro-acesso");
  if (account.kind !== "active") redirect("/entrar");
  const client = await createClient();
  const { data } = await client
    .from("menchat_profiles")
    .select("avatar_path")
    .eq("id", account.profile.id)
    .maybeSingle();
  return (
    <PrivateChat
      userId={account.profile.id}
      name={account.profile.display_name}
      code={account.profile.user_code}
      avatarPath={data?.avatar_path || null}
    />
  );
}
