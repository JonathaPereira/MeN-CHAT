import { stickerLayout, type StickerCrop } from "./sticker-layout";
import { createDemoId } from "./demo-id";

export type Sticker = {
  id: string;
  name: string;
  dataUrl: string;
  size: number;
};
export const STICKER_LIMIT = 40;
export const STICKER_BYTES = 100 * 1024;
export function validateStickerSource(
  file: Pick<File, "type" | "size">,
): string | null {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    return "Escolha uma imagem PNG, JPG ou WebP. Pacotes do WhatsApp e GIFs não são suportados.";
  if (!file.size || file.size > 5 * 1024 * 1024)
    return "Cada imagem deve ter até 5 MB.";
  return null;
}
export async function readStickerImage(file: File): Promise<HTMLImageElement> {
  const error = validateStickerSource(file);
  if (error) throw new Error(error);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.naturalWidth * image.naturalHeight > 20_000_000)
      throw new Error("Escolha uma imagem de até 20 megapixels.");
    return image;
  } catch (error) {
    if (error instanceof Error && error.message.includes("megapixels"))
      throw error;
    throw new Error("Não foi possível ler esta imagem. Escolha outro arquivo.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function drawSticker(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  options: {
    rotate: number;
    crop: boolean;
    text: string;
    adjustments?: StickerCrop;
  },
) {
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Este navegador não oferece edição de imagens.");
  const layout = stickerLayout(
    image.naturalWidth,
    image.naturalHeight,
    options.rotate,
    options.crop,
    options.adjustments,
  );
  const scale = layout.scale;
  ctx.save();
  ctx.beginPath();
  if (options.adjustments?.shape === "circle")
    ctx.arc(256, 256, 240, 0, Math.PI * 2);
  else ctx.rect(16, 16, 480, 480);
  ctx.clip();
  ctx.translate(layout.centerX, layout.centerY);
  ctx.rotate((options.rotate * Math.PI) / 2);
  ctx.drawImage(
    image,
    (-image.naturalWidth * scale) / 2,
    (-image.naturalHeight * scale) / 2,
    image.naturalWidth * scale,
    image.naturalHeight * scale,
  );
  ctx.restore();
  if (options.text.trim()) {
    ctx.save();
    if (options.adjustments?.shape === "circle") {
      ctx.beginPath();
      ctx.arc(256, 256, 240, 0, Math.PI * 2);
      ctx.clip();
    }
    ctx.font = "bold 38px sans-serif";
    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 8;
    ctx.fillStyle = "white";
    ctx.strokeText(options.text.trim(), 256, 460, 450);
    ctx.fillText(options.text.trim(), 256, 460, 450);
    ctx.restore();
  }
}
export async function encodeSticker(
  canvas: HTMLCanvasElement,
  name: string,
): Promise<Sticker> {
  for (const quality of [0.9, 0.75, 0.55, 0.35, 0.15]) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    if (!blob || blob.type !== "image/webp")
      throw new Error(
        "Seu navegador não exporta WebP. Tente uma versão atual do Chrome, Edge ou Safari.",
      );
    if (blob.size > STICKER_BYTES) continue;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () =>
        reject(new Error("Não foi possível preparar a figurinha."));
      reader.readAsDataURL(blob);
    });
    return {
      id: createDemoId(),
      name: name.trim().slice(0, 40) || "Figurinha",
      dataUrl,
      size: blob.size,
    };
  }
  throw new Error(
    "A imagem ficou maior que 100 KB. Tente uma imagem mais simples.",
  );
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("menchat-stickers", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("stickers", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "Armazenamento indisponível. Libere espaço ou verifique as permissões do navegador.",
        ),
      );
  });
}
export async function stickerStore(
  action: "list" | "save" | "delete",
  value?: Sticker | string,
): Promise<Sticker[]> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(
        "stickers",
        action === "list" ? "readonly" : "readwrite",
      );
      const store = tx.objectStore("stickers");
      let items: Sticker[] = [];
      let full = false;
      const request = store.getAll();
      request.onsuccess = () => {
        items = request.result as Sticker[];
        if (action === "save" && value && typeof value !== "string") {
          if (items.length >= STICKER_LIMIT) {
            full = true;
            tx.abort();
            return;
          }
          store.put(value);
          items.push(value);
        }
        if (action === "delete" && typeof value === "string") {
          store.delete(value);
          items = items.filter((item) => item.id !== value);
        }
      };
      tx.oncomplete = () => resolve(items);
      tx.onabort = tx.onerror = () =>
        reject(
          new Error(
            full
              ? "Limite de 40 figurinhas. Exclua uma antes de adicionar outra."
              : "Não foi possível salvar as figurinhas. Verifique o espaço e as permissões do navegador.",
          ),
        );
    });
  } finally {
    db.close();
  }
}
