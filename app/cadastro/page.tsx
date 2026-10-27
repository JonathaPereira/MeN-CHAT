import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
export const metadata: Metadata = { title: "Cadastro por convite" };
export default function RegisterPage() {
  return (
    <AuthShell>
      <h1 className="mt-6 text-center text-lg font-semibold">
        Cadastro por convite
      </h1>
      <AuthForm register />
    </AuthShell>
  );
}
