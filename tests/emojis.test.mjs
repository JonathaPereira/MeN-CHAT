import test from "node:test";
import assert from "node:assert/strict";
import { searchEmojis, emojiCategories } from "../lib/emojis.ts";
test("busca de emojis aceita acentos, caixa e símbolo", () => {
  assert.ok(searchEmojis("CORACAO").some(([emoji]) => emoji === "❤️"));
  assert.ok(searchEmojis("cafe").some(([emoji]) => emoji === "☕"));
  assert.deepEqual(searchEmojis("😂"), [["😂", "Rindo"]]);
  assert.equal(searchEmojis("xyzxyz").length, 0);
});
test("emojis possuem rótulos e símbolos únicos nas categorias", () => {
  const items = emojiCategories.flatMap((category) => category.items);
  assert.equal(new Set(items.map(([emoji]) => emoji)).size, items.length);
  assert.ok(items.every(([emoji, label]) => emoji && label));
});
