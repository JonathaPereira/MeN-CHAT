"use client";
import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { usePreferences } from "./preferences-provider";
export function PushSettings() {
  const { settings } = usePreferences();
  const [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      setEnabled(
        localStorage.getItem("menchat-background-notifications") === "yes",
      ),
    );
    return () => cancelAnimationFrame(frame);
  }, []);
  async function toggle() {
    setBusy(true);
    setNotice("");
    try {
      if (
        !window.isSecureContext ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      )
        throw new Error(
          "Use o Chrome atualizado no Android. No iPhone, instale na tela inicial pelo Safari.",
        );
      if (!settings.notificationsEnabled && !enabled)
        throw new Error(
          "Ative os avisos acima para habilitar notificações em segundo plano.",
        );
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg?.active)
        throw new Error("Aguarde o aplicativo carregar e tente novamente.");
      let sub = await reg.pushManager.getSubscription();
      if (!enabled) {
        const config = await fetch("/api/push", { cache: "no-store" });
        const data = await config.json();
        if (!config.ok)
          throw new Error(data.error || "Notificações indisponíveis.");
        if ((await Notification.requestPermission()) !== "granted")
          throw new Error(
            "Permita notificações nas configurações do navegador para continuar.",
          );
        const key = Uint8Array.from(
          atob(data.publicKey.replace(/-/g, "+").replace(/_/g, "/")),
          (c) => c.charCodeAt(0),
        );
        sub ??= await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        });
      }
      if (sub) {
        const result = await fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription: sub.toJSON(),
            enabled: !enabled,
            muted: settings.mutedChatIds,
          }),
        });
        if (!result.ok)
          throw new Error(
            "Não foi possível salvar. Confira com o administrador a atualização do banco.",
          );
      }
      localStorage.setItem(
        "menchat-background-notifications",
        enabled ? "no" : "yes",
      );
      setEnabled(!enabled);
      setNotice(
        enabled
          ? "Notificações em segundo plano desativadas neste dispositivo."
          : "Ativadas neste dispositivo. O Android também controla sons, vibração e economia de bateria.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível configurar as notificações.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3 rounded-xl border border-[var(--line)] p-3">
      <button
        className="secondary-button w-full"
        disabled={busy}
        onClick={() => void toggle()}
      >
        <BellRing size={18} />
        {busy
          ? "Configurando…"
          : enabled
            ? "Desativar notificações em segundo plano"
            : "Ativar notificações em segundo plano"}
      </button>
      <p className="text-xs text-[var(--muted)]">
        Receba avisos mesmo com o MenChat fechado. O aviso mostra somente “Você
        tem uma nova mensagem”, preservando o conteúdo na tela bloqueada.
      </p>
      {notice && (
        <p className="text-xs" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}

export function PushSync() {
  const { settings } = usePreferences();
  useEffect(() => {
    let active = true;
    const sync = async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (!sub || !active) return;
      const optedIn =
        localStorage.getItem("menchat-background-notifications") === "yes";

      await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          enabled: optedIn && settings.notificationsEnabled,
          muted: settings.mutedChatIds,
        }),
      });
    };
    void sync().catch(() => {});
    return () => {
      active = false;
    };
  }, [settings.notificationsEnabled, settings.mutedChatIds]);
  return null;
}
