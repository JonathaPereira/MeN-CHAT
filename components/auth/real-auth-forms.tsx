"use client";
import { useActionState, useState } from "react";
import { signIn, sendCode, verifyCode } from "@/app/entrar/actions";
import type { AuthResult } from "@/lib/auth/validation";
import Link from "next/link";
const initial: AuthResult = {};
function Feedback({ state }: { state: AuthResult }) {
  return (
    <>
      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p role="status" className="demo-note">
          {state.notice}
        </p>
      )}
    </>
  );
}
export function RealLoginForm({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState(signIn, initial);
  return (
    <form action={action} className="mt-6 space-y-4">
      <fieldset disabled={disabled || pending} className="space-y-4">
        <label className="field-label" htmlFor="real-email">
          E-mail
        </label>
        <input
          id="real-email"
          name="email"
          type="email"
          className="field"
          required
          maxLength={254}
          autoComplete="username"
        />
        <label className="field-label" htmlFor="real-password">
          Senha
        </label>
        <input
          id="real-password"
          name="password"
          type="password"
          className="field"
          required
          maxLength={256}
          autoComplete="current-password"
        />
        <button className="primary-button w-full" type="submit">
          {pending ? "Entrando…" : "Entrar na conta"}
        </button>
      </fieldset>
      <Feedback state={state} />
      <Link
        href="/primeiro-acesso"
        className="block text-center text-sm text-[var(--accent)]"
      >
        Primeiro acesso ou redefinir senha
      </Link>
      <p className="text-center text-xs text-[var(--muted)]">
        Acesso exclusivo a contas preparadas pelo administrador.
      </p>
    </form>
  );
}
export function EmailAccessForm({ disabled }: { disabled: boolean }) {
  const [email, setEmail] = useState("");
  const [requestState, requestAction, requesting] = useActionState(
    sendCode,
    initial,
  );
  const [verifyState, verifyAction, verifying] = useActionState(
    verifyCode,
    initial,
  );
  return (
    <div className="mt-6 space-y-6">
      <form action={requestAction} className="space-y-4">
        <fieldset
          disabled={disabled || requesting || verifying}
          className="space-y-3"
        >
          <label className="field-label" htmlFor="access-email">
            E-mail da conta
          </label>
          <input
            id="access-email"
            name="email"
            type="email"
            className="field"
            required
            maxLength={254}
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="secondary-button w-full" type="submit">
            {requesting ? "Solicitando…" : "Enviar código por e-mail"}
          </button>
        </fieldset>
        <Feedback state={requestState} />
      </form>
      <form action={verifyAction} className="space-y-4">
        <fieldset
          disabled={disabled || requesting || verifying}
          className="space-y-3"
        >
          <input name="email" type="hidden" value={email} />
          <label className="field-label" htmlFor="access-code">
            Código recebido
          </label>
          <input
            id="access-code"
            name="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            className="field"
            required
            pattern="[0-9]{6,10}"
            minLength={6}
            maxLength={10}
          />
          <label className="field-label" htmlFor="access-password">
            Nova senha
          </label>
          <input
            id="access-password"
            name="password"
            type="password"
            autoComplete="new-password"
            className="field"
            required
            minLength={12}
            maxLength={72}
          />
          <label className="field-label" htmlFor="access-confirm">
            Confirmar nova senha
          </label>
          <input
            id="access-confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            className="field"
            required
            minLength={12}
            maxLength={72}
          />
          <p className="text-xs text-[var(--muted)]">
            Use pelo menos 12 caracteres para proteger sua conta.
          </p>
          <button className="primary-button w-full" type="submit">
            {verifying ? "Verificando…" : "Verificar código e definir senha"}
          </button>
        </fieldset>
        <Feedback state={verifyState} />
      </form>
      <Link
        href="/entrar"
        className="block text-center text-sm text-[var(--accent)]"
      >
        Voltar ao login real
      </Link>
    </div>
  );
}
