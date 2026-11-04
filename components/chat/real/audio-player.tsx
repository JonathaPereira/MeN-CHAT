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
  useEffect(() => {
    if (ref.current) ref.current.playbackRate = rate;
  }, [rate]);
  useEffect(() => {
    const audio = ref.current;
    return () => {
      audio?.pause();
    };
  }, []);
  async function play() {
    const audio = ref.current;
    if (!audio) return;
    setError("");
    if (!audio.paused) {
      audio.pause();
      return;
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
          setDuration(e.currentTarget.duration);
          e.currentTarget.playbackRate = rate;
        }}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
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
          value={current}
          disabled={!Number.isFinite(duration) || duration <= 0}
          onChange={(e) => {
            if (ref.current) ref.current.currentTime = Number(e.target.value);
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
