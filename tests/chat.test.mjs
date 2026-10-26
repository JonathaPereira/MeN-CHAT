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
