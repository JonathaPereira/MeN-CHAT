"use client";
import { useActionState, useState } from "react";
import {
  createInvitation,
  type InviteResult,
} from "@/app/conta/convites/actions";
export function InvitationAdminForm() {
  const [state, action, pending] = useActionState(
    createInvitation,
    {} as InviteResult,
  );
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <form action={action} className="mt-5 space-y-4">
      <label htmlFor="invite-email" className="field-label">
        E-mail do convidado
      </label>
      <input
        id="invite-email"
        className="field"
        name="email"
        type="email"
        required
        maxLength={254}
        autoComplete="off"
        disabled={pending}
      />
      <button className="primary-button w-full" disabled={pending}>
        {pending ? "Preparando…" : "Gerar convite"}
      </button>
      <p className="text-xs leading-relaxed text-[var(--muted)]">
        Válido por 72 horas. Reemitir para o mesmo e-mail substitui o link
        anterior. Você compartilha o link; o código de verificação será enviado
        ao e-mail vinculado.
      </p>
      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      {state.url && (
        <div className="demo-note space-y-3">
          <label htmlFor="invite-url">Link do convite</label>
          <input
            id="invite-url"
            className="field text-xs"
            readOnly
            value={state.url}
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            type="button"
            className="secondary-button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(state.url!);
                setCopied(state.url!);
              } catch {
                setCopied(null);
              }
            }}
          >
            {copied === state.url ? "Copiado" : "Copiar link"}
          </button>
          <p className="text-xs">
            Envie à pessoa convidada. Este link só é mostrado nesta geração;
            para recuperar depois, gere outro.
          </p>
        </div>
      )}
    </form>
  );
}
