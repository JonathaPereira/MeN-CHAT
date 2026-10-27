import test from "node:test";
import assert from "node:assert/strict";
import { snowballError, vibrateSnowball } from "../lib/snowball.ts";
import {
  defaultPreferences,
  shouldNotifySnowball,
} from "../lib/preferences.ts";
import {
  stickerLayout,
  initialStickerCrop,
  clampPosition,
} from "../lib/sticker-layout.ts";

test("bola de neve vale uma vez por pessoa/conversa e exige participação", () => {
  const chat = { kind: "person", messages: [] };
  assert.equal(snowballError(chat), null);
  assert.match(
    snowballError({
      ...chat,
      messages: [{ kind: "snowball", outgoing: true }],
    }),
    /já jogou/,
  );
  assert.equal(
    snowballError({
      ...chat,
      messages: [{ kind: "snowball", outgoing: false }],
    }),
    null,
  );
  assert.equal(
    snowballError({ ...chat, messages: [{ outgoing: true, text: "❄️" }] }),
    null,
  );
  assert.match(
    snowballError({ ...chat, kind: "group", group: { selfMember: false } }),
    /saiu/,
  );
  assert.match(snowballError(undefined), /não encontrada/);
});
test("avisos de bola de neve respeitam opção, controle geral e conversa silenciada", () => {
  assert.equal(shouldNotifySnowball(defaultPreferences, "ana"), true);
  for (const patch of [
    { notificationsEnabled: false },
    { snowballAlerts: false },
    { mutedChatIds: ["ana"] },
  ])
    assert.equal(
      shouldNotifySnowball({ ...defaultPreferences, ...patch }, "ana"),
      false,
    );
});
test("vibração adicional é um único padrão duplo e tem alternativa silenciosa", () => {
  const patterns = [];
  assert.equal(
    vibrateSnowball({
      vibrate(pattern) {
        patterns.push(pattern);
        return true;
      },
    }),
    true,
  );
  assert.deepEqual(patterns, [[90, 50, 90]]);
  assert.equal(vibrateSnowball({}), false);
  assert.equal(
    vibrateSnowball({
      vibrate() {
        throw new Error("bloqueado");
      },
    }),
    false,
  );
  assert.equal(
    vibrateSnowball({
      vibrate() {
        return false;
      },
    }),
    false,
  );
});
test("enquadramento inteiro e preenchimento usam dimensões após rotação", () => {
  assert.deepEqual(stickerLayout(1000, 500, 0, false), {
    scale: 0.48,
    centerX: 256,
    centerY: 256,
  });
  assert.equal(stickerLayout(1000, 500, 0, true).scale, 0.96);
  assert.equal(stickerLayout(1000, 500, 1, false).scale, 0.48);
});
test("zoom e posição mantêm limites e redefinição restaura centro", () => {
  assert.deepEqual(
    stickerLayout(512, 512, 0, false, {
      ...initialStickerCrop,
      zoom: 2,
      x: 50,
      y: -50,
    }),
    { scale: 1.875, centerX: 376, centerY: 136 },
  );
  assert.equal(
    stickerLayout(512, 512, 0, false, {
      ...initialStickerCrop,
      zoom: 20,
      x: 900,
      y: -900,
    }).scale,
    3.75,
  );
  assert.equal(clampPosition(900), 100);
  assert.equal(clampPosition(-900), -100);
  assert.equal(
    stickerLayout(512, 512, 0, false, initialStickerCrop).centerX,
    256,
  );
});
