import { Heart, LockKeyhole, Users } from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main id="conteudo" className="auth-shell">
      <section className="login-story relative flex flex-col overflow-hidden px-7 py-7 text-white sm:px-12 lg:px-16 lg:py-10">
        <Brand light />
        <div className="absolute right-5 top-6 z-20 lg:hidden">
          <ThemeToggle />
        </div>
        <div className="relative z-10 my-auto max-w-lg py-9 lg:py-20">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-2 text-xs text-emerald-100">
            <Heart size={14} /> Nosso pequeno universo
          </span>
          <h1 className="text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl xl:text-6xl">
            Perto de quem
            <br />
            <span className="text-[#b8e8a7]">importa.</span>
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-emerald-50/80 lg:text-base">
            As conversas do dia a dia, as boas risadas e os planos de sempre.
            Agora, com um espaço só nosso.
          </p>
          <div className="mt-10 hidden space-y-3 lg:block" aria-hidden="true">
            <div className="max-w-xs rounded-2xl rounded-bl-sm border border-white/15 bg-white/10 p-4 text-sm">
              <strong className="mb-2 block text-xs text-emerald-200">
                Ana
              </strong>
              Bora reunir a turma? ☀️
            </div>
            <div className="ml-12 max-w-xs rounded-2xl rounded-br-sm bg-[#d9edc8] p-4 text-sm text-[#15372f]">
              Com vocês, qualquer plano fica melhor. 💚
            </div>
          </div>
        </div>
        <div className="relative z-10 hidden flex-wrap gap-5 text-xs text-emerald-50/80 lg:flex">
          <span className="flex items-center gap-2">
            <LockKeyhole size={15} /> Acesso por convite
          </span>
          <span className="flex items-center gap-2">
            <Users size={15} /> Nosso círculo de até 20 pessoas
          </span>
        </div>
      </section>
      <section className="relative flex flex-col items-center justify-center px-6 pb-12 pt-24 sm:px-12">
        <div className="absolute right-6 top-5 hidden lg:block">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">{children}</div>
        <p className="mt-8 text-xs text-[var(--muted)]">
          M&N CHAT · Demonstração interativa
        </p>
      </section>
    </main>
  );
}
