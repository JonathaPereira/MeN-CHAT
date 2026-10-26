const MB = 1_000_000;
export const attachmentPolicy = {
  image: {
    limit: 5 * MB,
    label: "Fotos: até 5 MB",
    types: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  },
  video: {
    limit: 25 * MB,
    label: "Vídeos: até 25 MB",
    types: ["video/mp4", "video/webm", "video/quicktime"],
  },
  audio: {
    limit: 10 * MB,
    label: "Áudios: até 10 MB",
    types: ["audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/webm"],
  },
  document: {
    limit: 10 * MB,
    label: "Documentos: até 10 MB",
    types: [
      "application/pdf",
      "text/plain",
      "application/zip",
      "application/x-zip-compressed",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  },
} as const;
export type AttachmentKind = keyof typeof attachmentPolicy;
export const attachmentAccept = Object.values(attachmentPolicy)
  .flatMap((item) => [...item.types])
  .join(",");
export const MAX_ATTACHMENTS = 5;

export function validateAttachment(file: {
  name: string;
  size: number;
  type: string;
}): { kind: AttachmentKind; error?: never } | { error: string; kind?: never } {
  if (file.size === 0) return { error: `${file.name}: o arquivo está vazio.` };
  const kind = (Object.keys(attachmentPolicy) as AttachmentKind[]).find((key) =>
    (attachmentPolicy[key].types as readonly string[]).includes(file.type),
  );
  if (!kind || /\.(exe|msi|bat|cmd|ps1|js|html|svg|sh)$/i.test(file.name))
    return {
      error: `${file.name}: formato não permitido. Use fotos, vídeos, áudio, PDF, TXT, ZIP ou arquivos do Office.`,
    };
  if (file.size > attachmentPolicy[kind].limit)
    return {
      error: `${file.name}: excede o limite. ${attachmentPolicy[kind].label}.`,
    };
  return { kind };
}

export function formatFileSize(bytes: number): string {
  return bytes >= MB
    ? `${(bytes / MB).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}
