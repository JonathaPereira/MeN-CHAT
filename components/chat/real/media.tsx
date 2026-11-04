"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, FileText, RefreshCw } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Upload } from "@/lib/chat/types";
import { formatFileSize } from "@/lib/attachments";
import { shouldLoadMedia } from "@/lib/preferences";
import { usePreferences } from "@/components/preferences-provider";
export function RealMedia({
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
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const { data, error } = await client
          .from("menchat_uploads")
          .select("id,path,kind,name,mime,bytes")
          .eq("id", id)
          .maybeSingle<Upload>();
        if (!alive) return;
        if (error || !data) {
          setError("Anexo indisponível.");
          return;
        }
        setItem(data);
        if (
          data.kind !== "document" &&
          data.kind !== "avatar" &&
          shouldLoadMedia(settings, data.kind)
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
  }, [client, id, settings]);
  async function load(download = false) {
    if (!item) return;
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
    } catch {
      setError(
        "Arquivo indisponível. Verifique a conexão e seu acesso à conversa.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="real-media">
      {item && (
        <>
          <div className="real-media-player">
            {url && item.kind === "image" ? (
              <Image
                unoptimized
                width={480}
                height={360}
                src={url}
                alt={item.name}
                onError={() =>
                  setError("A prévia expirou. Toque em recarregar.")
                }
                className="max-h-72 w-full rounded-xl object-contain"
              />
            ) : url && item.kind === "audio" ? (
              <audio
                controls
                preload="none"
                src={url}
                aria-label={`Ouvir ${item.name}`}
                onError={() => setError("Recarregue a prévia para ouvir.")}
                onLoadedMetadata={(e) => {
                  e.currentTarget.playbackRate = settings.playbackRate;
                }}
              />
            ) : url && item.kind === "video" ? (
              <video
                controls
                playsInline
                preload="metadata"
                src={url}
                aria-label={`Assistir ${item.name}`}
                onError={() => setError("Recarregue a prévia para assistir.")}
              />
            ) : item.kind !== "document" ? (
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => void load()}
              >
                Carregar prévia
              </button>
            ) : (
              <FileText size={28} />
            )}
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs" title={item.name}>
                {item.name}
              </p>
              <p className="text-[10px] text-[var(--muted)]">
                {formatFileSize(item.bytes)}
              </p>
            </div>
            <button
              className="icon-button shrink-0"
              type="button"
              aria-label={`Baixar ${item.name}`}
              disabled={busy}
              onClick={() => void load(true)}
            >
              <Download size={17} />
            </button>
            <button
              className="icon-button shrink-0"
              type="button"
              aria-label="Recarregar prévia"
              disabled={busy}
              onClick={() => void load()}
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </>
      )}
      {error && (
        <p role="status" className="text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
