import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { getAccount } from "@/lib/auth/account";
import { createClient } from "@/lib/supabase/server";
import { InvitationAdminForm } from "@/components/invitations/admin-form";
import { revokeInvitation } from "./actions";
export const dynamic = "force-dynamic";
type Invite = { id: string; email: string; expires_at: string; state: string };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const account = await getAccount();
  if (account.kind !== "active") redirect("/entrar");
  if (account.profile.app_role !== "admin") redirect("/conta");
  const client = await createClient();
  const { data, error } = await client.rpc("menchat_list_invites");
  const status = (await searchParams).status;
  return (
    <AuthShell>
      <h1 className="mt-5 text-xl font-semibold">Convidar pessoas</h1>
      <p className="mt-3 text-sm text-[var(--muted)]">
        Gerencie o acesso pelo MenChat. Somente convidados poderão ativar uma
        conta.
      </p>
      {error ? (
        <p role="alert" className="form-error mt-4">
          Aplique a migração de convites para habilitar esta área.
        </p>
      ) : (
        <InvitationAdminForm />
      )}
      {status && (
        <p role="status" className="demo-note mt-4">
          {status === "revogado"
            ? "Convite revogado."
            : "Não foi possível revogar. Ele pode já ter sido utilizado."}
        </p>
      )}
      <ul className="mt-6 space-y-3" aria-label="Convites criados">
        {((data || []) as Invite[]).map((i) => (
          <li key={i.id} className="rounded-xl border border-[var(--line)] p-3">
            <p className="break-all text-sm">{i.email}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {
                (
                  {
                    pending: "Pendente",
                    used: "Usado",
                    expired: "Expirado",
                    revoked: "Revogado",
                  } as Record<string, string>
                )[i.state]
              }{" "}
              · {new Date(i.expires_at).toLocaleString("pt-BR")}
            </p>
            {i.state === "pending" && (
              <form action={revokeInvitation}>
                <input name="id" type="hidden" value={i.id} />
                <button className="secondary-button mt-3">
                  Revogar convite
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
      <Link href="/conta" className="secondary-button mt-5">
        Voltar à conta
      </Link>
    </AuthShell>
  );
}
