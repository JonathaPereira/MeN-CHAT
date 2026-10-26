import type { Metadata } from "next";
import { Heart, LockKeyhole, Sparkles, Users } from "lucide-react";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main id="conteudo" className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="login-story relative flex flex-col overflow-hidden px-7 py-8 text-white sm:px-12 lg:min-h-dvh lg:px-16 lg:py-12">
        <Brand light />
        <div className="relative z-10 my-auto max-w-lg py-14 lg:py-20">
          <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-2 text-xs font-medium text-emerald-100"><Sparkles size={14} aria-hidden="true" /> Nosso pequeno universo</span>
          <h1 className="text-4xl font-semibold leading-[1.15] tracking-tight sm:text-5xl xl:text-6xl">Perto de quem<br /><span className="text-[#b8e8a7]">importa.</span></h1>
          <p className="mt-6 max-w-sm text-base leading-relaxed text-emerald-50/80">As conversas do dia a dia, as boas risadas e os planos de sempre. Tudo em um lugar só, com as suas pessoas.</p>
          <div className="mt-10 hidden space-y-3 sm:block" aria-hidden="true">
            <div className="flex max-w-xs items-center gap-3 rounded-2xl rounded-bl-sm border border-white/15 bg-white/10 p-4 shadow-lg"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#c9ddb4] text-sm font-bold text-ink">JP</span><div><p className="text-xs font-semibold text-emerald-100">João</p><p className="mt-1 text-sm">Bora reunir a turma? ☀️</p></div></div>
            <div className="ml-12 flex max-w-xs items-center gap-3 rounded-2xl rounded-br-sm bg-[#d9edc8] p-4 text-ink shadow-lg"><Heart size={20} /><p className="text-sm font-medium">Sempre tem espaço pra mais uma conversa.</p></div>
          </div>
        </div>
        <div className="relative z-10 flex flex-wrap gap-5 text-xs text-emerald-50/80"><span className="flex items-center gap-2"><LockKeyhole size={15} aria-hidden="true" /> Acesso por convite</span><span className="flex items-center gap-2"><Users size={15} aria-hidden="true" /> Até 20 pessoas próximas</span></div>
      </section>
      <section className="flex items-center justify-center bg-canvas px-6 py-12 sm:px-12 lg:py-16">
        <div className="w-full max-w-sm">
          <span className="eyebrow">QUE BOM TER VOCÊ AQUI</span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Entre na conversa.</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">Um cantinho reservado para amigos e família.</p>
          <LoginForm />
          <p className="mt-10 text-center text-xs text-slate-500">M&N CHAT · Protótipo visual / Etapa 1</p>
        </div>
      </section>
    </main>
  );
}
