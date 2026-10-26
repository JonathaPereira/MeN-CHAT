"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Check, Paperclip, X } from "lucide-react";
import { usePreferences } from "@/components/preferences-provider";
import { createDemoId } from "@/lib/demo-id";

const MAX_SECONDS = 120;
const MAX_BYTES = 10_000_000;
const supportedTypes = [
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/webm",
];
export function VoiceRecorder({
  onAttach,
  onClose,
  onChooseFile,
}: {
  onAttach: (file: File) => void;
  onClose: () => void;
  onChooseFile: () => void;
}) {
  const { settings } = usePreferences();
  const [phase, setPhase] = useState<
    "idle" | "requesting" | "recording" | "preview"
  >("idle");
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(
    null,
  );
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(false);
  const generation = useRef(0);
  const previewUrl = useRef<string | null>(null);
  function clearTimers() {
    if (interval.current) clearInterval(interval.current);
    if (timeout.current) clearTimeout(timeout.current);
  }
  function stopTracks() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      clearTimers();
      const current = recorder.current;
      if (current) {
        current.onstop = null;
        current.onerror = null;
        current.ondataavailable = null;
        if (current.state !== "inactive") current.stop();
      }
      stopTracks();
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);
  function stop() {
    const current = recorder.current;
    if (current && current.state !== "inactive") current.stop();
    clearTimers();
    stopTracks();
  }
  async function start() {
    setError("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError(
        "A gravação exige HTTPS ou localhost. Pelo Wi-Fi em HTTP, anexe um áudio do aparelho.",
      );
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setError(
        "Este navegador não oferece gravação de áudio. Você ainda pode anexar um arquivo de áudio.",
      );
      return;
    }
    setPhase("requesting");
    const attempt = ++generation.current;
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: settings.noiseSuppression,
          noiseSuppression: settings.noiseSuppression,
        },
        video: false,
      });
      if (!active.current || attempt !== generation.current) {
        acquired.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = acquired;
      const type = supportedTypes.find((mime) =>
        MediaRecorder.isTypeSupported(mime),
      );
      const current = type
        ? new MediaRecorder(acquired, { mimeType: type })
        : new MediaRecorder(acquired);
      recorder.current = current;
      const chunks: Blob[] = [];
      let size = 0;
      let tooLarge = false;
      let failed = false;
      current.ondataavailable = (event) => {
        if (event.data.size) {
          size += event.data.size;
          chunks.push(event.data);
          if (size > MAX_BYTES && current.state !== "inactive") {
            tooLarge = true;
            current.stop();
          }
        }
      };
      current.onerror = () => {
        if (!active.current || attempt !== generation.current) return;
        failed = true;
        clearTimers();
        stopTracks();
        if (active.current) {
          setError(
            "A gravação foi interrompida pelo navegador. Tente novamente ou anexe um áudio.",
          );
          setPhase("idle");
        }
      };
      current.onstop = () => {
        clearTimers();
        stopTracks();
        if (!active.current || attempt !== generation.current || failed) return;
        if (tooLarge || size > MAX_BYTES) {
          setError("O áudio excedeu 10 MB. Grave um trecho menor.");
          setPhase("idle");
          return;
        }
        if (!size) {
          setError(
            "Nenhum áudio foi capturado. Confira o microfone e tente novamente.",
          );
          setPhase("idle");
          return;
        }
        const mime = (
          current.mimeType ||
          chunks[0]?.type ||
          "audio/webm"
        ).split(";")[0];
        const extension =
          mime === "audio/mp4" ? "m4a" : mime === "audio/ogg" ? "ogg" : "webm";
        const file = new File(
          chunks,
          `audio-${createDemoId().slice(0, 8)}.${extension}`,
          { type: mime },
        );
        if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
        const url = URL.createObjectURL(file);
        previewUrl.current = url;
        setPreview({ file, url });
        setPhase("preview");
      };
      current.start(250);
      setSeconds(0);
      setPhase("recording");
      const started = Date.now();
      interval.current = setInterval(
        () =>
          setSeconds(
            Math.min(MAX_SECONDS, Math.floor((Date.now() - started) / 1000)),
          ),
        250,
      );
      timeout.current = setTimeout(stop, MAX_SECONDS * 1000);
    } catch (caught) {
      stopTracks();
      if (!active.current || attempt !== generation.current) return;
      setPhase("idle");
      setError(
        caught instanceof DOMException && caught.name === "NotAllowedError"
          ? "Permissão do microfone negada. Você pode liberá-la nas configurações do navegador ou anexar um áudio."
          : "Não foi possível acessar o microfone. Confira se está conectado e disponível.",
      );
    }
  }
  return (
    <section className="voice-recorder" aria-label="Gravador de áudio">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Mensagem de voz</h3>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Fechar gravação"
        >
          <X size={17} />
        </button>
      </div>
      {phase === "idle" && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="primary-button" onClick={start}>
            <Mic size={18} />
            Iniciar gravação
          </button>
          <span className="text-xs text-[var(--muted)]">
            Até 2 minutos · microfone só após sua permissão
          </span>
        </div>
      )}
      {phase === "requesting" && (
        <p role="status" className="text-sm text-[var(--muted)]">
          Aguardando permissão do microfone… Você pode cancelar fechando esta
          janela.
        </p>
      )}
      {phase === "recording" && (
        <div className="flex items-center justify-between gap-3">
          <p role="status" className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Gravando · {Math.floor(seconds / 60)}:
            {String(seconds % 60).padStart(2, "0")}
          </p>
          <button type="button" className="secondary-button" onClick={stop}>
            <Square size={15} />
            Parar e ouvir
          </button>
        </div>
      )}
      {phase === "preview" && preview && (
        <>
          <audio
            src={preview.url}
            controls
            className="w-full"
            aria-label="Ouvir gravação antes de enviar"
          />
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              <Trash2 size={16} />
              Descartar áudio
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                onAttach(preview.file);
                onClose();
              }}
            >
              <Check size={17} />
              Anexar gravação
            </button>
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">
            O áudio será anexado à mensagem. Use o botão de envio quando estiver
            pronto.
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="form-error mt-3">
          {error}
        </p>
      )}
      {(phase === "idle" || error) && (
        <button
          type="button"
          className="mt-3 inline-flex min-h-11 items-center gap-2 text-xs text-[var(--accent)]"
          onClick={onChooseFile}
        >
          <Paperclip size={15} />
          Escolher áudio do aparelho
        </button>
      )}
    </section>
  );
}
