import type { Chat } from "@/types/chat";

export const SELF = "self";
export const GROUP_LIMIT = 20;
export type GroupAction =
  | { type: "add"; targetId: string }
  | { type: "promote"; targetId: string }
  | { type: "demote"; targetId: string }
  | { type: "remove"; targetId: string }
  | { type: "transfer"; targetId: string }
  | { type: "leave" };
export type GroupResult =
  { ok: true; chat: Chat } | { ok: false; error: string };

export function groupMemberIds(chat: Chat): string[] {
  if (chat.kind !== "group" || !chat.group) return [];
  return [
    ...new Set([...chat.memberIds, ...(chat.group.selfMember ? [SELF] : [])]),
  ];
}
export function isGroupAdmin(chat: Chat, actorId: string): boolean {
  return (
    groupMemberIds(chat).includes(actorId) &&
    Boolean(
      chat.group?.ownerId === actorId || chat.group?.adminIds.includes(actorId),
    )
  );
}
export function groupRole(chat: Chat, id: string): string {
  if (chat.group?.creatorId === id && chat.group.ownerId === id)
    return "Criador · dono";
  if (chat.group?.creatorId === id) return "Criador";
  if (chat.group?.ownerId === id) return "Dono";
  return isGroupAdmin(chat, id) ? "Administrador" : "Membro";
}
/** Regras da demonstração; a etapa com servidor deverá aplicar as mesmas invariantes. */
export function applyGroupAction(
  chat: Chat,
  actorId: string,
  action: GroupAction,
): GroupResult {
  const info = chat.group;
  if (chat.kind !== "group" || !info)
    return { ok: false, error: "Esta conversa não é um grupo válido." };
  const ids = groupMemberIds(chat);
  if (!ids.includes(actorId))
    return { ok: false, error: "Você não faz mais parte deste grupo." };
  const owner = info.ownerId === actorId;
  const admin = isGroupAdmin(chat, actorId);
  const next = { ...info, adminIds: [...info.adminIds] };
  let memberIds = [...chat.memberIds];
  if (action.type === "leave") {
    if (owner && ids.length > 1)
      return {
        ok: false,
        error: "Transfira a propriedade para outro participante antes de sair.",
      };
    memberIds = memberIds.filter((id) => id !== actorId);
    if (actorId === SELF) next.selfMember = false;
    next.adminIds = next.adminIds.filter((id) => id !== actorId);
    if (owner) next.ownerId = null;
  } else {
    if (!admin)
      return {
        ok: false,
        error: "Somente administradores podem gerenciar participantes.",
      };
    const target = action.targetId;
    if (action.type === "add") {
      if (ids.includes(target))
        return { ok: false, error: "Esta pessoa já participa do grupo." };
      if (ids.length >= GROUP_LIMIT)
        return {
          ok: false,
          error: "O grupo atingiu o limite de 20 participantes.",
        };
      if (target === SELF) next.selfMember = true;
      else memberIds.push(target);
    } else {
      if (!ids.includes(target))
        return { ok: false, error: "Participante não encontrado neste grupo." };
      if (action.type === "promote") {
        if (isGroupAdmin(chat, target))
          return { ok: false, error: "Esta pessoa já é administradora." };
        next.adminIds.push(target);
      } else if (action.type === "transfer") {
        if (!owner)
          return {
            ok: false,
            error: "Somente o dono pode transferir a propriedade.",
          };
        if (target === actorId)
          return {
            ok: false,
            error: "Escolha outro participante para ser o dono.",
          };
        next.ownerId = target;
        next.adminIds = [...new Set([...next.adminIds, actorId, target])];
      } else {
        // O criador é imutável e protegido inclusive depois de uma transferência.
        if (target === info.creatorId)
          return {
            ok: false,
            error:
              "O criador do grupo jamais pode ser removido ou rebaixado por outra pessoa.",
          };
        if (target === info.ownerId)
          return {
            ok: false,
            error:
              "O dono do grupo está protegido. Transfira a propriedade primeiro.",
          };
        if (target === actorId)
          return {
            ok: false,
            error: "Para sair do grupo, use a opção Sair do grupo.",
          };
        if (action.type === "demote") {
          if (!owner)
            return {
              ok: false,
              error: "Somente o dono pode revogar um administrador.",
            };
          if (!isGroupAdmin(chat, target))
            return { ok: false, error: "Esta pessoa já é membro." };
          next.adminIds = next.adminIds.filter((id) => id !== target);
        } else {
          if (isGroupAdmin(chat, target) && !owner)
            return {
              ok: false,
              error: "Apenas o dono pode remover outro administrador.",
            };
          memberIds = memberIds.filter((id) => id !== target);
          if (target === SELF) next.selfMember = false;
          next.adminIds = next.adminIds.filter((id) => id !== target);
        }
      }
    }
  }
  return { ok: true, chat: { ...chat, memberIds, group: next } };
}
