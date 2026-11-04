import test from "node:test";
import assert from "node:assert/strict";
import {
  readEmail,
  validNewPassword,
  validOtp,
} from "../lib/auth/validation.ts";
import {
  loginWithPassword,
  requestEmailCode,
  verifyEmailAndSetPassword,
} from "../lib/auth/flows.ts";
import { loadAccount } from "../lib/auth/access.ts";
const email = "owner@example.test";
const user = {
  id: "user-a",
  email,
  email_confirmed_at: "2026-11-04T00:00:00Z",
};
const profile = {
  id: user.id,
  display_name: "Dono",
  user_code: "ABC123",
  account_status: "active",
  app_role: "admin",
};
test("entradas de acesso validam tipo, e-mail, senha UTF-8 e código", () => {
  assert.equal(readEmail(" Owner@Example.test "), email);
  for (const value of [
    null,
    new File(["a"], "email"),
    "errado",
    "a@b.test ".repeat(40),
  ])
    assert.equal(readEmail(value), null);
  assert.equal(validNewPassword("senha-longa-123"), true);
  assert.equal(validNewPassword("curta"), false);
  assert.equal(validNewPassword("💚".repeat(30)), false);
  assert.equal(validOtp("012345"), true);
  assert.equal(validOtp("1234567890"), true);
  for (const token of ["abc123", "12345", "12345678901"])
    assert.equal(validOtp(token), false);
});
test("OTP nunca cria usuário e não revela se e-mail existe", async () => {
  const calls = [];
  const prepared = await requestEmailCode(
    {
      signInWithOtp: async (options) => {
        calls.push(options);
        return { error: null };
      },
    },
    email,
  );
  const missing = await requestEmailCode(
    {
      signInWithOtp: async () => ({ error: { message: "email desconhecido" } }),
    },
    email,
  );
  assert.deepEqual(prepared, missing);
  assert.deepEqual(calls, [{ email, options: { shouldCreateUser: false } }]);
});
test("senha só muda após OTP validado da identidade correta e sessão confirmada", async () => {
  for (const result of [
    { data: { user, session: null }, error: null },
    {
      data: { user: { ...user, email: "outro@example.test" }, session: {} },
      error: null,
    },
    {
      data: { user: { ...user, email_confirmed_at: null }, session: {} },
      error: null,
    },
    {
      data: { user: null, session: null },
      error: { message: "código segredo" },
    },
  ]) {
    let changed = false;
    const state = await verifyEmailAndSetPassword(
      {
        verifyOtp: async () => result,
        updateUser: async () => {
          changed = true;
        },
      },
      email,
      "123456",
      "senha-longa-123",
    );
    assert.ok(state.error);
    assert.equal(changed, false);
    assert.ok(!state.error.includes("segredo"));
  }
  const calls = [];
  const success = await verifyEmailAndSetPassword(
    {
      verifyOtp: async (options) => {
        calls.push(options);
        return { data: { user, session: {} }, error: null };
      },
      updateUser: async (options) => {
        calls.push(options);
        return { error: null };
      },
    },
    email,
    "123456",
    "senha-longa-123",
  );
  assert.deepEqual(success, {});
  assert.deepEqual(calls, [
    { email, token: "123456", type: "email" },
    { password: "senha-longa-123" },
  ]);
});
test("erro de senha após OTP encerra sessão local e não retorna credenciais", async () => {
  let scope;
  const result = await verifyEmailAndSetPassword(
    {
      verifyOtp: async () => ({ data: { user, session: {} }, error: null }),
      updateUser: async () => ({ error: { message: "senha-longa-123" } }),
      signOut: async (options) => {
        scope = options;
      },
    },
    email,
    "123456",
    "senha-longa-123",
  );
  assert.deepEqual(scope, { scope: "local" });
  assert.ok(result.error);
  assert.ok(!result.error.includes("senha-longa-123"));
});
test("login depende de usuário e sessão confirmados, não apenas ausência de erro", async () => {
  assert.ok(
    (
      await loginWithPassword(
        {
          signInWithPassword: async () => ({
            data: { user, session: null },
            error: null,
          }),
        },
        email,
        "segredo",
      )
    ).error,
  );
  assert.deepEqual(
    await loginWithPassword(
      {
        signInWithPassword: async () => ({
          data: { user, session: {} },
          error: null,
        }),
      },
      email,
      "segredo",
    ),
    {},
  );
  const failed = await loginWithPassword(
    {
      signInWithPassword: async () => {
        throw new Error("segredo");
      },
    },
    email,
    "segredo",
  );
  assert.ok(failed.error);
  assert.ok(!failed.error.includes("segredo"));
});
function accountClient(identity, row = profile, error = null) {
  const calls = [];
  const query = {
    select: () => query,
    eq: (...args) => {
      calls.push(args);
      return query;
    },
    maybeSingle: async () => ({ data: row, error }),
  };
  return {
    calls,
    auth: { getUser: async () => identity },
    from: () => {
      calls.push("query");
      return query;
    },
  };
}
test("conta valida getUser antes de consultar perfil e usa somente ID confirmado", async () => {
  const forged = accountClient({
    data: { user: null },
    error: { message: "JWT falso" },
  });
  assert.equal((await loadAccount(forged)).kind, "signed-out");
  assert.deepEqual(forged.calls, []);
  const client = accountClient({ data: { user }, error: null });
  assert.equal((await loadAccount(client)).kind, "active");
  assert.deepEqual(client.calls, [
    "query",
    ["id", user.id],
    ["account_status", "active"],
  ]);
});
test("perfil alheio, pendente, desativado ou não verificado nunca concede acesso", async () => {
  for (const row of [
    null,
    { ...profile, id: "user-b" },
    { ...profile, account_status: "pending" },
    { ...profile, account_status: "disabled" },
  ])
    assert.equal(
      (await loadAccount(accountClient({ data: { user }, error: null }, row)))
        .kind,
      "pending",
    );
  const unverified = accountClient({
    data: { user: { ...user, email_confirmed_at: null } },
    error: null,
  });
  assert.equal((await loadAccount(unverified)).kind, "pending");
  assert.deepEqual(unverified.calls, []);
  assert.equal(
    (
      await loadAccount(
        accountClient({ data: { user }, error: null }, null, {
          message: "base indisponível",
        }),
      )
    ).kind,
    "unavailable",
  );
});
