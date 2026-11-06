"use client";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import {
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  SwitchCamera,
  X,
} from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CallClient, type CallView } from "@/lib/calls/client";
import { Modal } from "@/components/modal";
import { RealAvatar } from "./avatar";
import { usePreferences } from "@/components/preferences-provider";
function CallVideo({
  stream,
  muted = false,
  hidden = false,
  maximized = false,
}: {
  stream: MediaStream;
  muted?: boolean;
  hidden?: boolean;
  maximized?: boolean;
}) {
  const element = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = element.current;
    if (!video) return;
    video.muted = muted;
    video.defaultMuted = muted;
    video.srcObject = stream;
    void video.play().catch(() => {});
    return () => {
      video.pause();
      video.srcObject = null;
    };
  }, [stream, muted]);
  return (
    <video
      ref={element}
      autoPlay
      playsInline
      muted={muted}
      className={
        hidden
          ? "sr-only"
          : maximized
            ? "max-h-[70vh] min-h-[280px] w-full rounded-2xl bg-black object-contain"
            : "aspect-video w-full rounded-2xl bg-black object-contain"
      }
    />
  );
}
export function CallControls({
  client,
  actor,
  thread,
  anchor,
  onCovered,
}: {
  client: SupabaseClient;
  actor: string;
  thread: string | null;
  anchor: HTMLElement | null;
  onCovered: (value: boolean) => void;
}) {
  const { settings } = usePreferences(),
    settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  const [manager, setManager] = useState<CallClient | null>(null),
    [view, setView] = useState<CallView | null>(null),
    [expanded, setExpanded] = useState(true),
    [choose, setChoose] = useState(false),
    [maximized, setMaximized] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const controller = new CallClient(
      client,
      actor,
      (value) => {
        if (active) setView(value);
      },
      () => {
        if (
          settingsRef.current.notificationsEnabled &&
          settingsRef.current.notificationSound
        )
          void new Audio("/audio/menchat-ping.wav").play().catch(() => {});
      },
    );
    setManager(controller);
    void controller.initialize();
    return () => {
      active = false;
      controller.destroy();
    };
  }, [client, actor]);
  const displayed = choose || !!view?.incoming || (!!view?.active && expanded);
  useEffect(() => {
    onCovered(displayed);
    return () => onCovered(false);
  }, [displayed, onCovered]);
  const row = view?.active || view?.incoming;
  const others =
    view?.active?.members.filter((member) => member.id !== actor) ?? [];
  const activeMaximized =
    row && !view?.incoming && row.video
      ? maximized === "self" && view?.video && view?.local
        ? "self"
        : others.some(
              (member) =>
                member.id === maximized &&
                member.state === "joined" &&
                member.video,
            )
          ? maximized
          : null
      : null;
  return (
    <>
      {thread &&
        anchor &&
        createPortal(
          <span className="flex shrink-0 items-center gap-1">
            <button
              className="icon-button sm:hidden"
              aria-label="Chamar contato"
              title={
                view?.ready
                  ? "Chamar"
                  : "Chamadas aguardam configuração do administrador"
              }
              disabled={!view?.ready || view.busy || !!view.active}
              onClick={() => setChoose(true)}
            >
              <Phone size={18} />
            </button>
            <button
              className="icon-button hidden sm:inline-flex"
              aria-label="Iniciar chamada de voz"
              title={
                view?.ready
                  ? "Chamada de voz"
                  : "Chamadas aguardam configuração do administrador"
              }
              disabled={!view?.ready || view.busy || !!view.active}
              onClick={() => {
                setExpanded(true);
                setMaximized(null);
                void manager?.start(thread, false);
              }}
            >
              <Phone size={18} />
            </button>
            <button
              className="icon-button hidden sm:inline-flex"
              aria-label="Iniciar chamada de vídeo"
              title={
                view?.ready
                  ? "Chamada de vídeo"
                  : "Chamadas aguardam configuração do administrador"
              }
              disabled={!view?.ready || view.busy || !!view.active}
              onClick={() => {
                setExpanded(true);
                setMaximized(null);
                void manager?.start(thread, true);
              }}
            >
              <Video size={18} />
            </button>
          </span>,
          anchor,
        )}
      {choose && thread && (
        <Modal title="Iniciar chamada" onClose={() => setChoose(false)}>
          <div className="space-y-3">
            <button
              className="primary-button w-full"
              onClick={() => {
                setChoose(false);
                setExpanded(true);
                setMaximized(null);
                void manager?.start(thread, false);
              }}
            >
              Chamada de voz
            </button>
            <button
              className="secondary-button w-full"
              onClick={() => {
                setChoose(false);
                setExpanded(true);
                setMaximized(null);
                void manager?.start(thread, true);
              }}
            >
              Chamada de vídeo
            </button>
          </div>
        </Modal>
      )}
      {view?.active && !expanded && (
        <button className="app-install" onClick={() => setExpanded(true)}>
          Chamada em andamento · Abrir
        </button>
      )}
      {row && displayed && (
        <Modal
          title={row.video ? "Chamada de vídeo" : "Chamada de voz"}
          onClose={() => {
            if (view?.incoming) void manager?.decline();
            else setExpanded(false);
          }}
        >
          {view?.incoming ? (
            <div className="space-y-4">
              <p>
                Você está recebendo uma chamada
                {row.video ? " de vídeo" : " de voz"}.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  className="primary-button"
                  disabled={view.busy}
                  onClick={() => {
                    setExpanded(true);
                    setMaximized(null);
                    void manager?.accept();
                  }}
                >
                  <Phone size={18} />
                  Atender
                </button>
                <button
                  className="secondary-button"
                  onClick={() => void manager?.decline()}
                >
                  <PhoneOff size={18} />
                  Recusar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-[var(--muted)]">
                {row.state === "ringing" ? "Chamando…" : "Em chamada"} · até 4
                pessoas
              </p>
              <div
                className={
                  activeMaximized
                    ? "grid grid-cols-1 gap-3"
                    : "grid grid-cols-1 gap-3 sm:grid-cols-2"
                }
              >
                {view?.local && (
                  <div
                    className={
                      activeMaximized && activeMaximized !== "self"
                        ? "sr-only"
                        : "rounded-2xl bg-[var(--surface-soft)] p-2"
                    }
                  >
                    {row.video && view.video ? (
                      <div className="space-y-2">
                        <CallVideo
                          stream={view.local}
                          muted
                          hidden={
                            !!activeMaximized && activeMaximized !== "self"
                          }
                          maximized={activeMaximized === "self"}
                        />
                        <div className="flex items-center justify-between gap-2 px-1">
                          <span className="text-sm">
                            Você{view.mic ? "" : " · microfone desligado"}
                          </span>
                          <button
                            type="button"
                            className="secondary-button text-xs"
                            onClick={() =>
                              setMaximized(
                                activeMaximized === "self" ? null : "self",
                              )
                            }
                          >
                            {activeMaximized === "self" ? (
                              <>
                                <Minimize2 size={14} />
                                Restaurar tela
                              </>
                            ) : (
                              <>
                                <Maximize2 size={14} />
                                Maximizar minha tela
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 text-center">
                        Você{view.mic ? "" : " · microfone desligado"}
                      </div>
                    )}
                  </div>
                )}
                {others.map((member) => {
                  const isMemberMax = activeMaximized === member.id;
                  const hideCard = !!activeMaximized && !isMemberMax;
                  return (
                    <div
                      key={member.id}
                      className={
                        hideCard
                          ? "sr-only"
                          : "rounded-2xl border border-[var(--line)] p-3"
                      }
                    >
                      {view?.streams.has(member.id) && (
                        <CallVideo
                          stream={view.streams.get(member.id)!}
                          hidden={!row.video || !member.video || hideCard}
                          maximized={isMemberMax}
                        />
                      )}
                      {(!row.video || !member.video) && !hideCard && (
                        <RealAvatar
                          client={client}
                          path={member.avatar}
                          name={member.name}
                        />
                      )}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm">
                            {member.name}
                            {!member.mic ? " · sem microfone" : ""}
                          </p>
                          <p className="text-xs text-[var(--muted)]">
                            {member.state === "joined"
                              ? "Na chamada"
                              : member.state === "invited"
                                ? "Chamando…"
                                : "Indisponível"}
                          </p>
                        </div>
                        {row.video &&
                          member.video &&
                          member.state === "joined" && (
                            <button
                              type="button"
                              className="secondary-button text-xs"
                              onClick={() =>
                                setMaximized(isMemberMax ? null : member.id)
                              }
                            >
                              {isMemberMax ? (
                                <>
                                  <Minimize2 size={14} />
                                  Restaurar tela
                                </>
                              ) : (
                                <>
                                  <Maximize2 size={14} />
                                  Maximizar tela de {member.name}
                                </>
                              )}
                            </button>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  className="secondary-button"
                  onClick={() => manager?.mute()}
                >
                  {view?.mic ? <Mic size={18} /> : <MicOff size={18} />}
                  {view?.mic ? "Silenciar" : "Ativar microfone"}
                </button>
                {row.video && (
                  <>
                    <button
                      className="secondary-button"
                      onClick={() => manager?.camera()}
                    >
                      {view?.video ? (
                        <Video size={18} />
                      ) : (
                        <VideoOff size={18} />
                      )}
                      {view?.video ? "Desligar câmera" : "Ligar câmera"}
                    </button>
                    <button
                      className="secondary-button"
                      disabled={!view?.video}
                      onClick={() => void manager?.switchCamera()}
                    >
                      <SwitchCamera size={18} />
                      Alternar câmera
                    </button>
                  </>
                )}
                <button
                  className="primary-button"
                  onClick={() => void manager?.end()}
                >
                  <PhoneOff size={18} />
                  Encerrar
                </button>
              </div>
            </div>
          )}
          {view?.error && (
            <p role="status" className="demo-note mt-4">
              {view.error}
            </p>
          )}
        </Modal>
      )}
      {view?.error && !row && (
        <div role="alert" className="app-network-notice">
          {view.error}
          <button
            className="ml-3"
            aria-label="Fechar aviso de chamada"
            onClick={() => manager?.clearError()}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
