import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth/account";
import { AuthShell } from "@/components/auth-shell";
import { RealSettings } from "@/components/chat/real/settings";
export const dynamic = "force-dynamic";
export default async function Page() {
  const account = await getAccount();
  if (account.kind !== "active") redirect("/entrar");
  return (
    <AuthShell>
      <h1 className="mt-5 text-xl font-semibold">Configurações</h1>
      <RealSettings />
    </AuthShell>
  );
}
