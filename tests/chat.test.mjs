import test from "node:test";
import assert from "node:assert/strict";
import { generateUserCode, normalizeUserCode } from "../lib/user-code.ts";
import { validateAttachment, formatFileSize } from "../lib/attachments.ts";
import { automatedReply } from "../lib/auto-reply.ts";

test("códigos são únicos na amostra e têm exatamente seis letras/números misturados", () => {
  const codes = [];
  for (let i = 0; i < 1000; i++) {
    const code = generateUserCode(codes);
    assert.match(code, /^[A-Z0-9]{6}$/);
    assert.match(code, /[A-Z]/);
    assert.match(code, /[0-9]/);
    assert.ok(!codes.includes(code));
    codes.push(code);
  }
});
test("a busca por código aceita espaços e caixa baixa", () =>
  assert.equal(normalizeUserCode(" a1b2c3 "), "A1B2C3"));
test("fotos aceitam o limite exato e rejeitam um byte a mais", () => {
  assert.equal(
    validateAttachment({ name: "foto.png", type: "image/png", size: 5_000_000 })
      .kind,
    "image",
  );
  assert.match(
    validateAttachment({ name: "foto.png", type: "image/png", size: 5_000_001 })
      .error,
    /limite/,
  );
});
test("vídeos usam a política de 25 MB", () => {
  assert.equal(
    validateAttachment({
      name: "video.mp4",
      type: "video/mp4",
      size: 25_000_000,
    }).kind,
    "video",
  );
  assert.match(
    validateAttachment({
      name: "video.mp4",
      type: "video/mp4",
      size: 25_000_001,
    }).error,
    /limite/,
  );
});
test("áudios e documentos usam limite de 10 MB", () => {
  assert.equal(
    validateAttachment({
      name: "audio.mp3",
      type: "audio/mpeg",
      size: 10_000_000,
    }).kind,
    "audio",
  );
  assert.equal(
    validateAttachment({
      name: "arquivo.pdf",
      type: "application/pdf",
      size: 10_000_000,
    }).kind,
    "document",
  );
  assert.match(
    validateAttachment({
      name: "arquivo.pdf",
      type: "application/pdf",
      size: 10_000_001,
    }).error,
    /limite/,
  );
});
test("arquivos vazios, tipos desconhecidos e extensões executáveis são rejeitados", () => {
  assert.match(
    validateAttachment({ name: "vazio.txt", type: "text/plain", size: 0 })
      .error,
    /vazio/,
  );
  assert.match(
    validateAttachment({
      name: "arquivo.bin",
      type: "application/octet-stream",
      size: 100,
    }).error,
    /não permitido/,
  );
  assert.match(
    validateAttachment({ name: "disfarce.exe", type: "image/png", size: 100 })
      .error,
    /não permitido/,
  );
  assert.match(
    validateAttachment({ name: "script.svg", type: "image/svg+xml", size: 100 })
      .error,
    /não permitido/,
  );
});
test("tamanho exibido usa MB decimais e KB legíveis", () => {
  assert.equal(formatFileSize(5_000_000), "5.0 MB");
  assert.equal(formatFileSize(2000), "2 KB");
});
test("assistente responde em português e identifica prévias de arquivos locais", () => {
  assert.match(automatedReply("olá", false), /assistente de teste/);
  assert.match(
    automatedReply("como criar grupo?", false),
    /participantes fictícios/,
  );
  assert.match(automatedReply("modo escuro", false), /modo escuro/);
  assert.match(automatedReply("qualquer mensagem", false), /automática/);
  assert.match(automatedReply("", true), /nenhum arquivo foi enviado/);
});

test("IDs locais usam UUID v4 sem depender da API exclusiva de HTTPS", async () => {
  const { createDemoId } = await import("../lib/demo-id.ts");
  const ids = new Set();
  for (let i = 0; i < 1000; i++) {
    const id = createDemoId();
    assert.match(
      id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    assert.ok(!ids.has(id));
    ids.add(id);
  }
});

test("preferências rejeitam valores inválidos e mantêm padrões seguros", async () => {
  const { parsePreferences } = await import("../lib/preferences.ts");
  assert.equal(parsePreferences("quebrado").messagePreview, false);
  const parsed = parsePreferences(
    JSON.stringify({
      textSize: "enorme",
      playbackRate: 900,
      notificationsEnabled: "sim",
      autoAudio: false,
      mutedChatIds: ["ana", 42],
    }),
  );
  assert.equal(parsed.textSize, "normal");
  assert.equal(parsed.playbackRate, 1);
  assert.equal(parsed.notificationsEnabled, true);
  assert.equal(parsed.autoAudio, false);
  assert.deepEqual(parsed.mutedChatIds, ["ana"]);
});
test("notificações respeitam conversa ativa, controle geral e silenciamento", async () => {
  const { defaultPreferences: settings, shouldNotify } =
    await import("../lib/preferences.ts");
  assert.equal(shouldNotify(settings, "ana", false), false);
  assert.equal(shouldNotify(settings, "ana", true), true);
  assert.equal(
    shouldNotify({ ...settings, notificationsEnabled: false }, "ana", true),
    false,
  );
  assert.equal(
    shouldNotify({ ...settings, mutedChatIds: ["ana"] }, "ana", true),
    false,
  );
  assert.equal(
    shouldNotify({ ...settings, onlyWhenAway: false }, "ana", false),
    true,
  );
});
test("economia de dados bloqueia prévias automáticas de todos os tipos de mídia", async () => {
  const { defaultPreferences: settings, shouldLoadMedia } =
    await import("../lib/preferences.ts");
  for (const kind of ["image", "audio", "video"]) {
    assert.equal(shouldLoadMedia(settings, kind), true);
    assert.equal(
      shouldLoadMedia({ ...settings, dataSaver: true }, kind),
      false,
    );
  }
  assert.equal(
    shouldLoadMedia({ ...settings, autoAudio: false }, "audio"),
    false,
  );
});
