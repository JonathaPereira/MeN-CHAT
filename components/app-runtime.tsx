"use client";
import { useEffect, useState } from "react";
import { PushSync } from "./push-settings";
import { Modal } from "./modal";
import { InstallAppButton } from "./install-app-button";
import { usePathname } from "next/navigation";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export function AppRuntime() {
  const path = usePathname();
  const [instructions, setInstructions] = useState(false),
    [address, setAddress] = useState(""),
    [installed, setInstalled] = useState(false),
    [notice, setNotice] = useState("");
  const [install, setInstall] = useState<InstallEvent | null>(null),
    [offline, setOffline] = useState(false),
    [update, setUpdate] = useState(false);
  useEffect(() => {
    const status = () => setOffline(!navigator.onLine);
    const frame = requestAnimationFrame(() => {
      status();
      setAddress(location.origin);
      setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    });
    const openInstall = () => {
      setNotice("");
      setInstructions(true);
    };
    const finishInstall = () => {
      setInstalled(true);
      setInstall(null);
      setInstructions(false);
    };
    window.addEventListener("menchat:install", openInstall);
    window.addEventListener("appinstalled", finishInstall);
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
      window.removeEventListener("menchat:install", openInstall);
      window.removeEventListener("appinstalled", finishInstall);
      window.removeEventListener("online", status);
      window.removeEventListener("offline", status);
      window.removeEventListener("beforeinstallprompt", offer);
    };
  }, []);
  return (
    <>
      {path.startsWith("/conta") && <PushSync />}
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
      {!installed &&
        !update &&
        ["/entrar", "/conta/configuracoes"].includes(path) && (
          <div className="app-install">
            <InstallAppButton />
          </div>
        )}
      {instructions && (
        <Modal title="Instalar MenChat" onClose={() => setInstructions(false)}>
          <div className="space-y-4 text-sm leading-relaxed">
            <p>Tenha o MenChat na tela inicial do seu celular.</p>
            <a
              className="primary-button w-full"
              href="/downloads/menchat-2.0.2.apk"
              download="menchat-2.0.2.apk"
            >
              Baixar APK Android · versão 2.0.2 — nativo
            </a>
            <p className="text-xs text-[var(--muted)]">
              Android 8 ou posterior. Esta primeira etapa nativa inclui login,
              conversas, texto e áudio. Abra o arquivo no celular para instalar.
            </p>
            {installed ? (
              <p>O MenChat já está aberto como aplicativo neste dispositivo.</p>
            ) : install ? (
              <button
                className="primary-button w-full"
                onClick={async () => {
                  try {
                    await install.prompt();
                    const choice = await install.userChoice;
                    setNotice(
                      choice.outcome === "accepted"
                        ? "Instalação solicitada. Acompanhe a confirmação do navegador."
                        : "Você pode instalar depois pelo menu do navegador.",
                    );
                  } catch {
                    setNotice(
                      "Use o menu do navegador para instalar o MenChat.",
                    );
                  } finally {
                    setInstall(null);
                  }
                }}
              >
                Instalar neste dispositivo
              </button>
            ) : null}
            <p>
              <strong>Android:</strong> abra o endereço abaixo no Chrome → menu
              ⋮ → Instalar aplicativo ou Adicionar à tela inicial.
            </p>
            <p>
              <strong>iPhone:</strong> abra no Safari → Compartilhar → Adicionar
              à Tela de Início.
            </p>
            <label className="field-label" htmlFor="install-address">
              Endereço para abrir no celular
            </label>
            <input
              id="install-address"
              className="field"
              readOnly
              value={address}
              onFocus={(e) => e.target.select()}
            />
            <button
              className="secondary-button w-full"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(address);
                  setNotice("Endereço copiado. Abra-o no celular.");
                } catch {
                  setNotice("Selecione e copie o endereço acima.");
                }
              }}
            >
              Copiar endereço
            </button>
            {notice && <p role="status">{notice}</p>}
          </div>
        </Modal>
      )}
    </>
  );
}
