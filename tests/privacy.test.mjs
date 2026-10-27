import test from "node:test";
import assert from "node:assert/strict";
import { contacts, initialChats } from "../lib/data/chat.ts";
import {
  chatMembers,
  findContactByCode,
  profileCode,
  visibleReaders,
} from "../lib/chat-privacy.ts";

test("código oculto não aparece no perfil; busca respeita a opção independente", () => {
  const lucas = contacts.find((person) => person.id === "lucas");
  assert.equal(profileCode(lucas), null);
  assert.equal(
    findContactByCode(lucas.code.toLowerCase(), contacts)?.id,
    "lucas",
  );
  const julia = contacts.find((person) => person.id === "julia");
  assert.equal(findContactByCode(julia.code, contacts), undefined);
  assert.equal(findContactByCode(" a1b2c3 ", contacts)?.id, "ana");
});
test("participantes privados e de grupo são delimitados e não duplicados", () => {
  const privateChat = initialChats.find((chat) => chat.id === "ana-chat");
  assert.deepEqual(
    chatMembers({ ...privateChat, memberIds: ["ana", "pedro"] }, contacts).map(
      (person) => person.id,
    ),
    ["ana"],
  );
  const group = initialChats.find((chat) => chat.id === "familia");
  assert.deepEqual(
    chatMembers(
      { ...group, memberIds: ["ana", "ana", "lucas", "inexistente"] },
      contacts,
    ).map((person) => person.id),
    ["ana", "lucas"],
  );
});
test("quem viu exclui pessoas externas, duplicatas e quem não compartilha leitura", () => {
  const group = initialChats.find((chat) => chat.id === "familia");
  const message = {
    id: "test",
    outgoing: true,
    text: "teste",
    time: "12:00",
    attachments: [],
    readBy: [
      { contactId: "ana", time: "12:01" },
      { contactId: "ana", time: "12:01" },
      { contactId: "lucas", time: "12:01" },
      { contactId: "pedro", time: "12:01" },
    ],
  };
  assert.deepEqual(visibleReaders(group, message, contacts), [
    { contactId: "ana", time: "12:01" },
  ]);
  assert.deepEqual(
    visibleReaders(group, { ...message, outgoing: false }, contacts),
    [],
  );
});
