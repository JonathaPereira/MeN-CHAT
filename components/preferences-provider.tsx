"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { vibrateSnowball } from "@/lib/snowball";
import { Bell, X } from "lucide-react";
import {
  defaultPreferences,
  parsePreferences,
  shouldNotify,
  shouldNotifySnowball,
  type Preferences,
} from "@/lib/preferences";

const KEY = "mn-chat-preferences-v1";
const serverSnapshot = JSON.stringify(defaultPreferences);
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("mn-preferences", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("mn-preferences", callback);
  };
}
function snapshot() {
  try {
    return localStorage.getItem(KEY) || serverSnapshot;
  } catch {
    return serverSnapshot;
  }
}
type IncomingNotice = {
  kind?: "snowball";
  chatId: string;
  title: string;
  text: string;
  away: boolean;
};
type PreferencesContextValue = {
  settings: Preferences;
  update: (patch: Partial<Preferences>) => boolean;
  notifyIncoming: (notice: IncomingNotice) => void;
  testNotification: () => void;
  notifySnowball: (notice: Omit<IncomingNotice, "kind" | "away">) => boolean;
};
const Context = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => serverSnapshot);
  const settings = useMemo(() => parsePreferences(raw), [raw]);
  const current = useRef(settings);
  useEffect(() => {
    current.current = settings;
  }, [settings]);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(
    null,
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const showToast = useCallback((title: string, body: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ title, body });
    timer.current = setTimeout(() => setToast(null), 6000);
  }, []);
  const prepareSound = useCallback(() => {
    if (
      !current.current.notificationSound ||
      typeof AudioContext === "undefined"
    )
      return;
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume().catch(() => {});
    } catch {
      /* Visual alerts remain available. */
    }
  }, []);
  useEffect(() => {
    window.addEventListener("pointerdown", prepareSound);
    return () => {
      window.removeEventListener("pointerdown", prepareSound);
      if (timer.current) clearTimeout(timer.current);
      void audio.current?.close().catch(() => {});
    };
  }, [prepareSound]);
  const playSound = useCallback(() => {
    const ctx = audio.current;
    if (!ctx || ctx.state === "closed" || !current.current.notificationSound)
      return;
    const emit = () => {
      if (ctx.state !== "running") return;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.frequency.value = 660;
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.2);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    };
    if (ctx.state === "suspended")
      void ctx
        .resume()
        .then(emit)
        .catch(() => {});
    else emit();
  }, []);
  const deliver = useCallback(
    (notice: IncomingNotice, test = false) => {
      const preferences = current.current;
      if (
        !test &&
        !(notice.kind === "snowball"
          ? shouldNotifySnowball(preferences, notice.chatId)
          : shouldNotify(preferences, notice.chatId, notice.away))
      )
        return;
      if (!preferences.notificationsEnabled) {
        showToast(
          "Notificações desativadas",
          "Ative os avisos nas configurações para testar.",
        );
        return;
      }
      const body = preferences.messagePreview
        ? notice.text
        : notice.kind === "snowball"
          ? "Você recebeu uma bola de neve de teste."
          : "Você recebeu uma mensagem de teste.";
      if (preferences.inAppAlerts || test) showToast(notice.title, body);
      playSound();
      if (notice.kind === "snowball" && preferences.snowballVibration)
        vibrateSnowball(navigator);
      if (
        preferences.browserAlerts &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          const notification = new Notification(notice.title, {
            body,
            tag: `mn-${notice.chatId}`,
            silent: true,
          });
          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        } catch {
          showToast(
            "Aviso dentro do aplicativo",
            "Seu navegador não permite notificações de sistema nesta aba. Push com o app fechado fica para uma próxima etapa.",
          );
        }
      }
    },
    [showToast, playSound],
  );
  function update(patch: Partial<Preferences>) {
    try {
      const next = parsePreferences(
        JSON.stringify({ ...parsePreferences(snapshot()), ...patch }),
      );
      localStorage.setItem(KEY, JSON.stringify(next));
      window.dispatchEvent(new Event("mn-preferences"));
      return true;
    } catch {
      showToast(
        "Não foi possível salvar",
        "Verifique se o armazenamento local está permitido neste navegador.",
      );
      return false;
    }
  }
  return (
    <Context.Provider
      value={{
        settings,
        update,
        notifyIncoming: deliver,
        notifySnowball: (notice) => {
          if (!shouldNotifySnowball(current.current, notice.chatId))
            return false;
          deliver({ ...notice, kind: "snowball", away: true });
          return current.current.snowballEffects && current.current.inAppAlerts;
        },
        testNotification: () => {
          prepareSound();
          deliver(
            {
              chatId: "test",
              title: "M&N CHAT · Teste",
              text: "Este é um exemplo de prévia da mensagem.",
              away: true,
            },
            true,
          );
        },
      }}
    >
      {children}
      {toast && (
        <aside
          className="notification-toast"
          role="status"
          aria-label="Aviso de notificação"
        >
          <Bell size={19} className="shrink-0 text-[var(--accent)]" />
          <div className="min-w-0 flex-1">
            <strong className="block text-sm">{toast.title}</strong>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
              {toast.body}
            </p>
          </div>
          <button
            className="icon-button shrink-0"
            aria-label="Fechar notificação"
            onClick={() => setToast(null)}
          >
            <X size={17} />
          </button>
        </aside>
      )}
    </Context.Provider>
  );
}
export function usePreferences() {
  const context = useContext(Context);
  if (!context) throw new Error("PreferencesProvider ausente");
  return context;
}
