import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main id="conteudo" className="auth-minimal">
      <div className="auth-theme">
        <ThemeToggle />
      </div>
      <section className="auth-card" aria-label="Acesso ao MenChat">
        <div className="auth-logo">
          <Brand large />
        </div>
        {children}
      </section>
    </main>
  );
}
