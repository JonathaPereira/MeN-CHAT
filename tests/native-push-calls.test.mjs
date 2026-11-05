import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  firebasePublic,
  nativePushReady,
  parseNativeJob,
  nativePayload,
} from "../lib/native-push/config.ts";
import { turnUrls, callsReady, iceConfiguration } from "../lib/calls/config.ts";
const config = {
  MENCHAT_FIREBASE_APP_ID: "1:123456789012:android:abcdef123456",
  MENCHAT_FIREBASE_PROJECT_ID: "menchat-fixture",
  MENCHAT_FIREBASE_SENDER_ID: "123456789012",
  MENCHAT_FIREBASE_API_KEY: "AIza" + "a".repeat(35),
};
test("FCM só publica campos públicos válidos e não anuncia prontidão sem credenciais do servidor", () => {
  assert.deepEqual(firebasePublic(config), {
    appId: config.MENCHAT_FIREBASE_APP_ID,
    projectId: config.MENCHAT_FIREBASE_PROJECT_ID,
    senderId: config.MENCHAT_FIREBASE_SENDER_ID,
    apiKey: config.MENCHAT_FIREBASE_API_KEY,
  });
  assert.equal(
    firebasePublic({ ...config, MENCHAT_FIREBASE_SENDER_ID: "999999" }),
    null,
  );
  assert.equal(nativePushReady(config), false);
  const all = {
    ...config,
    SUPABASE_SECRET_KEY: "fixture-not-a-real-secret",
    MENCHAT_FIREBASE_CLIENT_EMAIL:
      "sender@menchat-fixture.iam.gserviceaccount.com",
    MENCHAT_FIREBASE_PRIVATE_KEY:
      "-----BEGIN PRIVATE KEY-----\nfixture\n-----END PRIVATE KEY-----",
  };
  assert.equal(nativePushReady(all), true);
  assert.equal(
    JSON.stringify(firebasePublic(all)).includes("PRIVATE KEY"),
    false,
  );
});
test("push nativo contém apenas identificação e aviso genérico, nunca texto privado", () => {
  const id = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const job = parseNativeJob({
    id: id(1),
    device: id(2),
    recipient: id(3),
    thread: id(4),
    lease: id(5),
    kind: "message",
    stamp: "1793836800000",
    token: "a".repeat(22),
    body: "NÃO PODE VAZAR",
    password: "segredo",
  });
  const payload = nativePayload(job);
  const raw = JSON.stringify(payload);
  assert.equal(raw.includes("NÃO PODE VAZAR"), false);
  assert.equal(raw.includes("segredo"), false);
  assert.equal(raw.includes("lease"), false);
  assert.equal(payload.message.data.recipient, id(3));
  assert.equal(payload.message.android.ttl, "3600s");
  assert.equal(
    nativePayload({ ...job, kind: "call" }).message.android.ttl,
    "45s",
  );
  assert.throws(() =>
    parseNativeJob({ ...job, thread: "outro", token: "token\nmalformado" }),
  );
});
test("TURN exige configuração válida e emite credencial temporária por conta", () => {
  const env = {
    MENCHAT_TURN_URLS:
      '["turn:turn.example.test:3478?transport=udp","turns:turn.example.test:5349?transport=tcp"]',
    MENCHAT_TURN_SECRET: "fixture-" + "x".repeat(40),
  };
  assert.equal(callsReady({}), true);
  assert.equal(callsReady(env), true);
  assert.equal(
    turnUrls({ ...env, MENCHAT_TURN_URLS: '["https://turn.example.test"]' })
      .length,
    0,
  );
  const actor = "10000000-0000-4000-8000-000000000001",
    now = 1_790_000_000_000;
  const config = iceConfiguration(env, actor, now);
  assert.equal(config.maxParticipants, 4);
  assert.equal(config.expires, Math.floor(now / 1000) + 1200);
  const turn = config.iceServers[1];
  assert.equal(turn.username, `${config.expires}:${actor}`);
  assert.equal(
    turn.credential,
    createHmac("sha1", env.MENCHAT_TURN_SECRET)
      .update(turn.username)
      .digest("base64"),
  );
  assert.equal(JSON.stringify(config).includes(env.MENCHAT_TURN_SECRET), false);
  assert.throws(() => iceConfiguration(env, "actor-inválido", now));
});

test("chamadas diretas funcionam sem TURN e podem ser desativadas pelo administrador", () => {
  const actor = "10000000-0000-4000-8000-000000000001";
  for (const env of [{}, {MENCHAT_TURN_SECRET: "incompleto"}, {MENCHAT_TURN_URLS: "invalid"}]) {
    const config = iceConfiguration(env, actor);
    assert.deepEqual(config.iceServers, [{urls: ["stun:stun.l.google.com:19302"]}]);
    assert.equal(config.maxParticipants, 4);
    assert.equal(JSON.stringify(config).includes("credential"), false);
  }
  assert.equal(callsReady({MENCHAT_CALLS_ENABLED: " false "}), false);
  assert.throws(() => iceConfiguration({MENCHAT_CALLS_ENABLED: "false"}, actor));
  assert.throws(() => iceConfiguration({}, "invalid"));
});
