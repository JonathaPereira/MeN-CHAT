"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useDemo } from "@/components/demo-provider";

export function AuthForm({ register = false }: { register?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const { registerProfile } = useDemo();
  const router = useRouter();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    if (register) {
      if (String(data.get("name")).trim().length < 2) {
        setError("Informe um nome com pelo menos 2 caracteres.");
        return;
      }
      if (data.get("password") !== data.get("confirm")) {
        setError("As senhas não coincidem.");
        return;
      }
      if (String(data.get("invite")).trim().toUpperCase() !== "AMIGOS20") {
        setError(
          "Para testar o cadastro, use o convite de demonstração AMIGOS20.",
        );
        return;
      }
      if (!registerProfile(String(data.get("name")))) {
        setError(
          "Não foi possível salvar o perfil neste navegador. Libere o armazenamento local e tente novamente.",
        );
        return;
      }
    }
    event.currentTarget.reset();
    router.push(register ? "/perfil" : "/conversas");
  }
  return (
    <>
      <form onSubmit={submit} className="mt-7 space-y-4">
        {register && (
          <div>
            <label htmlFor="name" className="field-label">
              Nome
            </label>
            <input
              id="name"
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={50}
              className="field"
              placeholder="Como podemos chamar você?"
            />
          </div>
        )}
        <div>
          <label htmlFor="email" className="field-label">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            maxLength={254}
            className="field"
            placeholder="voce@exemplo.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="field-label">
            Senha
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={visible ? "text" : "password"}
              autoComplete={register ? "new-password" : "current-password"}
              minLength={register ? 8 : undefined}
              required
              className="field pr-14"
              placeholder={register ? "Pelo menos 8 caracteres" : "Sua senha"}
            />
            <button
              type="button"
              onClick={() => setVisible(!visible)}
              aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
              aria-pressed={visible}
              className="icon-button absolute right-1 top-1"
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        {register && (
          <>
            <div>
              <label htmlFor="confirm" className="field-label">
                Confirmar senha
              </label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="field"
                placeholder="Repita a senha"
              />
            </div>
            <div>
              <label htmlFor="invite" className="field-label">
                Convite do administrador
              </label>
              <input
                id="invite"
                name="invite"
                required
                className="field uppercase"
                placeholder="AMIGOS20"
                aria-describedby="invite-help"
              />
              <p id="invite-help" className="mt-2 text-xs text-[var(--muted)]">
                Para esta demonstração, use AMIGOS20.
              </p>
            </div>
          </>
        )}
        <p className="demo-note">
          Demonstração local.{" "}
          {register
            ? "Cria apenas um perfil neste navegador."
            : "Não verifica credenciais nem abre uma sessão real."}{" "}
          E-mail e senha não são salvos ou enviados. Use dados fictícios.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button type="submit" className="primary-button w-full">
          {register ? "Criar perfil de demonstração" : "Entrar na demonstração"}
          <ArrowRight size={17} aria-hidden="true" />
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-[var(--muted)]">
        {register ? "Já tem um perfil?" : "Recebeu um convite?"}{" "}
        <Link
          href={register ? "/login" : "/cadastro"}
          className="font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
        >
          {register ? "Voltar ao login" : "Criar perfil"}
        </Link>
      </p>
      {!register && (
        <Link
          href="/conversas"
          className="mt-4 block text-center text-xs text-[var(--muted)] underline underline-offset-4"
        >
          Explorar sem preencher
        </Link>
      )}
    </>
  );
}
