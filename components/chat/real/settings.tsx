"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PushSettings } from "@/components/push-settings";
import { ThemeToggle } from "@/components/theme-toggle";
import { usePreferences } from "@/components/preferences-provider";
import type { Preferences } from "@/lib/preferences";
export function RealSettings({
  onClose,
  onProfile,
}: { onClose?: () => void; onProfile?: () => void } = {}) {
  const { settings, update, testNotification } = usePreferences();
  const [tab, setTab] = useState<string | null>(null),
    [notice, setNotice] = useState("");
  function toggle(key: keyof Preferences, label: string) {
    return (
      <label key={key} className="real-checkbox">
        <input
          type="checkbox"
          checked={Boolean(settings[key])}
          onChange={(e) => {
            if (!update({ [key]: e.target.checked }))
              setNotice(
                "Não foi possível salvar a preferência neste navegador.",
              );
          }}
        />
        <span>{label}</span>
      </label>
    );
  }
  return (
    <div className="mt-5 space-y-4">
      {!tab ? (
        <>
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            Aparência e uso de mídia são salvos neste navegador. Privacidade
            fica na sua conta.
          </p>
          {[
            "Aparência",
            "Conversas e voz",
            "Dados e armazenamento",
            "Notificações",
          ].map((name) => (
            <button
              key={name}
              className="real-settings-row"
              onClick={() => setTab(name)}
            >
              <span>{name}</span>
              <ChevronRight size={17} />
            </button>
          ))}
          <Link
            prefetch={onProfile ? false : undefined}
            onClick={(e) => {
              if (onProfile && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                e.preventDefault();
                onProfile();
              }
            }}
            href="/conta/perfil"
            className="real-settings-row"
          >
            Perfil e privacidade
            <ChevronRight size={17} />
          </Link>
          <Link href="/conta" className="real-settings-row">
            Minha conta
            <ChevronRight size={17} />
          </Link>
        </>
      ) : (
        <>
          <button
            className="text-sm text-[var(--accent)]"
            onClick={() => setTab(null)}
          >
            ← Todas as configurações
          </button>
          <h2 className="font-semibold">{tab}</h2>
          <div className="space-y-4">
            {tab === "Aparência" ? (
              <>
                <ThemeToggle />
                <label className="field-label" htmlFor="real-text-size">
                  Tamanho do texto
                </label>
                <select
                  id="real-text-size"
                  className="field"
                  value={settings.textSize}
                  onChange={(e) =>
                    update({
                      textSize: e.target.value as Preferences["textSize"],
                    })
                  }
                >
                  <option value="small">Pequeno</option>
                  <option value="normal">Padrão</option>
                  <option value="large">Grande</option>
                </select>
              </>
            ) : tab === "Conversas e voz" ? (
              <>
                {toggle(
                  "enterToSend",
                  "Enter envia a mensagem (Shift+Enter quebra linha)",
                )}
                {toggle(
                  "noiseSuppression",
                  "Solicitar redução de ruído ao microfone",
                )}
                <label htmlFor="real-playback" className="field-label">
                  Velocidade dos áudios
                </label>
                <select
                  id="real-playback"
                  className="field"
                  value={settings.playbackRate}
                  onChange={(e) =>
                    update({
                      playbackRate: Number(
                        e.target.value,
                      ) as Preferences["playbackRate"],
                    })
                  }
                >
                  {[1, 1.25, 1.5, 2].map((speed) => (
                    <option key={speed} value={speed}>
                      {speed}×
                    </option>
                  ))}
                </select>
              </>
            ) : tab === "Dados e armazenamento" ? (
              <>
                {toggle("dataSaver", "Economia de dados")}
                {toggle(
                  "autoImages",
                  "Carregar prévias de fotos automaticamente",
                )}
                {toggle(
                  "autoAudio",
                  "Carregar player de áudio automaticamente",
                )}
                {toggle(
                  "autoVideo",
                  "Carregar prévias de vídeos automaticamente",
                )}
                <p className="text-xs leading-relaxed text-[var(--muted)]">
                  Estas opções controlam prévias. Salvar no aparelho exige tocar
                  em baixar. Limites: fotos 5 MB; vídeos 25 MB;
                  áudios/documentos 10 MB. Uma mídia por mensagem. Limite diário
                  por pessoa: 100 MB; capacidade reservada do app: 500 MB.
                </p>
              </>
            ) : (
              <>
                {toggle("notificationsEnabled", "Ativar avisos")}
                <PushSettings />
                {toggle("inAppAlerts", "Mostrar avisos dentro do aplicativo")}
                {toggle("browserAlerts", "Mostrar notificações do navegador")}
                {toggle("messagePreview", "Mostrar conteúdo na notificação")}
                {toggle("notificationSound", "Reproduzir som")}
                {toggle(
                  "onlyWhenAway",
                  "Avisar somente fora da conversa ativa",
                )}
                <button
                  className="secondary-button w-full"
                  onClick={async () => {
                    if (
                      !window.isSecureContext ||
                      !("Notification" in window)
                    ) {
                      setNotice(
                        "Este navegador não oferece notificações nesta aba. Use os avisos internos.",
                      );
                      return;
                    }
                    try {
                      const result = await Notification.requestPermission();
                      setNotice(
                        result === "granted"
                          ? "Permissão concedida. Ative as notificações do navegador acima."
                          : "Permissão não concedida; use os avisos internos.",
                      );
                    } catch {
                      setNotice("Não foi possível solicitar a permissão.");
                    }
                  }}
                >
                  Permitir avisos do navegador
                </button>
                <button
                  className="secondary-button w-full"
                  onClick={testNotification}
                >
                  Testar notificação
                </button>
                <p className="text-xs leading-relaxed text-[var(--muted)]">
                  Avisos da aba e notificações em segundo plano têm controles
                  separados. Permissões, sons e restrições de bateria também
                  dependem do Android e do navegador.
                </p>
              </>
            )}
          </div>
        </>
      )}
      <p className="text-xs text-[var(--muted)]">
        No Android: menu ⋮ do Chrome → Instalar aplicativo ou Adicionar à tela
        inicial.
      </p>
      {notice && (
        <p role="status" className="demo-note">
          {notice}
        </p>
      )}
      <Link
        prefetch={onClose ? false : undefined}
        onClick={(e) => {
          if (onClose && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
            e.preventDefault();
            onClose();
          }
        }}
        href="/conta/chat"
        className="secondary-button w-full"
      >
        Voltar às conversas
      </Link>
    </div>
  );
}
