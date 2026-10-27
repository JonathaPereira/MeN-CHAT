import test from "node:test";
import assert from "node:assert/strict";
import { initialChats } from "../lib/data/chat.ts";
import {
  applyGroupAction,
  groupMemberIds,
  isGroupAdmin,
  SELF,
} from "../lib/group-rules.ts";
const family = initialChats.find((chat) => chat.id === "familia");
const friends = initialChats.find((chat) => chat.id === "amigos");
const owned = () => ({
  ...family,
  group: { creatorId: SELF, ownerId: SELF, adminIds: [SELF], selfMember: true },
});
function success(result) {
  assert.equal(result.ok, true, result.error);
  return result.chat;
}

test("somente administradores podem adicionar e promover pessoas", () => {
  for (const action of [
    { type: "add", targetId: "lucas" },
    { type: "promote", targetId: "ana" },
  ])
    assert.equal(applyGroupAction(friends, SELF, action).ok, false);
  const added = success(
    applyGroupAction(family, SELF, { type: "add", targetId: "pedro" }),
  );
  assert.ok(added.memberIds.includes("pedro"));
  const promoted = success(
    applyGroupAction(family, SELF, { type: "promote", targetId: "lucas" }),
  );
  assert.equal(isGroupAdmin(promoted, "lucas"), true);
  assert.equal(family.group.adminIds.includes("lucas"), false);
});
test("criador não pode ser removido ou rebaixado por outro administrador", () => {
  for (const type of ["remove", "demote"]) {
    const result = applyGroupAction(family, SELF, { type, targetId: "ana" });
    assert.equal(result.ok, false);
    assert.match(result.error, /criador/i);
  }
});
test("transferência mantém criador imutável e protegido até do novo dono", () => {
  const transferred = success(
    applyGroupAction(owned(), SELF, { type: "transfer", targetId: "ana" }),
  );
  assert.equal(transferred.group.creatorId, SELF);
  assert.equal(transferred.group.ownerId, "ana");
  for (const type of ["remove", "demote"])
    assert.equal(
      applyGroupAction(transferred, "ana", { type, targetId: SELF }).ok,
      false,
    );
  const left = success(applyGroupAction(transferred, SELF, { type: "leave" }));
  assert.equal(left.group.selfMember, false);
  assert.equal(left.group.creatorId, SELF);
});
test("dono precisa transferir antes de sair quando há outros participantes", () => {
  const result = applyGroupAction(owned(), SELF, { type: "leave" });
  assert.equal(result.ok, false);
  assert.match(result.error, /Transfira/);
  assert.equal(
    applyGroupAction(family, SELF, { type: "transfer", targetId: "lucas" }).ok,
    false,
  );
  assert.equal(
    applyGroupAction(owned(), SELF, {
      type: "transfer",
      targetId: "inexistente",
    }).ok,
    false,
  );
});
test("membro pode sair mas perde todas as ações de grupo", () => {
  const left = success(applyGroupAction(friends, SELF, { type: "leave" }));
  assert.ok(!groupMemberIds(left).includes(SELF));
  assert.equal(isGroupAdmin(left, SELF), false);
  for (const action of [
    { type: "add", targetId: "lucas" },
    { type: "promote", targetId: "ana" },
    { type: "leave" },
  ])
    assert.equal(applyGroupAction(left, SELF, action).ok, false);
});
test("administrador não remove outro administrador e só dono revoga papel", () => {
  const promoted = success(
    applyGroupAction(family, SELF, { type: "promote", targetId: "lucas" }),
  );
  assert.equal(
    applyGroupAction(promoted, SELF, { type: "remove", targetId: "lucas" }).ok,
    false,
  );
  assert.equal(
    applyGroupAction(promoted, SELF, { type: "demote", targetId: "lucas" }).ok,
    false,
  );
  const demoted = success(
    applyGroupAction(promoted, "ana", { type: "demote", targetId: "lucas" }),
  );
  assert.equal(isGroupAdmin(demoted, "lucas"), false);
});
test("limite de 20 inclui usuário atual e não aceita duplicatas", () => {
  const full = {
    ...owned(),
    memberIds: Array.from({ length: 19 }, (_, i) => `member-${i}`),
  };
  assert.equal(groupMemberIds(full).length, 20);
  assert.equal(
    applyGroupAction(full, SELF, { type: "add", targetId: "pedro" }).ok,
    false,
  );
  assert.equal(
    applyGroupAction(family, SELF, { type: "add", targetId: "ana" }).ok,
    false,
  );
});
test("último participante pode sair e encerra propriedade e administração", () => {
  const left = success(
    applyGroupAction({ ...owned(), memberIds: [] }, SELF, { type: "leave" }),
  );
  assert.equal(left.group.ownerId, null);
  assert.deepEqual(left.group.adminIds, []);
  assert.deepEqual(groupMemberIds(left), []);
});
test("remover membro atualiza papéis sem afetar mensagens ou o criador", () => {
  const chat = owned();
  const removed = success(
    applyGroupAction(chat, SELF, { type: "remove", targetId: "lucas" }),
  );
  assert.ok(!removed.memberIds.includes("lucas"));
  assert.equal(removed.group.creatorId, SELF);
  assert.deepEqual(removed.messages, chat.messages);
  assert.ok(chat.memberIds.includes("lucas"));
});
