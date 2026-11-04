"use client";
import { useRef, useState, useEffect } from "react";
import { Play, Pause } from "lucide-react";
function time(value: number) {
  if (!Number.isFinite(value)) return "0:00";
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
}
export function AudioPlayer({
  url,
  rate,
  onExpired,
}: {
  url: string;
  rate: number;
  onExpired: () => Promise<string | null>;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false),
    [current, setCurrent] = useState(0),
    [duration, setDuration] = useState(0),
    [error, setError] = useState("");
  const refreshing = useRef(false);
  const checking = useRef<AbortController | null>(null);
  const verified = useRef<number | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    if (ref.current) ref.current.playbackRate = rate;
  }, [rate]);
  useEffect(() => {
    alive.current = true;
    const audio = ref.current;
    return () => {
      alive.current = false;
      checking.current?.abort();
      audio?.pause();
    };
  }, []);
  async function verifyDuration(source: string) {
    if (verified.current !== null || checking.current || !source) return;
    const controller = new AbortController();
    checking.current = controller;
    try {
      // Verify only after listening starts: no full downloads during chat polling.
      const response = await fetch(source, {
        signal: controller.signal,
        credentials: "omit",
        cache: "no-store",
      });
      if (!response.ok || !response.body) return;
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > 10_000_000) {
            await reader.cancel();
            return;
          }
          chunks.push(chunk.value);
        }
      } finally {
        reader.releaseLock();
      }
      if (!bytes || controller.signal.aborted) return;
      const data = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.byteLength;
      }
      // Encoded metadata can report minutes for a clip containing only seconds.
      const context = new OfflineAudioContext(1, 1, 48_000);
      const decoded = await context.decodeAudioData(data.buffer);
      if (
        !alive.current ||
        controller.signal.aborted ||
        !Number.isFinite(decoded.duration) ||
        decoded.duration <= 0
      )
        return;
      verified.current = decoded.duration;
      setDuration(decoded.duration);
      setCurrent((value) => Math.min(value, decoded.duration));
    } catch {
      // Keep playback available if verification is unsupported or interrupted.
      // An unknown duration is preferable to presenting incorrect metadata.
    } finally {
      if (checking.current === controller) checking.current = null;
    }
  }
  async function play() {
    const audio = ref.current;
    if (!audio) return;
    setError("");
    if (!audio.paused) {
      audio.pause();
      return;
    }
    if (verified.current !== null && audio.currentTime >= verified.current) {
      audio.currentTime = 0;
    }
    try {
      await audio.play();
    } catch {
      if (refreshing.current) return;
      refreshing.current = true;
      try {
        const next = await onExpired();
        if (next) {
          audio.src = next;
          audio.load();
          audio.playbackRate = rate;
          await audio.play();
        } else setError("Não foi possível ouvir agora. Tente novamente.");
      } catch {
        setError("Áudio indisponível ou incompatível com o navegador.");
      } finally {
        refreshing.current = false;
      }
    }
  }
  return (
    <div className="simple-audio">
      <audio
        ref={ref}
        src={url}
        preload="metadata"
        aria-label="Mensagem de áudio"
        onLoadedMetadata={(e) => {
          e.currentTarget.playbackRate = rate;
        }}
        onTimeUpdate={(e) => {
          const value = e.currentTarget.currentTime;
          setCurrent(
            Number.isFinite(value)
              ? Math.max(0, Math.min(value, verified.current ?? value))
              : 0,
          );
        }}
        onPlay={(e) => {
          setPlaying(true);
          void verifyDuration(e.currentTarget.currentSrc);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(verified.current ?? 0);
        }}
      />
      <button
        className="icon-button"
        type="button"
        onClick={() => void play()}
        aria-label={playing ? "Pausar áudio" : "Reproduzir áudio"}
      >
        {playing ? <Pause size={21} /> : <Play size={21} />}
      </button>
      <div className="min-w-0 flex-1">
        <input
          aria-label="Posição do áudio"
          type="range"
          min={0}
          max={Number.isFinite(duration) && duration > 0 ? duration : 0}
          step={0.1}
          value={duration > 0 ? Math.min(current, duration) : 0}
          disabled={!Number.isFinite(duration) || duration <= 0}
          onChange={(e) => {
            const position = Number(e.target.value);
            setCurrent(position);
            if (ref.current) ref.current.currentTime = position;
          }}
        />
        <span className="text-[10px] text-[var(--muted)]">
          {time(current)}
          {Number.isFinite(duration) && duration > 0
            ? ` / ${time(duration)}`
            : ""}
        </span>
      </div>
      {error && (
        <p role="status" className="audio-error">
          {error}
        </p>
      )}
    </div>
  );
}
