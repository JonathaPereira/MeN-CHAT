import { redirect } from "next/navigation";
import Link from "next/link";
import { getAccount } from "@/lib/auth/account";
import { createClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/auth-shell";
import { RealProfileForm } from "@/components/chat/real/profile-form";
import type { RealProfile } from "@/lib/chat/types";
export const dynamic = "force-dynamic";
export default async function Page() {
  const account = await getAccount();
  if (account.kind !== "active") redirect("/entrar");
  const client = await createClient();
  const { data, error } = await client
    .from("menchat_profiles")
    .select(
      "id,display_name,user_code,status_message,avatar_path,show_code,allow_code_lookup,read_receipts,show_typing",
    )
    .eq("id", account.profile.id)
    .single<RealProfile>();
  return (
    <AuthShell>
      <h1 className="mt-5 text-xl font-semibold">Meu perfil</h1>
      {error || !data ? (
        <p role="alert" className="form-error mt-4">
          Não foi possível carregar o perfil. Tente novamente.
        </p>
      ) : (
        <RealProfileForm profile={data} />
      )}
      <Link href="/conta/chat" className="secondary-button mt-5 w-full">
        Voltar às conversas
      </Link>
    </AuthShell>
  );
}
