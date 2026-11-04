import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  profile as baseProfile,
  userId,
  sessionCookie,
} from "../support/real-ui-fixtures.mjs";
async function mock(page: Page, loseResponse = false) {
  let lost = false,
    failConfirm = false;
  const blobs = new Map<string, Buffer>();
  const profile = { ...baseProfile };
  const threads: Record<string, unknown>[] = [],
    messages: Record<string, unknown>[] = [],
    uploads: Record<string, unknown>[] = [];
  await page.context().addCookies([
    {
      name: "sb-menchat-auth-token",
      value: sessionCookie(),
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.routeWebSocket(/menchat\.invalid/, (socket) => socket.close());
  await page.route("https://menchat.invalid/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    let body: Record<string, unknown> = {};
    try {
      body = req.postDataJSON() || {};
    } catch {}
    const path = url.pathname,
      object = req.headers().accept?.includes("application/vnd.pgrst.object");
    let data: unknown = {};
    if (path === "/auth/v1/user")
      data = {
        id: userId,
        email: "ui@example.test",
        email_confirmed_at: "2026-11-04T00:00:00Z",
      };
    else if (path === "/rest/v1/menchat_profiles")
      data = object ? profile : [profile];
    else if (path === "/rest/v1/rpc/menchat_list_chats") data = threads;
    else if (path === "/rest/v1/rpc/menchat_create_group") {
      const id = randomUUID();
      threads.push({
        id,
        name: body.p_name,
        kind: "group",
        can_send: true,
        avatar_path: null,
        creator_id: userId,
        owner_id: userId,
        last_body: null,
        last_at: new Date().toISOString(),
        last_sender: null,
      });
      data = id;
    } else if (path === "/rest/v1/rpc/menchat_participants")
      data = [
        {
          id: userId,
          name: profile.display_name,
          status: profile.status_message,
          avatar_path: profile.avatar_path,
          code: profile.show_code ? profile.user_code : null,
          role: "admin",
          received_seq: 999,
          read_seq: 999,
          is_typing: false,
          shares_read: true,
        },
      ];
    else if (path === "/rest/v1/rpc/menchat_touch") data = null;
    else if (path === "/rest/v1/rpc/menchat_reserve_upload") {
      const id = randomUUID();
      const item = {
        id,
        path: `${userId}/${id}`,
        name: body.p_name,
        mime: body.p_mime,
        bytes: body.p_bytes,
        kind: body.p_thread
          ? String(body.p_mime).startsWith("audio/")
            ? "audio"
            : "image"
          : "avatar",
      };
      uploads.push(item);
      data = [item];
    } else if (path === "/rest/v1/rpc/menchat_send_upload") {
      const attachment = uploads.find((u) => u.id === body.p_upload);
      const row = {
        id: body.p_message,
        thread_id: threads[0].id,
        sender_id: userId,
        body: body.p_body,
        seq: messages.length + 1,
        created_at: new Date().toISOString(),
        attachment_id: attachment?.id,
      };
      messages.push(row);
      if (attachment) attachment.used_by = body.p_message;
      if (loseResponse && !lost) {
        lost = true;
        failConfirm = true;
        await route.fulfill({
          status: 503,
          json: { message: "Resposta perdida de teste" },
        });
        return;
      }
      data = body.p_message;
    } else if (path === "/rest/v1/rpc/menchat_save_profile") {
      Object.assign(profile, {
        avatar_path: body.p_avatar
          ? uploads.find((u) => u.id === body.p_avatar)?.path
          : profile.avatar_path,
        display_name: body.p_name,
        status_message: body.p_status,
        show_code: body.p_show_code,
        allow_code_lookup: body.p_lookup,
        read_receipts: body.p_read,
        show_typing: body.p_typing,
      });
      data = null;
    } else if (path === "/rest/v1/rpc/menchat_cancel_upload") data = true;
    else if (path === "/rest/v1/menchat_messages") {
      if (req.method() === "POST") {
        const row = {
          ...body,
          id: body.id,
          seq: messages.length + 1,
          created_at: new Date().toISOString(),
          attachment_id: null,
        };
        messages.push(row);
        data = object ? row : [row];
      } else {
        if (failConfirm && url.searchParams.has("id")) {
          await route.fulfill({
            status: 503,
            json: { message: "Confirmação temporariamente indisponível" },
          });
          return;
        }
        let rows = messages.filter(
          (m) =>
            !url.searchParams.get("id") ||
            String(m.id) === url.searchParams.get("id")?.slice(3),
        );
        const seq = url.searchParams.get("seq");
        if (seq?.startsWith("gt."))
          rows = rows.filter((m) => Number(m.seq) > Number(seq.slice(3)));
        data = object ? rows[0] || null : rows;
      }
    } else if (path === "/rest/v1/menchat_uploads")
      data =
        uploads.find((u) => u.id === url.searchParams.get("id")?.slice(3)) ||
        null;
    else if (
      path.startsWith("/storage/v1/object/sign/") &&
      req.method() === "POST"
    )
      data = { signedURL: path.slice("/storage/v1".length) + "?token=ui-only" };
    else if (path.startsWith("/storage/v1/object/sign/")) {
      const id = path.split("/").at(-1) || "";
      const item = uploads.find((u) => u.id === id);
      let bytes = blobs.get(id);
      // CDP pode omitir bytes de File vindo do disco em multipart; as fixtures têm nomes fixos.
      if (!bytes?.length)
        bytes = await readFile(
          new URL(
            item?.name === "audio-teste.mp3"
              ? "../fixtures/audio-teste.mp3"
              : "../fixtures/foto-teste.png",
            import.meta.url,
          ),
        );
      await route.fulfill({
        body: bytes,
        contentType: String(item?.mime || "image/png"),
      });
      return;
    } else if (path.startsWith("/storage/v1/object/")) {
      if (req.method() === "POST") {
        const item = uploads.find((u) => u.id === path.split("/").at(-1));
        if (item?.used_by) {
          await route.fulfill({
            status: 403,
            json: { message: "Objeto publicado não pode ser sobrescrito" },
          });
          return;
        }
        const contentType = req.headers()["content-type"] || "";
        const bytes = req.postDataBuffer();
        if (bytes) {
          const form = await new Request("http://fixture", {
            method: "POST",
            headers: { "content-type": contentType },
            body: new Uint8Array(bytes),
          }).formData();
          const file = form.get("");
          if (file instanceof File)
            blobs.set(
              path.split("/").at(-1) || "",
              Buffer.from(await file.arrayBuffer()),
            );
        }
      }
      data = { Key: "fixture", Id: randomUUID() };
    } else {
      await route.fulfill({
        status: 404,
        json: { message: "Endpoint não simulado" },
      });
      return;
    }
    await route.fulfill({ status: 200, json: data });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  return {
    recover: () => {
      failConfirm = false;
    },
  };
}
async function createGroup(page: Page) {
  await page.goto("/conta/chat");
  await page.getByRole("button", { name: "Criar grupo", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Criar grupo", exact: true });
  await dialog.getByLabel("Nome do grupo").fill("Meu espaço");
  await dialog
    .getByRole("button", { name: "Criar grupo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Meu espaço", exact: true }),
  ).toBeVisible();
}
test("grupo solo, texto, mídia, áudio e detalhes funcionam no layout real", async ({
  page,
}, testInfo) => {
  await mock(page);
  await createGroup(page);
  await page
    .getByLabel("Mensagem", { exact: true })
    .fill("Primeira mensagem real da interface");
  await page
    .getByRole("button", { name: "Enviar mensagem", exact: true })
    .click();
  await expect(
    page.getByRole("log").getByText("Primeira mensagem real da interface"),
  ).toBeVisible();
  await page
    .getByLabel("Selecionar anexo", { exact: true })
    .setInputFiles("tests/fixtures/foto-teste.png");
  await expect(
    page.getByText("foto-teste.png", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Enviar mensagem", exact: true })
    .click();
  await expect(
    page
      .getByRole("log")
      .getByRole("button", { name: "Baixar foto-teste.png" }),
  ).toBeVisible();
  await page
    .getByLabel("Selecionar anexo", { exact: true })
    .setInputFiles("tests/fixtures/audio-teste.mp3");
  await page
    .getByRole("button", { name: "Enviar mensagem", exact: true })
    .click();
  await expect(page.getByRole("log").locator("audio")).toBeVisible();
  await page
    .getByRole("log")
    .locator("audio")
    .evaluate(async (node) => {
      const audio = node as HTMLAudioElement;
      audio.muted = true;
      await audio.play();
    });
  await expect
    .poll(() =>
      page
        .getByRole("log")
        .locator("audio")
        .evaluate((node) => (node as HTMLAudioElement).currentTime),
    )
    .toBeGreaterThan(0);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/menchat-real-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Ver detalhes de Meu espaço" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Detalhes do grupo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Adicionar participante" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fechar janela" }).click();
  await page
    .getByRole("button", { name: "Ver confirmações da mensagem" })
    .first()
    .click();
  await expect(page.getByText("Esta conversa tem apenas você.")).toBeVisible();
});
test("perfil real salva nome/status/privacidade e configurações têm submenus", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/conta/perfil");
  await page.getByLabel("Nome", { exact: true }).fill("Meu novo nome");
  await page.getByLabel("Seu status").fill("Jogando e conversando 🎮");
  await page.getByLabel("Mostrar meu código no perfil").uncheck();
  await page.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(page.getByRole("status")).toContainText("Perfil salvo");
  await page
    .getByLabel("Escolher foto de perfil")
    .setInputFiles("tests/fixtures/foto-teste.png");
  await expect(page.getByAltText("Prévia da foto de perfil")).toBeVisible();
  await page.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(page.getByRole("status")).toContainText("Perfil salvo");
  await page.goto("/conta/configuracoes");
  await page
    .getByRole("button", { name: "Dados e armazenamento", exact: true })
    .click();
  await page.getByLabel("Economia de dados").check();
  await expect(page.getByLabel("Economia de dados")).toBeChecked();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("microfone grava e envia com dois cliques sem modal de anexo", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  await mock(page);
  await createGroup(page);
  await page.getByRole("button", { name: "Gravar mensagem de voz" }).click();
  await expect(
    page.getByRole("region", { name: "Gravador de áudio" }),
  ).toBeVisible();
  await expect(page.getByText(/Gravando · 0:0[1-9]/)).toBeVisible();
  await page.getByRole("button", { name: "Enviar áudio", exact: true }).click();
  await expect(page.getByRole("log").locator("audio")).toBeVisible();
  await page
    .getByRole("log")
    .locator("audio")
    .evaluate(async (node) => {
      const audio = node as HTMLAudioElement;
      audio.muted = true;
      await audio.play();
    });
  await expect
    .poll(() =>
      page
        .getByRole("log")
        .locator("audio")
        .evaluate((node) => (node as HTMLAudioElement).currentTime),
    )
    .toBeGreaterThan(0);

  await expect(
    page.getByRole("region", { name: "Gravador de áudio" }),
  ).toHaveCount(0);
});

test("resposta perdida de mídia permite repetir sem reenviar o objeto publicado", async ({
  page,
}) => {
  const service = await mock(page, true);
  await createGroup(page);
  await page
    .getByLabel("Selecionar anexo", { exact: true })
    .setInputFiles("tests/fixtures/foto-teste.png");
  await page
    .getByRole("button", { name: "Enviar mensagem", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Envio não confirmado" }),
  ).toBeVisible({ timeout: 20000 });
  service.recover();
  await page
    .getByRole("button", { name: "Enviar mensagem", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Remover anexo", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("log")
      .getByRole("button", { name: "Baixar foto-teste.png" }),
  ).toHaveCount(1);
});
