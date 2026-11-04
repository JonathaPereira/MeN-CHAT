"use client";
import { memo } from "react";
import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { Download, FileText, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Upload } from "@/lib/chat/types";
import { formatFileSize } from "@/lib/attachments";
import { shouldLoadMedia } from "@/lib/preferences";
import { usePreferences } from "@/components/preferences-provider";
import { Modal } from "@/components/modal";
import { AudioPlayer } from "./audio-player";
export const RealMedia = memo(function RealMedia({
  client,
  id,
}: {
  client: SupabaseClient;
  id: string;
}) {
  const { settings } = usePreferences();
  const [item, setItem] = useState<Upload | null>(null),
    [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [expanded, setExpanded] = useState(false),
    [zoom, setZoom] = useState(1);
  const player = useRef<HTMLMediaElement | null>(null),
    recovered = useRef(false);
  const bindPlayer = useCallback((node: HTMLMediaElement | null) => {
    const previous = player.current;
    if (!node && previous)
      queueMicrotask(() => {
        if (player.current !== previous) {
          previous.pause();
          previous.removeAttribute("src");
          previous.load();
        }
      });
    player.current = node;
  }, []);
  const autoImages = shouldLoadMedia(settings, "image"),
    autoAudio = shouldLoadMedia(settings, "audio"),
    autoVideo = shouldLoadMedia(settings, "video");
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const result = await client
          .from("menchat_uploads")
          .select("id,path,kind,name,mime,bytes")
          .eq("id", id)
          .maybeSingle<Upload>();
        if (!alive) return;
        if (result.error || !result.data) {
          setError("Anexo indisponível.");
          return;
        }
        const data = result.data;
        setItem(data);
        if (
          (data.kind === "image" && autoImages) ||
          (data.kind === "audio" && autoAudio) ||
          (data.kind === "video" && autoVideo)
        ) {
          const result = await client.storage
            .from("menchat-media")
            .createSignedUrl(data.path, 300);
          if (alive && result.data) setUrl(result.data.signedUrl);
        }
      } catch {
        if (alive) setError("Não foi possível carregar o anexo.");
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [client, id, autoImages, autoAudio, autoVideo]);
  async function source(download = false): Promise<string | null> {
    if (!item) return null;
    setBusy(true);
    setError("");
    try {
      const { data, error } = await client.storage
        .from("menchat-media")
        .createSignedUrl(
          item.path,
          300,
          download ? { download: item.name } : undefined,
        );
      if (error || !data) throw new Error();
      if (download) {
        const link = document.createElement("a");
        link.href = data.signedUrl;
        link.rel = "noopener noreferrer";
        link.download = item.name;
        document.body.append(link);
        link.click();
        link.remove();
      } else setUrl(data.signedUrl);
      return data.signedUrl;
    } catch {
      setError("Arquivo indisponível. Verifique a conexão e seu acesso.");
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function recover() {
    if (recovered.current) {
      setError(
        "Não foi possível exibir a mídia. Você pode tentar abrir novamente ou baixar.",
      );
      return;
    }
    recovered.current = true;
    await source();
  }
  const label =
    item?.kind === "audio"
      ? "áudio"
      : item?.kind === "image"
        ? "imagem"
        : item?.kind === "video"
          ? "vídeo"
          : item?.name || "arquivo";
  return (
    <div
      className={`real-media clean-media ${item?.kind === "audio" ? "clean-audio" : ""}`}
    >
      {item && (
        <>
          <div className="clean-media-content">
            {url && item.kind === "image" ? (
              <button
                type="button"
                className="media-image-button"
                aria-label="Ampliar foto"
                onClick={() => {
                  setZoom(1);
                  setExpanded(true);
                }}
              >
                <Image
                  unoptimized
                  src={url}
                  width={480}
                  height={360}
                  alt="Foto enviada"
                  className="max-h-72 w-full rounded-xl object-contain"
                  onError={() => void recover()}
                />
                <Maximize2 className="photo-maximize" size={17} />
              </button>
            ) : url && item.kind === "audio" ? (
              <AudioPlayer
                url={url}
                rate={settings.playbackRate}
                onExpired={() => source()}
              />
            ) : url && item.kind === "video" ? (
              <video
                ref={bindPlayer}
                controls
                controlsList="nodownload noplaybackrate"
                playsInline
                preload="metadata"
                src={url}
                aria-label="Vídeo enviado"
                onError={() => void recover()}
              />
            ) : item.kind === "document" ? (
              <div className="document-summary">
                <FileText size={26} />
                <span className="min-w-0">
                  <p className="truncate text-xs">{item.name}</p>
                  <p className="text-[10px] text-[var(--muted)]">
                    {formatFileSize(item.bytes)}
                  </p>
                </span>
              </div>
            ) : (
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => {
                  recovered.current = false;
                  void source();
                }}
              >
                Carregar {label}
              </button>
            )}
          </div>
          <button
            className="icon-button media-download"
            type="button"
            aria-label={`Baixar ${label}`}
            disabled={busy}
            onClick={() => void source(true)}
          >
            <Download size={17} />
          </button>
        </>
      )}
      {error && (
        <p role="status" className="media-error text-xs">
          {error}
        </p>
      )}
      {expanded && url && (
        <Modal title="Foto" onClose={() => setExpanded(false)}>
          <div className="photo-view-tools">
            <button
              className="icon-button"
              aria-label="Diminuir foto"
              onClick={() => setZoom((v) => Math.max(1, v - 0.5))}
            >
              <ZoomOut size={20} />
            </button>
            <button
              className="icon-button"
              aria-label="Aumentar foto"
              onClick={() => setZoom((v) => Math.min(4, v + 0.5))}
            >
              <ZoomIn size={20} />
            </button>
            <button
              className="icon-button"
              aria-label="Baixar imagem ampliada"
              onClick={() => void source(true)}
            >
              <Download size={20} />
            </button>
            <span className="text-xs">{Math.round(zoom * 100)}%</span>
          </div>
          <div className="photo-view-scroll">
            <Image
              unoptimized
              src={url}
              width={1200}
              height={900}
              alt="Foto ampliada"
              style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
              className="h-auto object-contain"
              onError={() => void recover()}
            />
          </div>
        </Modal>
      )}
    </div>
  );
});
