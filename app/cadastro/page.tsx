import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
export const metadata: Metadata = { title: "Cadastro por convite" };
export default function RegisterPage() {
  return (
    <AuthShell>
      <span className="eyebrow">TEM LUGAR PRA VOCÊ</span>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight">
        Faça parte do círculo.
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
        Prepare seu perfil com o convite do administrador.
      </p>
      <AuthForm register />
    </AuthShell>
  );
}
