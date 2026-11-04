import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { RealLoginForm } from "@/components/auth/real-auth-forms";
import { getAccount } from "@/lib/auth/account";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Acesso à conta" };
export default async function RealLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ saida?: string }>;
}) {
  const exitFailed = (await searchParams).saida === "erro";
  const account = await getAccount();
  if (account.kind === "active")
    redirect(exitFailed ? "/conta?saida=erro" : "/conta/chat");
  return (
    <AuthShell>
      <h1 className="mt-5 text-xl font-semibold">Entrar</h1>
      {account.kind === "configuration" && (
        <p role="alert" className="demo-note mt-4">
          Configure a URL e a chave publicável em .env.local e reinicie o
          servidor para habilitar o acesso real.
        </p>
      )}
      {account.kind === "unavailable" && (
        <p role="alert" className="form-error mt-4">
          Não foi possível validar o acesso. Confira a conexão e a base do
          Supabase.
        </p>
      )}
      {exitFailed && (
        <p role="alert" className="form-error mt-4">
          Não foi possível confirmar a saída. Tente sair novamente ou feche a
          sessão nas configurações do navegador.
        </p>
      )}
      <RealLoginForm disabled={account.kind === "configuration"} />
    </AuthShell>
  );
}
