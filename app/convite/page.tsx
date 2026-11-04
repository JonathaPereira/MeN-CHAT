import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { AcceptInvitationForm } from "@/components/invitations/accept-form";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Aceitar convite",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <AuthShell>
      <h1 className="mt-5 text-xl font-semibold">Você foi convidado</h1>
      <AcceptInvitationForm />
    </AuthShell>
  );
}
