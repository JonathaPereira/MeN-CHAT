"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export function AppRuntime() {
  const path = usePathname();
  const [install, setInstall] = useState<InstallEvent | null>(null),
    [offline, setOffline] = useState(false),
    [update, setUpdate] = useState(false);
  useEffect(() => {
    const status = () => setOffline(!navigator.onLine);
    const frame = requestAnimationFrame(status);
    const offer = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallEvent);
    };
    window.addEventListener("online", status);
    window.addEventListener("offline", status);
    window.addEventListener("beforeinstallprompt", offer);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => {
          reg.addEventListener("updatefound", () => {
            const worker = reg.installing;
            worker?.addEventListener("statechange", () => {
              if (
                worker.state === "installed" &&
                navigator.serviceWorker.controller
              )
                setUpdate(true);
            });
          });
        })
        .catch(() => {});
    }
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("online", status);
      window.removeEventListener("offline", status);
      window.removeEventListener("beforeinstallprompt", offer);
    };
  }, []);
  return (
    <>
      {offline && (
        <div className="app-network-notice" role="status">
          Sem conexão. Aguarde a internet voltar antes de enviar.
        </div>
      )}
      {update && !offline && (
        <button className="app-install" onClick={() => location.reload()}>
          Nova versão disponível · Atualizar
        </button>
      )}
      {install &&
        !offline &&
        !update &&
        ["/entrar", "/conta/configuracoes"].includes(path) && (
          <button
            className="app-install"
            onClick={async () => {
              try {
                await install.prompt();
                await install.userChoice;
              } catch {
                /* A instalação também fica no menu do navegador. */
              } finally {
                setInstall(null);
              }
            }}
          >
            Instalar MenChat
          </button>
        )}
    </>
  );
}
