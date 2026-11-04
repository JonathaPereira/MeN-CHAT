import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const script = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
test("worker omite conteúdo e só abre a rota oficial, inclusive payload adulterado", async () => {
  const handlers = {}, notices = [], opened = [];
  const self = { addEventListener: (name, fn) => handlers[name] = fn, registration: { showNotification: async (title, options) => notices.push({ title, options }) }, clients: { matchAll: async () => [], openWindow: async path => opened.push(path) }, location: { origin: "https://men-chat.vercel.app" } };
  vm.runInNewContext(script, { self, URL });
  let done;
  handlers.push({ data: { json: () => ({ title: "Segredo", body: "Texto privado", tag: "javascript:bad" }) }, waitUntil: promise => done = promise });
  await done;
  assert.equal(notices[0].title, "MenChat");
  assert.equal(notices[0].options.body, "Você tem uma nova mensagem.");
  assert.equal(notices[0].options.tag, "menchat-message");
  handlers.notificationclick({ notification: { close() {}, data: { url: "https://evil.test" } }, waitUntil: promise => done = promise });
  await done;
  assert.deepEqual(opened, ["/conta/chat"]);
});
