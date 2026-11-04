import test from "node:test";
import assert from "node:assert/strict";
import { reserveUpload, uploadFile, discardUpload } from "../lib/chat/media.ts";
test("reserva usa dados do arquivo e upload não sobrescreve objeto existente", async () => {
  const file = new File(["teste"], "audio.webm", { type: "audio/webm" }),
    calls = [];
  const client = {
    rpc: async (name, args) => {
      calls.push([name, args]);
      return {
        data: [{ id: "id", path: "owner/id", kind: "audio" }],
        error: null,
      };
    },
    storage: {
      from: (bucket) => ({
        upload: async (path, body, options) => {
          calls.push([bucket, path, body, options]);
          return { error: null };
        },
      }),
    },
  };
  const item = await reserveUpload(client, "thread", file);
  await uploadFile(client, item, file);
  assert.deepEqual(calls[0], [
    "menchat_reserve_upload",
    {
      p_thread: "thread",
      p_name: "audio.webm",
      p_mime: "audio/webm",
      p_bytes: 5,
    },
  ]);
  assert.deepEqual(calls[1].at(-1), {
    contentType: "audio/webm",
    upsert: false,
    cacheControl: "0",
  });
});
test("repetição de upload aceita conflito e deixa confirmação final ao banco", async () => {
  const item = { id: "id", path: "owner/id", kind: "image" };
  for (const error of [
    { statusCode: "409", message: "Duplicate" },
    { statusCode: "400", message: "The resource already exists" },
  ]) {
    const client = {
      storage: { from: () => ({ upload: async () => ({ error }) }) },
    };
    await assert.doesNotReject(
      uploadFile(client, item, new File(["x"], "a.png", { type: "image/png" })),
    );
  }
  await assert.rejects(
    uploadFile(
      {
        storage: {
          from: () => ({
            upload: async () => ({ error: { message: "network secret" } }),
          }),
        },
      },
      item,
      new File(["x"], "a.png"),
    ),
    /mantido/,
  );
});
test("descarte remove objeto antes de cancelar a reserva, sem apagar mensagem", async () => {
  const calls = [];
  const client = {
    storage: {
      from: (bucket) => ({
        remove: async (paths) => {
          calls.push([bucket, paths]);
          return { error: null };
        },
      }),
    },
    rpc: async (name, args) => {
      calls.push([name, args]);
      return { data: false, error: null };
    },
  };
  await discardUpload(client, { id: "id", path: "owner/id", kind: "avatar" });
  assert.deepEqual(calls, [
    ["menchat-avatars", ["owner/id"]],
    ["menchat_cancel_upload", { p_upload: "id" }],
  ]);
});
