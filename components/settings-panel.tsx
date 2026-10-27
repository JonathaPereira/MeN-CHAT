"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Download,
  MessageCircle,
  Palette,
  ShieldCheck,
} from "lucide-react";
import { useTheme } from "next-themes";
import { ThemeToggle } from "@/components/theme-toggle";
import { usePreferences } from "@/components/preferences-provider";
import type { Preferences } from "@/lib/preferences";

type Section = "notifications" | "media" | "chat" | "appearance" | "privacy";
const sections = [
  {
    id: "privacy",
    title: "Privacidade",
    description: "Código, busca, leitura e digitação",
    icon: ShieldCheck,
  },
  {
    id: "notifications",
    title: "Notificações",
    description: "Avisos, sons, prévias e permissões",
    icon: Bell,
  },
  {
    id: "media",
    title: "Dados e armazenamento",
    description: "Download automático e prévias de mídia",
    icon: Download,
  },
  {
    id: "chat",
    title: "Conversas e voz",
    description: "Envio de mensagens, gravação e reprodução",
    icon: MessageCircle,
  },
  {
    id: "appearance",
    title: "Aparência",
    description: "Tema e tamanho do texto",
    icon: Palette,
  },
] as const;
function notificationSnapshot() {
  if (typeof window === "undefined") return "checking";
  if (!window.isSecureContext) return "insecure";
  return typeof Notification === "undefined"
    ? "unsupported"
    : Notification.permission;
}
function subscribePermission(callback: () => void) {
  window.addEventListener("focus", callback);
  window.addEventListener("mn-permission", callback);
  return () => {
    window.removeEventListener("focus", callback);
    window.removeEventListener("mn-permission", callback);
  };
}
type BooleanKey = {
  [K in keyof Preferences]: Preferences[K] extends boolean ? K : never;
}[keyof Preferences];
function Toggle({
  title,
  description,
  setting,
}: {
  title: string;
  description: string;
  setting: BooleanKey;
}) {
  const { settings, update } = usePreferences();
  return (
    <label className="setting-row">
      <span className="min-w-0 flex-1">
        <strong className="block text-sm font-medium">{title}</strong>
        <span className="mt-1 block text-xs leading-relaxed text-[var(--muted)]">
          {description}
        </span>
      </span>
      <input
        role="switch"
        aria-label={title}
        type="checkbox"
        className="setting-switch"
        checked={settings[setting]}
        onChange={(event) => update({ [setting]: event.target.checked })}
      />
    </label>
  );
}
export function SettingsPanel() {
  const [section, setSection] = useState<Section | null>(null);
  const [permissionNotice, setPermissionNotice] = useState("");
  const { settings, update, testNotification } = usePreferences();
  const { setTheme } = useTheme();
  const permission = useSyncExternalStore(
    subscribePermission,
    notificationSnapshot,
    () => "checking",
  );
  async function requestNotifications() {
    if (permission === "insecure" || permission === "unsupported") return;
    try {
      const result = await Notification.requestPermission();
      update({ browserAlerts: result === "granted" });
      setPermissionNotice(
        result === "granted"
          ? "Permissão concedida. Use o botão de teste para verificar o comportamento neste navegador."
          : "Permissão não concedida. Os avisos dentro do aplicativo continuam disponíveis.",
      );
      window.dispatchEvent(new Event("mn-permission"));
    } catch {
      setPermissionNotice(
        "Este navegador não permite ativar notificações nesta aba. Use os avisos dentro do aplicativo.",
      );
    }
  }
  return (
    <main id="conteudo" className="settings-page">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-8 flex items-center gap-3">
          {section ? (
            <button
              className="icon-button"
              aria-label="Todas as configurações"
              onClick={() => setSection(null)}
            >
              <ArrowLeft size={21} />
            </button>
          ) : (
            <Link
              href="/conversas"
              className="icon-button"
              aria-label="Voltar ao chat"
            >
              <ArrowLeft size={21} />
            </Link>
          )}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {section
                ? sections.find((item) => item.id === section)?.title
                : "Configurações"}
            </h1>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Preferências deste navegador · computador e celular
            </p>
          </div>
        </header>
        {!section ? (
          <div className="settings-group">
            {sections.map(({ id, title, description, icon: Icon }) => (
              <button
                key={id}
                className="settings-navigation"
                onClick={() => setSection(id)}
              >
                <Icon size={21} className="shrink-0 text-[var(--accent)]" />
                <span className="min-w-0 flex-1 text-left">
                  <strong className="block text-sm font-medium">{title}</strong>
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    {description}
                  </span>
                </span>
                <ChevronRight
                  size={18}
                  className="shrink-0 text-[var(--muted)]"
                />
              </button>
            ))}
          </div>
        ) : (
          <>
            {section === "privacy" && (
              <>
                <div className="settings-group">
                  <Toggle
                    title="Mostrar meu código no perfil"
                    description="Permite que os contatos vejam seu código ao abrir seu perfil. Você sempre pode ver seu próprio código."
                    setting="showUserCode"
                  />
                  <Toggle
                    title="Permitir busca pelo meu código"
                    description="Permite encontrar seu perfil a partir de um código já conhecido. Ocultar o código no perfil não desativa esta opção."
                    setting="allowCodeLookup"
                  />
                  <Toggle
                    title="Confirmações de leitura"
                    description="Na demonstração, permite ver confirmações de leitura e simula seu compartilhamento. Desativado, os detalhes ficam ocultos em conversas privadas e grupos."
                    setting="readReceipts"
                  />
                  <Toggle
                    title="Indicadores de digitação"
                    description="Mostra quem está digitando, com avatar. Os indicadores desta versão são uma simulação local."
                    setting="showTyping"
                  />
                </div>
                <p className="demo-note mt-5">
                  Estas preferências preparam a interface. Convites de uso
                  único, validação de e-mail e privacidade entre contas reais
                  ainda dependem da integração com o servidor. Não há outras
                  pessoas conectadas.
                </p>
              </>
            )}
            {section === "notifications" && (
              <>
                <div className="settings-group">
                  <Toggle
                    title="Receber notificações"
                    description="Controle geral dos avisos de novas mensagens de teste."
                    setting="notificationsEnabled"
                  />
                  <Toggle
                    title="Avisos dentro do aplicativo"
                    description="Mostra um aviso temporário enquanto esta aba estiver aberta."
                    setting="inAppAlerts"
                  />
                  <Toggle
                    title="Som de notificação"
                    description="Toque curto após você interagir com a página. O navegador ou o modo silencioso do aparelho pode bloquear o som."
                    setting="notificationSound"
                  />
                  <Toggle
                    title="Mostrar prévia da mensagem"
                    description="Exibe o texto nos avisos. Desativado, mostra apenas que chegou uma mensagem."
                    setting="messagePreview"
                  />
                  <Toggle
                    title="Somente fora da conversa ativa"
                    description="Evita avisos enquanto você já está lendo a conversa e a aba está visível."
                    setting="onlyWhenAway"
                  />
                </div>
                <section className="settings-group mt-5 p-5">
                  <h2 className="text-sm font-semibold">Bolas de neve</h2>
                  <Toggle
                    title="Avisos de bola de neve"
                    description="Avisa mesmo na conversa ativa. Respeita o controle geral e o silenciamento da conversa."
                    setting="snowballAlerts"
                  />
                  <Toggle
                    title="Vibração adicional"
                    description="Um toque duplo ao receber uma bola de neve, se o aparelho e o navegador suportarem. iPhone/Safari não oferece esta API."
                    setting="snowballVibration"
                  />
                  <Toggle
                    title="Animação de bola de neve"
                    description="Efeito curto na conversa. Respeita a preferência do aparelho de reduzir movimento."
                    setting="snowballEffects"
                  />
                  <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
                    No teste, jogar mostra uma prévia local do recebimento. Não
                    há envio entre aparelhos nem push com o app fechado. A
                    vibração pode ser bloqueada pelo navegador ou aparelho e não
                    é garantida em segundo plano.
                  </p>
                </section>
                <section className="settings-group mt-5 p-5">
                  <h2 className="text-sm font-semibold">
                    Notificações do navegador
                  </h2>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
                    Permissão:{" "}
                    {
                      (
                        {
                          checking: "verificando…",
                          insecure: "exige HTTPS ou localhost",
                          unsupported: "indisponível neste navegador",
                          default: "ainda não solicitada",
                          granted: "concedida",
                          denied: "bloqueada nas configurações do navegador",
                        } as Record<string, string>
                      )[permission]
                    }
                  </p>
                  {permission === "granted" ? (
                    <Toggle
                      title="Avisos do sistema"
                      description="Tenta mostrar notificações com esta aba aberta. O suporte varia no celular."
                      setting="browserAlerts"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={requestNotifications}
                      disabled={[
                        "checking",
                        "insecure",
                        "unsupported",
                        "denied",
                      ].includes(permission)}
                      className="secondary-button mt-4"
                    >
                      Permitir avisos do navegador
                    </button>
                  )}
                  {permission === "insecure" && (
                    <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
                      No celular pelo IP do Windows em HTTP, use os avisos
                      dentro do aplicativo. Notificações do sistema precisam de
                      uma conexão segura.
                    </p>
                  )}
                  <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
                    Não há push com o aplicativo ou a aba fechados nesta
                    demonstração. Alguns navegadores móveis exigem um PWA
                    instalado para notificações do sistema.
                  </p>
                  {permissionNotice && (
                    <p
                      role="status"
                      className="mt-3 text-xs text-[var(--accent)]"
                    >
                      {permissionNotice}
                    </p>
                  )}
                </section>
                <button
                  type="button"
                  className="primary-button mt-5"
                  onClick={testNotification}
                >
                  <Bell size={17} />
                  Testar notificação
                </button>
                <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
                  O teste mostra uma prévia aqui. Nas conversas, os filtros e o
                  silenciamento são respeitados. O menu de cada conversa permite
                  silenciá-la individualmente.
                </p>
              </>
            )}
            {section === "media" && (
              <>
                <p className="mb-5 text-sm leading-relaxed text-[var(--muted)]">
                  Download automático significa carregar a prévia na conversa.
                  Salvar um arquivo na pasta de downloads continua sendo uma
                  ação manual. Neste protótipo, todos os arquivos já são locais
                  e não há tráfego de upload.
                </p>
                <div className="settings-group">
                  <Toggle
                    title="Economia de dados"
                    description="Exige um toque para carregar fotos, vídeos e áudios, mesmo se as opções abaixo estiverem ativas."
                    setting="dataSaver"
                  />
                  <Toggle
                    title="Fotos automaticamente"
                    description="Abre a prévia das imagens na conversa."
                    setting="autoImages"
                  />
                  <Toggle
                    title="Vídeos automaticamente"
                    description="Carrega o player e os metadados. O vídeo só toca quando você apertar play."
                    setting="autoVideo"
                  />
                  <Toggle
                    title="Áudios automaticamente"
                    description="Mostra o player para ouvir antes de baixar. Nunca começa a tocar sozinho."
                    setting="autoAudio"
                  />
                </div>
                <p className="demo-note mt-5">
                  Limites atuais: fotos 5 MB, vídeos 25 MB, áudios/documentos 10
                  MB; até 5 anexos por mensagem. Não há download automático de
                  documentos nem gravação automática em disco.
                </p>
              </>
            )}
            {section === "chat" && (
              <>
                <div className="settings-group">
                  <Toggle
                    title="Enter para enviar"
                    description="Ativado: Enter envia e Shift+Enter quebra a linha. Desativado: Enter quebra a linha; envie pelo botão."
                    setting="enterToSend"
                  />
                  <Toggle
                    title="Solicitar redução de ruído"
                    description="Solicita ao microfone a redução de ruído e de eco. O suporte depende do aparelho e do navegador."
                    setting="noiseSuppression"
                  />
                  <label className="setting-row">
                    <span className="flex-1 text-sm">
                      Velocidade dos áudios
                    </span>
                    <select
                      aria-label="Velocidade dos áudios"
                      className="settings-select"
                      value={settings.playbackRate}
                      onChange={(event) =>
                        update({
                          playbackRate: Number(
                            event.target.value,
                          ) as Preferences["playbackRate"],
                        })
                      }
                    >
                      {[1, 1.25, 1.5, 2].map((rate) => (
                        <option key={rate} value={rate}>
                          {rate}×
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="demo-note mt-5">
                  Toque no microfone para começar e na seta para enviar. Ouvir
                  antes é opcional. Grave até 2 minutos por áudio. O microfone
                  só é solicitado ao iniciar a gravação e é liberado ao parar ou
                  sair. A gravação exige HTTPS ou localhost; no Wi-Fi em HTTP,
                  você ainda pode anexar um áudio do aparelho.
                </p>
              </>
            )}
            {section === "appearance" && (
              <div className="settings-group p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-medium">Tema</h2>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Claro ou escuro, como preferir.
                    </p>
                  </div>
                  <ThemeToggle />
                </div>
                <button
                  type="button"
                  className="secondary-button mt-4"
                  onClick={() => setTheme("system")}
                >
                  Usar tema do sistema
                </button>
                <label className="setting-row mt-4">
                  <span className="text-sm">Tamanho do texto no chat</span>
                  <select
                    aria-label="Tamanho do texto no chat"
                    className="settings-select"
                    value={settings.textSize}
                    onChange={(event) =>
                      update({
                        textSize: event.target.value as Preferences["textSize"],
                      })
                    }
                  >
                    <option value="small">Pequeno</option>
                    <option value="normal">Padrão</option>
                    <option value="large">Grande</option>
                  </select>
                </label>
              </div>
            )}
          </>
        )}
        <p className="mt-8 text-center text-xs leading-relaxed text-[var(--muted)]">
          Preferências salvas apenas neste navegador. Não são sincronizadas
          entre o Windows e o celular.
        </p>
      </div>
    </main>
  );
}
