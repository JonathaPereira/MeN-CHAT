"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Video, Square, ImagePlus } from "lucide-react";
import { Modal } from "@/components/modal";
export function CameraDialog({
  onClose,
  onCapture,
}: {
  onClose: () => void;
  onCapture: (file: File) => void;
}) {
  const preview = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    recorder = useRef<MediaRecorder | null>(null),
    active = useRef(true),
    recordingRef = useRef(false),
    limit = useRef<ReturnType<typeof setTimeout> | null>(null),
    input = useRef<HTMLInputElement>(null),
    generation = useRef(0);
  const [ready, setReady] = useState(false),
    [recording, setRecording] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function stopTracks() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (limit.current) clearTimeout(limit.current);
      const r = recorder.current;
      if (r) {
        r.onstop = null;
        r.ondataavailable = null;
        r.onerror = null;
        if (r.state !== "inactive") r.stop();
      }
      stopTracks();
    };
  }, []);
  async function start() {
    const attempt = ++generation.current;
    setBusy(true);
    setError("");
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "A câmera exige HTTPS e um navegador compatível. Use escolher do aparelho.",
        );
      const acquired = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      if (!active.current || attempt !== generation.current) {
        acquired.getTracks().forEach((t) => t.stop());
        return;
      }
      stopTracks();
      stream.current = acquired;
      if (preview.current) {
        preview.current.srcObject = acquired;
        await preview.current.play();
      }
      setReady(true);
    } catch {
      stopTracks();
      if (active.current) setReady(false);
      if (active.current)
        setError(
          "Não foi possível abrir a câmera. Confira a permissão ou escolha do aparelho.",
        );
    } finally {
      if (active.current) setBusy(false);
    }
  }
  async function photo() {
    const video = preview.current;
    if (!video?.videoWidth) return;
    setBusy(true);
    try {
      const ratio = Math.min(
          1,
          2048 / Math.max(video.videoWidth, video.videoHeight),
        ),
        canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * ratio);
      canvas.height = Math.round(video.videoHeight * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error();
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.85),
      );
      if (!active.current) return;
      if (!blob || blob.size > 5_000_000) throw new Error();
      onCapture(
        new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" }),
      );
      onClose();
    } catch {
      setError("Não foi possível capturar a foto. Tente novamente.");
    } finally {
      if (active.current) setBusy(false);
    }
  }
  async function film() {
    if (!stream.current || recordingRef.current) return;
    setBusy(true);
    setError("");
    const attempt = ++generation.current;
    try {
      if (typeof MediaRecorder === "undefined") throw new Error();
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (!active.current || attempt !== generation.current) {
        mic.getTracks().forEach((t) => t.stop());
        return;
      }
      const combined = new MediaStream([
        ...stream.current.getVideoTracks(),
        ...mic.getAudioTracks(),
      ]);
      stream.current = combined;
      const mime = [
        "video/webm;codecs=vp8,opus",
        "video/mp4",
        "video/webm",
      ].find((v) => MediaRecorder.isTypeSupported(v));
      const r = mime
        ? new MediaRecorder(combined, {
            mimeType: mime,
            videoBitsPerSecond: 1_000_000,
          })
        : new MediaRecorder(combined);
      recorder.current = r;
      const chunks: Blob[] = [];
      let bytes = 0,
        tooLarge = false,
        failed = false;
      r.ondataavailable = (e) => {
        if (e.data.size) {
          chunks.push(e.data);
          bytes += e.data.size;
          if (bytes > 25_000_000 && r.state === "recording") {
            tooLarge = true;
            r.stop();
          }
        }
      };
      r.onstop = () => {
        recordingRef.current = false;
        if (limit.current) clearTimeout(limit.current);
        stopTracks();
        if (!active.current || failed) return;
        setReady(false);
        setRecording(false);
        if (tooLarge || bytes > 25_000_000 || !bytes) {
          setError(
            "O vídeo ficou vazio ou ultrapassou 25 MB. Grave um trecho menor.",
          );
          return;
        }
        const type = (r.mimeType || "video/webm").split(";")[0];
        onCapture(
          new File(
            chunks,
            `video-${Date.now()}.${type === "video/mp4" ? "mp4" : "webm"}`,
            { type },
          ),
        );
        onClose();
      };
      r.onerror = () => {
        failed = true;
        stopTracks();
        recordingRef.current = false;
        if (limit.current) clearTimeout(limit.current);
        if (active.current) {
          setRecording(false);
          setReady(false);
          setError("A gravação foi interrompida. Tente novamente.");
        }
      };
      r.start(250);
      recordingRef.current = true;
      setRecording(true);
      limit.current = setTimeout(() => {
        if (r.state === "recording") r.stop();
      }, 120_000);
    } catch {
      stopTracks();
      if (active.current) setReady(false);
      if (active.current)
        setError(
          "Para gravar vídeo, permita câmera e microfone. Você pode escolher um vídeo do aparelho.",
        );
    } finally {
      if (active.current) setBusy(false);
    }
  }
  return (
    <Modal title="Câmera" onClose={onClose}>
      <div className="space-y-4">
        <video
          ref={preview}
          muted
          playsInline
          className="camera-preview"
          aria-label="Prévia da câmera"
        />
        <p className="text-xs text-[var(--muted)]">
          Fotos até 5 MB. Vídeo com som até 2 minutos/25 MB. Você confere o
          anexo antes de enviar.
        </p>
        {!ready ? (
          <button
            className="primary-button w-full"
            disabled={busy}
            onClick={() => void start()}
          >
            Abrir câmera
          </button>
        ) : (
          <div className="flex flex-wrap gap-2">
            {recording ? (
              <button
                className="primary-button"
                onClick={() => {
                  if (recorder.current?.state === "recording")
                    recorder.current.stop();
                }}
              >
                <Square size={18} /> Concluir vídeo
              </button>
            ) : (
              <>
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => void photo()}
                >
                  <Camera size={18} /> Tirar foto
                </button>
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => void film()}
                >
                  <Video size={18} /> Gravar vídeo
                </button>
              </>
            )}
          </div>
        )}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
          className="sr-only"
          aria-label="Escolher foto ou vídeo do aparelho"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) {
              onCapture(file);
              onClose();
            }
          }}
        />
        <button
          className="secondary-button w-full"
          disabled={recording || busy}
          onClick={() => input.current?.click()}
        >
          <ImagePlus size={18} /> Escolher do aparelho
        </button>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
