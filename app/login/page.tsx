import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
export const metadata: Metadata = { title: "Entrar" };
export default function LoginPage() {
  return (
    <AuthShell>
      <h1 className="sr-only">Entrar no MenChat</h1>
      <AuthForm />
    </AuthShell>
  );
}
