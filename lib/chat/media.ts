import type { SupabaseClient } from "@supabase/supabase-js";
import type { Upload } from "./types";
export async function reserveUpload(
  client: SupabaseClient,
  thread: string | null,
  file: File,
): Promise<Upload> {
  const { data, error } = await client.rpc("menchat_reserve_upload", {
    p_thread: thread,
    p_name: file.name,
    p_mime: file.type,
    p_bytes: file.size,
  });
  if (error || !data?.[0])
    throw new Error(
      "Não foi possível reservar o arquivo. Confira o formato, as cotas e a migração.",
    );
  return { ...data[0], name: file.name, mime: file.type, bytes: file.size };
}
export async function uploadFile(
  client: SupabaseClient,
  item: Upload,
  file: File,
) {
  const bucket = item.kind === "avatar" ? "menchat-avatars" : "menchat-media";
  const result = await client.storage
    .from(bucket)
    .upload(item.path, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: "0",
    });
  // Uma resposta perdida pode deixar o objeto já enviado. A RPC final verifica tamanho/tipo no Storage.
  if (
    result.error &&
    !["Duplicate", "409"].includes(String(result.error.statusCode)) &&
    !/already exists|duplicate/i.test(result.error.message)
  )
    throw new Error(
      "Upload interrompido. O arquivo foi mantido para tentar novamente.",
    );
}
export async function discardUpload(client: SupabaseClient, item: Upload) {
  const bucket = item.kind === "avatar" ? "menchat-avatars" : "menchat-media";
  await client.storage.from(bucket).remove([item.path]);
  await client.rpc("menchat_cancel_upload", { p_upload: item.id });
}
export async function normalizePhoto(file: File): Promise<File> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 2_000_000 ||
    file.size < 1
  )
    throw new Error("Escolha JPG, PNG ou WebP de até 2 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 20_000_000)
      throw new Error("Escolha uma foto de até 20 megapixels.");
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Editor de foto indisponível.");
    const crop = Math.min(bitmap.width, bitmap.height);
    context.drawImage(
      bitmap,
      (bitmap.width - crop) / 2,
      (bitmap.height - crop) / 2,
      crop,
      crop,
      0,
      0,
      256,
      256,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("Não foi possível preparar a foto.")),
        "image/webp",
        0.85,
      ),
    );
    if (blob.size > 200_000)
      throw new Error("A foto ficou muito grande. Escolha outra.");
    return new File([blob], "perfil.webp", { type: blob.type });
  } finally {
    bitmap.close();
  }
}
