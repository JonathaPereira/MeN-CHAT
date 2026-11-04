import test from "node:test";
import assert from "node:assert/strict";
import { sameComposition, quotedText } from "../lib/chat/composition.ts";
test("repetição compara referência e participantes, sem depender da ordem das menções", () => {
  assert.equal(
    sameComposition(
      { replyId: "a", mentionIds: ["1", "2"] },
      { replyId: "a", mentionIds: ["2", "1"] },
    ),
    true,
  );
  assert.equal(
    sameComposition(
      { replyId: "a", mentionIds: ["1"] },
      { replyId: "b", mentionIds: ["1"] },
    ),
    false,
  );
  assert.equal(
    sameComposition(
      { replyId: null, mentionIds: ["1"] },
      { replyId: null, mentionIds: [] },
    ),
    false,
  );
});
test("citações limitam o texto e identificam anexos sem inventar conteúdo", () => {
  assert.equal(quotedText("", true), "Anexo");
  assert.equal(quotedText("", false), "Mensagem indisponível");
  assert.equal(quotedText("a".repeat(4000), false).length, 180);
});
import { mentionStart } from "../lib/chat/composition.ts";
test("menções respeitam cursor, nomes completos e não substituem texto já concluído", () => {
  assert.equal(mentionStart("Oi @Ana", 7, []), 3);
  assert.equal(mentionStart("e-mail a@b.com", 14, []), -1);
  assert.equal(mentionStart("@Ana Teste oi", 13, ["Ana Teste"]), -1);
  assert.equal(mentionStart("@Ana Teste @Jo", 14, ["Ana Teste"]), 11);
});
