"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Send } from "lucide-react";
import { usePreferences } from "@/components/preferences-provider";
import { createDemoId } from "@/lib/demo-id";
import { attachmentPolicy } from "@/lib/attachments";

const MAX_SECONDS = 120;
const supportedTypes = [
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/webm",
];
type Phase = "idle" | "requesting" | "recording" | "processing" | "preview";
type Intent = "send" | "preview";

export function VoiceRecorder({
  onSend,
  onBusyChange,
  onError,
}: {
  onSend: (file: File) => void;
  onBusyChange: (busy: boolean) => void;
  onError: (message: string) => void;
}) {
  const { settings } = usePreferences();
  const [phase, setPhase] = useState<Phase>("idle");
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
  const intent = useRef<Intent>("preview");
  const previewUrl = useRef<string | null>(null);
  function clearTimers() {
    if (interval.current) clearInterval(interval.current);
    if (timeout.current) clearTimeout(timeout.current);
  }
  function stopTracks() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }
  function releasePreview() {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
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
      releasePreview();
    };
  }, []);
  function reset() {
    releasePreview();
    setPreview(null);
    setPhase("idle");
    onBusyChange(false);
    recorder.current = null;
  }
  function cancel() {
    generation.current++;
    const current = recorder.current;
    if (current) {
      current.onstop = null;
      current.ondataavailable = null;
      current.onerror = null;
      if (current.state !== "inactive") current.stop();
    }
    clearTimers();
    stopTracks();
    reset();
    onError("");
  }
  function finish(nextIntent: Intent) {
    const current = recorder.current;
    if (!current || current.state === "inactive") return;
    intent.current = nextIntent;
    setPhase("processing");
    current.stop();
    clearTimers();
    stopTracks();
  }
  async function start() {
    onError("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      onError(
        "A gravação exige HTTPS ou localhost. Pelo Wi-Fi em HTTP, anexe um áudio do aparelho.",
      );
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      onError(
        "Este navegador não oferece gravação de áudio. Você ainda pode anexar um arquivo de áudio.",
      );
      return;
    }
    setPhase("requesting");
    onBusyChange(true);
    const attempt = ++generation.current;
    intent.current = "preview";
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
        if (!event.data.size) return;
        size += event.data.size;
        chunks.push(event.data);
        if (
          size > attachmentPolicy.audio.limit &&
          current.state !== "inactive"
        ) {
          tooLarge = true;
          current.stop();
        }
      };
      current.onerror = () => {
        if (!active.current || attempt !== generation.current) return;
        failed = true;
        clearTimers();
        stopTracks();
        reset();
        onError(
          "A gravação foi interrompida. Tente novamente ou anexe um áudio.",
        );
      };
      current.onstop = () => {
        clearTimers();
        stopTracks();
        if (!active.current || attempt !== generation.current || failed) return;
        if (tooLarge || size > attachmentPolicy.audio.limit) {
          reset();
          onError("O áudio excedeu 10 MB. Grave um trecho menor.");
          return;
        }
        if (!size) {
          reset();
          onError(
            "Nenhum áudio foi capturado. Confira o microfone e tente novamente.",
          );
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
        if (intent.current === "send") {
          onSend(file);
          reset();
          return;
        }
        releasePreview();
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
      timeout.current = setTimeout(() => finish("preview"), MAX_SECONDS * 1000);
    } catch (caught) {
      if (!active.current || attempt !== generation.current) return;
      stopTracks();
      reset();
      onError(
        caught instanceof DOMException && caught.name === "NotAllowedError"
          ? "Permissão do microfone negada. Libere nas configurações do navegador ou anexe um áudio."
          : "Não foi possível acessar o microfone. Confira se está conectado e disponível.",
      );
    }
  }
  if (phase === "idle")
    return (
      <button
        type="button"
        className="icon-button voice-mic shrink-0"
        aria-label="Gravar mensagem de voz"
        title="Gravar áudio"
        onClick={start}
      >
        <Mic size={22} />
      </button>
    );
  return (
    <div
      className="voice-controls"
      role="region"
      aria-label="Gravador de áudio"
    >
      {phase === "preview" && preview ? (
        <audio
          src={preview.url}
          controls
          onLoadedMetadata={(event) => {
            event.currentTarget.playbackRate = settings.playbackRate;
          }}
          className="voice-preview"
          aria-label="Ouvir gravação antes de enviar"
        />
      ) : (
        <p role="status" className="voice-status">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${phase === "recording" ? "bg-red-500" : "bg-[var(--muted)]"}`}
          />
          {phase === "recording"
            ? `Gravando · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
            : phase === "requesting"
              ? "Aguardando microfone…"
              : "Preparando áudio…"}
        </p>
      )}
      <div className="voice-actions">
        <button
          type="button"
          className="icon-button shrink-0"
          aria-label="Descartar áudio"
          title="Descartar"
          onClick={cancel}
        >
          <Trash2 size={19} />
        </button>
        {phase === "recording" && (
          <button
            type="button"
            className="icon-button shrink-0"
            aria-label="Parar e ouvir"
            title="Ouvir antes de enviar (opcional)"
            onClick={() => finish("preview")}
          >
            <Square size={17} />
          </button>
        )}
        <button
          type="button"
          className="send-button shrink-0"
          aria-label="Enviar áudio"
          title="Enviar áudio"
          disabled={phase !== "recording" && phase !== "preview"}
          onClick={() => {
            if (phase === "preview" && preview) {
              onSend(preview.file);
              reset();
            } else finish("send");
          }}
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
