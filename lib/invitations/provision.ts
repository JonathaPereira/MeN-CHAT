import type { SupabaseClient } from "@supabase/supabase-js";
/** Não cria sessão nem senha conhecida para o convidado. Não aceita atributos administrativos do formulário. */
export async function provisionInviteIdentity(
  root: SupabaseClient,
  email: string,
): Promise<string | null> {
  const lookup = await root.rpc("menchat_invite_identity", { p_email: email });
  if (lookup.error) return null;
  const users = lookup.data as { id: string; confirmed: boolean }[];
  if (users.length)
    return users.length === 1 && users[0].confirmed ? users[0].id : null;
  const created = await root.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (!created.error && created.data.user) return created.data.user.id;
  // Outra criação simultânea pode ter vencido; não excluir identidades de forma destrutiva.
  const retry = await root.rpc("menchat_invite_identity", { p_email: email });
  return !retry.error && retry.data?.length === 1 && retry.data[0].confirmed
    ? String(retry.data[0].id)
    : null;
}
