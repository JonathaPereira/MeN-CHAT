import test from "node:test";
import assert from "node:assert/strict";
import {
  newInvitationToken,
  invitationHash,
  validInvitationToken,
  invitationUrl,
} from "../lib/invitations/token.ts";
import { provisionInviteIdentity } from "../lib/invitations/provision.ts";
test("convites têm entropia criptográfica, hash e origem fixa sem token no caminho HTTP", () => {
  const tokens = Array.from({ length: 100 }, newInvitationToken);
  assert.equal(new Set(tokens).size, 100);
  for (const token of tokens) {
    assert.equal(validInvitationToken(token), true);
    assert.match(invitationHash(token), /^[a-f0-9]{64}$/);
    const link = new URL(invitationUrl("https://men-chat.vercel.app", token));
    assert.equal(link.pathname, "/convite");
    assert.equal(link.search, "");
    assert.equal(new URLSearchParams(link.hash.slice(1)).get("token"), token);
  }
  for (const value of [null, "a".repeat(42), "a".repeat(44), "../convite"])
    assert.equal(validInvitationToken(value), false);
  for (const origin of [
    "http://example.test",
    "https://user:password@example.test",
    "https://example.test/outra",
    "https://example.test?token=a",
  ])
    assert.throws(() => invitationUrl(origin, tokens[0]));
  assert.ok(
    invitationUrl("http://127.0.0.1:3001", tokens[0]).startsWith(
      "http://127.0.0.1:3001/convite#",
    ),
  );
});
test("provisiona identidade sem senha nem sessão e só reutiliza conta confirmada", async () => {
  const calls = [];
  const root = {
    rpc: async () => ({ data: [], error: null }),
    auth: {
      admin: {
        createUser: async (options) => {
          calls.push(options);
          return { data: { user: { id: "novo" } }, error: null };
        },
      },
    },
  };
  assert.equal(
    await provisionInviteIdentity(root, "amigo@example.test"),
    "novo",
  );
  assert.deepEqual(calls, [
    { email: "amigo@example.test", email_confirm: true },
  ]);
  for (const confirmed of [true, false]) {
    root.rpc = async () => ({
      data: [{ id: "existente", confirmed }],
      error: null,
    });
    assert.equal(
      await provisionInviteIdentity(root, "amigo@example.test"),
      confirmed ? "existente" : null,
    );
  }
  assert.equal(calls.length, 1);
  root.rpc = async () => ({ data: null, error: { message: "segredo" } });
  assert.equal(await provisionInviteIdentity(root, "amigo@example.test"), null);
  assert.equal(calls.length, 1);
});
test("repetição concorrente recupera identidade sem excluir conta ou definir senha", async () => {
  let count = 0;
  const root = {
    rpc: async () => ({
      data: ++count === 1 ? [] : [{ id: "concorrente", confirmed: true }],
      error: null,
    }),
    auth: {
      admin: {
        createUser: async () => ({
          error: { message: "already exists" },
          data: { user: null },
        }),
      },
    },
  };
  assert.equal(
    await provisionInviteIdentity(root, "amigo@example.test"),
    "concorrente",
  );
});
