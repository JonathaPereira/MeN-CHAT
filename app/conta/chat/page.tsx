import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth/account";
import { PrivateChat } from "@/components/chat/private-chat";
export const dynamic = "force-dynamic";
export default async function Page() {
  const account = await getAccount();
  if (account.kind === "pending") redirect("/primeiro-acesso");
  if (account.kind !== "active") redirect("/entrar");
  return (
    <PrivateChat
      userId={account.profile.id}
      name={account.profile.display_name}
      code={account.profile.user_code}
      avatarPath={account.profile.avatar_path || null}
    />
  );
}
