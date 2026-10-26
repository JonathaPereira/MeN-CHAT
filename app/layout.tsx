import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "M&N CHAT · Perto de quem importa", template: "%s · M&N CHAT" },
  description: "Um espaço para conversar com seus amigos e sua família. Protótipo visual.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
        {children}
      </body>
    </html>
  );
}
