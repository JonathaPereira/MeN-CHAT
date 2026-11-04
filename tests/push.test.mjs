import test from "node:test";
import assert from "node:assert/strict";
import { parseSubscription, pushReady, hasSameOrigin } from "../lib/push/validation.ts";
const good = {
  endpoint: "https://fcm.googleapis.com/fcm/send/test",
  keys: { p256dh: "A".repeat(87), auth: "B".repeat(22) },
};
test("push aceita somente serviços reconhecidos e chaves com tamanho válido", () => {
  assert.deepEqual(parseSubscription(good), good);
  for (const endpoint of [
    "http://fcm.googleapis.com/x",
    "https://127.0.0.1/x",
    "https://fcm.googleapis.com.evil.test/x",
    "https://evil.test/x",
    "https://user:pass@fcm.googleapis.com/x",
    "https://fcm.googleapis.com:444/x",
    "https://fcm.googleapis.com/x#frag",
  ])
    assert.throws(() => parseSubscription({ ...good, endpoint }));
  for (const keys of [
    {},
    { p256dh: "A".repeat(86), auth: "B".repeat(22) },
    { p256dh: "A".repeat(87), auth: "secret" },
  ])
    assert.throws(() => parseSubscription({ ...good, keys }));
});
test("push não é anunciado como pronto sem chave privada e credencial do servidor", () => {
  assert.equal(pushReady({ MENCHAT_VAPID_PUBLIC_KEY: "A".repeat(87) }), false);
  assert.equal(
    pushReady({
      MENCHAT_VAPID_PUBLIC_KEY: "A".repeat(87),
      MENCHAT_VAPID_PRIVATE_KEY: "B".repeat(43),
      SUPABASE_SECRET_KEY: "server-only",
    }),
    true,
  );
});

test("origem usa o Host público mesmo quando Next normaliza a URL interna", () => {
  assert.equal(hasSameOrigin(new Request("http://localhost:3100/api/push", { headers: { host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100" } })), true);
  assert.equal(hasSameOrigin(new Request("http://localhost/api/push", { headers: { host: "men-chat.vercel.app", origin: "https://men-chat.vercel.app", "x-forwarded-proto": "https" } })), true);
  for (const origin of ["https://evil.test", "null", "https://men-chat.vercel.app/", "http://men-chat.vercel.app"]) assert.equal(hasSameOrigin(new Request("http://localhost/api/push", { headers: { host: "men-chat.vercel.app", origin, "x-forwarded-proto": "https" } })), false);
});
