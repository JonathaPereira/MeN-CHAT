import { redirect } from "next/navigation";
import Link from "next/link";
import { getAccount } from "@/lib/auth/account";
import { AuthShell } from "@/components/auth-shell";
import { RealProfileForm } from "@/components/chat/real/profile-form";
export const dynamic = "force-dynamic";
export default async function Page() {
  const account = await getAccount();
  if (account.kind !== "active") redirect("/entrar");
  return (
    <AuthShell>
      <h1 className="mt-5 text-xl font-semibold">Meu perfil</h1>
      <RealProfileForm profile={account.profile} />
      <Link href="/conta/chat" className="secondary-button mt-5 w-full">
        Voltar às conversas
      </Link>
    </AuthShell>
  );
}
