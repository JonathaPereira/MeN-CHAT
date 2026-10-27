import type { Chat } from "../types/chat";
export function snowballError(chat: Chat | undefined): string | null {
  if (!chat) return "Conversa não encontrada.";
  if (chat.kind === "group" && !chat.group?.selfMember)
    return "Você saiu deste grupo.";
  if (
    chat.messages.some(
      (message) => message.outgoing && message.kind === "snowball",
    )
  )
    return "Você já jogou sua bola de neve nesta conversa.";
  return null;
}
/** Chamada uma vez por recebimento, nunca ao renderizar histórico. Suporte é opcional. */
export function vibrateSnowball(device: {
  vibrate?: (pattern: number[]) => boolean;
}): boolean {
  try {
    return typeof device.vibrate === "function" && device.vibrate([90, 50, 90]);
  } catch {
    return false;
  }
}
