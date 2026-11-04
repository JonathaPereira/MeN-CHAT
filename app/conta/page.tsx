import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { getAccount } from "@/lib/auth/account";
import { signOut } from "@/app/entrar/actions";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Minha conta" };
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ saida?: string }>;
}) {
  const exitFailed = (await searchParams).saida === "erro";
  const account = await getAccount();
  if (account.kind === "signed-out" || account.kind === "configuration")
    redirect("/entrar");
  if (account.kind === "pending") redirect("/primeiro-acesso");
  if (account.kind !== "active")
    return (
      <AuthShell>
        <h1 className="mt-5 text-xl font-semibold">Acesso indisponível</h1>
        <p role="alert" className="form-error mt-4">
          Não foi possível verificar sua conta no servidor. Tente novamente.
        </p>
        <Link href="/conta" className="secondary-button mt-4">
          Tentar novamente
        </Link>
        <form action={signOut}>
          <button className="secondary-button mt-3">Sair desta conta</button>
        </form>
      </AuthShell>
    );
  return (
    <AuthShell>
      <h1 className="mt-5 text-xl font-semibold">Sua conta está conectada</h1>
      {exitFailed && (
        <p role="alert" className="form-error mt-4">
          Não foi possível encerrar a sessão. Tente sair novamente.
        </p>
      )}
      <dl className="mt-5 space-y-4 text-sm">
        <div>
          <dt className="text-[var(--muted)]">Nome</dt>
          <dd>{account.profile.display_name}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">E-mail</dt>
          <dd className="break-all">{account.email}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Seu código</dt>
          <dd className="font-mono text-lg tracking-widest">
            {account.profile.user_code}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Papel</dt>
          <dd>
            {account.profile.app_role === "admin" ? "Administrador" : "Membro"}
          </dd>
        </div>
      </dl>
      {account.profile.app_role === "admin" && (
        <Link href="/conta/convites" className="secondary-button mt-5 w-full">
          Convidar pessoas
        </Link>
      )}
      <Link href="/conta/chat" className="primary-button mt-5 w-full">
        Abrir conversas
      </Link>
      <Link href="/conta/perfil" className="secondary-button mt-4 w-full">
        Editar perfil
      </Link>
      <Link
        href="/conta/configuracoes"
        className="secondary-button mt-3 w-full"
      >
        Configurações
      </Link>
      <form action={signOut}>
        <button className="secondary-button mt-5 w-full" type="submit">
          Sair deste aparelho
        </button>
      </form>
    </AuthShell>
  );
}
