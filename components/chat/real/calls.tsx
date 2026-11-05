"use client";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
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
}: {
  stream: MediaStream;
  muted?: boolean;
  hidden?: boolean;
}) {
  const element = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = element.current;
    if (!video) return;
    video.srcObject = stream;
    void video.play().catch(() => {});
    return () => {
      video.pause();
      video.srcObject = null;
    };
  }, [stream]);
  return (
    <video
      ref={element}
      autoPlay
      playsInline
      muted={muted}
      className={
        hidden
          ? "sr-only"
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
    [choose, setChoose] = useState(false);
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {view?.local && (
                  <div className="rounded-2xl bg-[var(--surface-soft)] p-2">
                    {row.video && view.video ? (
                      <CallVideo stream={view.local} muted />
                    ) : (
                      <div className="p-6 text-center">
                        Você{view.mic ? "" : " · microfone desligado"}
                      </div>
                    )}
                  </div>
                )}
                {view?.active?.members
                  .filter((member) => member.id !== actor)
                  .map((member) => (
                    <div
                      key={member.id}
                      className="rounded-2xl border border-[var(--line)] p-3"
                    >
                      {view.streams.has(member.id) && (
                        <CallVideo
                          stream={view.streams.get(member.id)!}
                          hidden={!row.video || !member.video}
                        />
                      )}
                      {(!row.video || !member.video) && (
                        <RealAvatar
                          client={client}
                          path={member.avatar}
                          name={member.name}
                        />
                      )}
                      <p className="mt-2 text-sm">
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
                  ))}
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
