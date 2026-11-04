import test from "node:test";
import assert from "node:assert/strict";
import { chatError } from "../lib/chat/errors.ts";
test("avisos de quota distinguem armazenamento, limite diário e permissões sem expor detalhes", () => {
  assert.match(
    chatError({ message: "Armazenamento do aplicativo cheio (500 MB)." }),
    /armazenamento.*cheio/,
  );
  assert.match(
    chatError({ message: "Limite diário de 100 MB atingido." }),
    /24 horas/,
  );
  assert.match(chatError({ statusCode: "402" }), /provedor/);
  assert.match(
    chatError({ code: "42501", message: "secret interno" }),
    /permissão/,
  );
  assert.doesNotMatch(chatError({ message: "secret interno" }), /secret/);
});
