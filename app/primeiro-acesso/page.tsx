import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { EmailAccessForm } from "@/components/auth/real-auth-forms";
import { getAccount } from "@/lib/auth/account";
import { signOut } from "@/app/entrar/actions";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Primeiro acesso" };
export default async function FirstAccessPage() {
  const account = await getAccount();
  return (
    <AuthShell>
      <h1 className="mt-5 text-xl font-semibold">
        Verificar e-mail e definir senha
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
        Use o e-mail da conta preparada pelo administrador. Esta tela não cria
        cadastros nem ativa convites.
      </p>
      {account.kind === "configuration" && (
        <p role="alert" className="demo-note mt-4">
          Configure o Supabase em .env.local e reinicie o servidor.
        </p>
      )}
      {account.kind === "pending" && (
        <div className="demo-note mt-4" role="status">
          <p>Conta identificada: {account.email}</p>
          <p className="mt-2">
            Sua conta ainda não tem acesso ativo. Aguarde a liberação pelo
            administrador.
          </p>
          <Link href="/conta" className="secondary-button mt-3">
            Verificar liberação
          </Link>
          <form action={signOut}>
            <button type="submit" className="secondary-button mt-3">
              Sair desta conta
            </button>
          </form>
        </div>
      )}
      <EmailAccessForm disabled={account.kind === "configuration"} />
    </AuthShell>
  );
}
