import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppRuntime } from "@/components/app-runtime";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#196b50",
};
import { ThemeProvider } from "@/components/theme-provider";
import { PreferencesProvider } from "@/components/preferences-provider";

export const metadata: Metadata = {
  title: {
    default: "MenChat",
    template: "%s · MenChat",
  },
  description:
    "Conversas privadas para amigos e família, com acesso exclusivo por convite.",
  applicationName: "MenChat",
  appleWebApp: { capable: true, title: "MenChat", statusBarStyle: "default" },
  icons: { apple: "/app/icon-192.png" },
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
            <a className="skip-link" href="#conteudo">
              Pular para o conteúdo
            </a>
            <AppRuntime />
            {children}
          </PreferencesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
