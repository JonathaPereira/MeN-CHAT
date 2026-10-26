import Image from "next/image";
import { Download, FileText } from "lucide-react";
import type { Attachment } from "@/types/chat";
import { formatFileSize } from "@/lib/attachments";

export function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  return (
    <div className="attachment-preview">
      {attachment.kind === "image" && (
        <Image
          src={attachment.url}
          alt={attachment.name}
          width={320}
          height={240}
          unoptimized
          className="max-h-60 w-full rounded-xl object-contain"
        />
      )}
      {attachment.kind === "video" && (
        <video
          src={attachment.url}
          controls
          preload="metadata"
          className="max-h-60 w-full rounded-xl"
          aria-label={`Vídeo: ${attachment.name}`}
        />
      )}
      {attachment.kind === "audio" && (
        <audio
          src={attachment.url}
          controls
          preload="metadata"
          className="w-full max-w-full"
          aria-label={`Áudio: ${attachment.name}`}
        />
      )}
      <a
        href={attachment.url}
        download={attachment.name}
        className="mt-2 flex min-w-0 items-center gap-2 rounded-lg p-2 text-xs hover:bg-black/5 dark:hover:bg-white/5"
        aria-label={`Baixar ${attachment.name}`}
      >
        <FileText size={18} className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{attachment.name}</span>
          <span className="text-[var(--muted)]">
            {formatFileSize(attachment.size)} · Arquivo local
          </span>
        </span>
        <Download size={15} className="shrink-0" />
      </a>
    </div>
  );
}
