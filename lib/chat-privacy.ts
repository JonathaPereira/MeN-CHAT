import type { Chat, Contact, Message, ReadReceipt } from "@/types/chat";

export function chatMembers(
  chat: Chat,
  directory: readonly Contact[],
): Contact[] {
  const ids =
    chat.kind === "person" ? chat.memberIds.slice(0, 1) : chat.memberIds;
  return [...new Set(ids)].flatMap((id) => {
    const contact = directory.find((item) => item.id === id);
    return contact ? [contact] : [];
  });
}
export function profileCode(contact: Contact): string | null {
  return contact.privacy.showCode ? contact.code : null;
}
export function findContactByCode(
  code: string,
  directory: readonly Contact[],
): Contact | undefined {
  const normalized = code.trim().toUpperCase();
  return directory.find(
    (contact) => contact.privacy.allowCodeLookup && contact.code === normalized,
  );
}
export function visibleReaders(
  chat: Chat,
  message: Message,
  directory: readonly Contact[],
): ReadReceipt[] {
  if (!message.outgoing) return [];
  const members = chatMembers(chat, directory).filter(
    (contact) => contact.privacy.readReceipts,
  );
  const seen = new Set<string>();
  return (message.readBy ?? []).filter((receipt) => {
    if (
      seen.has(receipt.contactId) ||
      !members.some((member) => member.id === receipt.contactId)
    )
      return false;
    seen.add(receipt.contactId);
    return true;
  });
}
