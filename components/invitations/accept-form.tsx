"use client";
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { requestInviteCode, acceptInvitation } from "@/app/convite/actions";
import type { AuthResult } from "@/lib/auth/validation";
export function AcceptInvitationForm() {
  const [token, setToken] = useState<string | null>(null),
    [email, setEmail] = useState("");
  const [requestState, requestAction, requesting] = useActionState(
    requestInviteCode,
    {} as AuthResult,
  );
  const [state, action, pending] = useActionState(
    acceptInvitation,
    {} as AuthResult,
  );
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const value =
        new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
      setToken(/^[A-Za-z0-9_-]{43}$/.test(value) ? value : "");
      // O fragmento nunca vai ao HTTP/Referer; retire também do histórico visível.
      if (window.location.hash)
        window.history.replaceState(null, "", window.location.pathname);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  if (token === null)
    return (
      <p className="demo-note mt-5" role="status">
        Abrindo convite…
      </p>
    );
  if (!token)
    return (
      <p className="demo-note mt-5" role="alert">
        Abra novamente o link completo enviado pelo administrador. Não há
        cadastro público. Ao recarregar esta tela, o link precisa ser aberto
        outra vez.
      </p>
    );
  return (
    <div className="mt-5 space-y-5">
      <p className="text-sm leading-relaxed text-[var(--muted)]">
        O convite é vinculado ao seu e-mail e vale uma vez. Solicite um novo
        código na sua caixa de entrada para ativar a conta.
      </p>
      <form action={requestAction} className="space-y-3">
        <input name="invite" type="hidden" value={token} />
        <label htmlFor="invited-email" className="field-label">
          Seu e-mail convidado
        </label>
        <input
          id="invited-email"
          name="email"
          type="email"
          className="field"
          maxLength={254}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending || requesting}
          autoComplete="email"
        />
        <button
          className="secondary-button w-full"
          disabled={pending || requesting}
        >
          {requesting ? "Solicitando…" : "Receber código por e-mail"}
        </button>
        {requestState.notice && (
          <p role="status" className="demo-note">
            {requestState.notice}
          </p>
        )}
        {requestState.error && (
          <p role="alert" className="form-error">
            {requestState.error}
          </p>
        )}
      </form>
      <form action={action} className="space-y-3">
        <input name="invite" type="hidden" value={token} />
        <input name="email" type="hidden" value={email} />
        <fieldset disabled={pending || requesting} className="space-y-3">
          <label htmlFor="invited-name" className="field-label">
            Seu nome
          </label>
          <input
            id="invited-name"
            name="name"
            className="field"
            required
            minLength={2}
            maxLength={50}
            autoComplete="name"
          />
          <label htmlFor="invited-otp" className="field-label">
            Código recebido no e-mail
          </label>
          <input
            id="invited-otp"
            name="otp"
            className="field"
            inputMode="numeric"
            pattern="[0-9]{6,10}"
            maxLength={10}
            required
            autoComplete="one-time-code"
          />
          <label htmlFor="invited-password" className="field-label">
            Crie sua senha
          </label>
          <input
            id="invited-password"
            name="password"
            type="password"
            className="field"
            required
            minLength={12}
            maxLength={72}
            autoComplete="new-password"
          />
          <label htmlFor="invited-confirm" className="field-label">
            Confirme sua senha
          </label>
          <input
            id="invited-confirm"
            name="confirm"
            type="password"
            className="field"
            required
            minLength={12}
            maxLength={72}
            autoComplete="new-password"
          />
          <button className="primary-button w-full">
            {pending ? "Ativando…" : "Aceitar convite e entrar"}
          </button>
        </fieldset>
        {state.error && (
          <p role="alert" className="form-error">
            {state.error}
          </p>
        )}
      </form>
      <Link
        href="/entrar"
        className="block text-center text-xs text-[var(--muted)]"
      >
        Já tenho conta ativa
      </Link>
    </div>
  );
}
