"use server";
import { getAccount } from "@/lib/auth/account";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionInviteIdentity } from "@/lib/invitations/provision";
import {
  invitationHash,
  invitationUrl,
  newInvitationToken,
} from "@/lib/invitations/token";
import { readEmail } from "@/lib/auth/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
export type InviteResult = { error?: string; url?: string };
export async function createInvitation(
  _state: InviteResult,
  form: FormData,
): Promise<InviteResult> {
  const account = await getAccount();
  if (account.kind !== "active" || account.profile.app_role !== "admin")
    return { error: "Somente administradores podem convidar." };
  const email = readEmail(form.get("email"));
  if (!email) return { error: "Informe um e-mail válido." };
  try {
    const token = newInvitationToken();
    const url = invitationUrl(process.env.MENCHAT_SITE_URL || "", token);
    const client = await createClient();
    const prepared = await client.rpc("menchat_prepare_invite", {
      p_email: email,
    });
    if (prepared.error || prepared.data !== true)
      return {
        error:
          "Convite indisponível. Confira a migração, a conta e o limite de 20 pessoas. Após muitas tentativas, aguarde uma hora.",
      };
    const root = createAdminClient();
    const id = await provisionInviteIdentity(root, email);
    if (!id)
      return {
        error:
          "Não foi possível preparar a identidade. Confira a configuração do servidor e a migração de convites. Contas antigas não confirmadas precisam de revisão administrativa.",
      };
    const { error } = await client.rpc("menchat_create_invite", {
      p_email: email,
      p_user: id,
      p_hash: invitationHash(token),
    });
    if (error)
      return {
        error:
          "Não foi possível gerar o convite. Confira se a conta já está ativa/desativada ou se o limite de 20 contas e convites pendentes foi atingido.",
      };
    revalidatePath("/conta/convites");
    return { url };
  } catch {
    return {
      error:
        "Não foi possível criar o convite. Verifique SUPABASE_SECRET_KEY e MENCHAT_SITE_URL no servidor. Não compartilhe a chave.",
    };
  }
}
export async function revokeInvitation(form: FormData) {
  const account = await getAccount();
  if (account.kind !== "active" || account.profile.app_role !== "admin")
    redirect("/entrar");
  const id = form.get("id");
  let ok = false;
  if (typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)) {
    try {
      const client = await createClient();
      const result = await client.rpc("menchat_revoke_invite", { p_id: id });
      ok = !result.error && result.data === true;
    } catch {}
  }
  revalidatePath("/conta/convites");
  redirect(
    ok ? "/conta/convites?status=revogado" : "/conta/convites?status=erro",
  );
}
