"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";

export function LoginForm() {
  const [visible, setVisible] = useState(false);
  const [notice, setNotice] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(true);
    event.currentTarget.reset();
    setVisible(false);
  }

  return (
    <div className="mt-9">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="field-label">E-mail</label>
          <div className="relative">
            <Mail className="field-icon" size={18} aria-hidden="true" />
            <input id="email" name="email" type="email" autoComplete="username" placeholder="voce@exemplo.com" required className="field pl-12" />
          </div>
        </div>
        <div>
          <label htmlFor="password" className="field-label">Senha</label>
          <div className="relative">
            <LockKeyhole className="field-icon" size={18} aria-hidden="true" />
            <input id="password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" placeholder="Sua senha" required className="field pl-12 pr-14" />
            <button type="button" aria-label={visible ? "Ocultar senha" : "Mostrar senha"} aria-pressed={visible} onClick={() => setVisible(!visible)} className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:text-pine">
              {visible ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
            </button>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-slate-500">Esta é uma demonstração. Não use sua senha real.</p>
        <button type="submit" className="primary-button w-full">Entrar <ArrowRight size={18} aria-hidden="true" /></button>
        <div role="status" className="text-sm leading-relaxed text-pine">
          {notice && "A autenticação ainda não está conectada. Nenhum dado foi enviado. Explore as conversas de demonstração abaixo."}
        </div>
      </form>
      <div className="my-6 flex items-center gap-4 text-xs text-slate-500"><span className="h-px flex-1 bg-slate-200" />CONHEÇA O ESPAÇO<span className="h-px flex-1 bg-slate-200" /></div>
      <Link href="/conversas" className="secondary-button w-full">Explorar demonstração <ArrowRight size={17} aria-hidden="true" /></Link>
      <p className="mt-7 text-center text-sm leading-relaxed text-slate-500">Ainda não tem acesso?<br /><span className="font-medium text-ink">Peça um convite ao administrador.</span></p>
    </div>
  );
}
