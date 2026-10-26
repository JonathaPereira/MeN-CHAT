import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
export const metadata: Metadata = { title: "Entrar" };
export default function LoginPage() {
  return (
    <AuthShell>
      <span className="eyebrow">QUE BOM TER VOCÊ AQUI</span>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight">
        Entre na conversa.
      </h2>
      <p className="mt-3 text-sm text-[var(--muted)]">
        Um cantinho reservado para amigos e família.
      </p>
      <AuthForm />
    </AuthShell>
  );
}
