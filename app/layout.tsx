import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { PreferencesProvider } from "@/components/preferences-provider";
import { DemoProvider } from "@/components/demo-provider";

export const metadata: Metadata = {
  title: {
    default: "M&N CHAT · Perto de quem importa",
    template: "%s · M&N CHAT",
  },
  description:
    "Um espaço para conversar com seus amigos e sua família. Protótipo visual.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <PreferencesProvider>
            <DemoProvider>
              <a className="skip-link" href="#conteudo">
                Pular para o conteúdo
              </a>
              {children}
            </DemoProvider>
          </PreferencesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
