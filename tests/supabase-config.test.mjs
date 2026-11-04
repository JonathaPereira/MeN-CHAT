import test from "node:test";
import assert from "node:assert/strict";
import { parseSupabaseConfig } from "../lib/supabase/config.ts";
import { checkSupabaseConnection } from "../lib/supabase/check-connection.ts";
const config = {
  url: "https://example.supabase.co",
  key: "sb_publishable_apenas_teste",
};
test("configuração exige URL HTTPS sem credenciais e somente chave publicável", () => {
  assert.deepEqual(parseSupabaseConfig(config.url + "/", config.key), config);
  assert.throws(() => parseSupabaseConfig("", ""), /Preencha/);
  for (const url of [
    "quebrado",
    "http://example.supabase.co",
    "https://user:pass@example.supabase.co",
    "https://example.supabase.co/rest/v1",
    "https://example.supabase.co/?x=1",
  ])
    assert.throws(() => parseSupabaseConfig(url, config.key));
  for (const key of ["sb_secret_segredo", "eyJ_service_role", "SENHA_TESTE_NAO_IMPRIMIR"])
    assert.throws(
      () => parseSupabaseConfig(config.url, key),
      (error) => !error.message.includes(key),
    );
});
test("teste de conexão faz somente GET com timeout e confirma cadastro bloqueado", async () => {
  const result = await checkSupabaseConnection(config, async (url, options) => {
    assert.equal(url, config.url + "/auth/v1/settings");
    assert.equal(options.method, undefined);
    assert.equal(options.headers.apikey, config.key);
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json({ disable_signup: true });
  });
  assert.equal(result.publicSignupDisabled, true);
});
test("cadastro aberto ou resposta inesperada não são sucesso", async () => {
  for (const payload of [
    { disable_signup: false },
    {},
    { disable_signup: "true" },
    null,
  ])
    await assert.rejects(
      checkSupabaseConnection(config, async () => Response.json(payload)),
      /cadastro público/,
    );
  await assert.rejects(
    checkSupabaseConnection(config, async () => new Response("html")),
    /Resposta inesperada/,
  );
});
test("erros de rede e autenticação não expõem credenciais ou corpo remoto", async () => {
  for (const status of [401, 403, 500])
    await assert.rejects(
      checkSupabaseConnection(
        config,
        async () => new Response(config.key, { status }),
      ),
      (error) => !error.message.includes(config.key),
    );
  await assert.rejects(
    checkSupabaseConnection(config, async () => {
      throw new Error(config.key);
    }),
    (error) => !error.message.includes(config.key),
  );
});
