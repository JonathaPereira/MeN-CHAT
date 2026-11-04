import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  profile as baseProfile,
  userId,
  sessionCookie,
} from "../support/real-ui-fixtures.mjs";
export async function mock(page: Page, loseResponse = false) {
  let lost = false,
    failConfirm = false;
  let welcome: { name: string; code: string }[] = [];
  let invited = false,
    typing = false;
  const stars = new Set<string>();
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
    else if (path === "/rest/v1/rpc/menchat_inbox") data = threads;
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
        ...(invited
          ? [
              {
                id: "70000000-0000-0000-0000-000000000002",
                name: "Ana Teste",
                status: "Olá",
                avatar_path: null,
                code: "AN4T12",
                role: "member",
                received_seq: 0,
                read_seq: 0,
                is_typing: typing,
                shares_read: true,
              },
            ]
          : []),
      ];
    else if (path === "/rest/v1/rpc/menchat_welcome") data = welcome;
    else if (path === "/rest/v1/rpc/menchat_seen") {
      for (const t of threads) if (t.id === body.p_thread) t.unread_count = 0;
      data = null;
    } else if (path === "/rest/v1/rpc/menchat_delete_message") {
      const index = messages.findIndex((m) => m.id === body.p_id);
      if (index >= 0) {
        if (body.p_everyone)
          Object.assign(messages[index], {
            body: "Mensagem apagada.",
            attachment_id: null,
            deleted_at: new Date().toISOString(),
          });
        else messages.splice(index, 1);
      }
      data = null;
    } else if (path === "/rest/v1/rpc/menchat_touch") data = null;
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
            : String(body.p_mime).startsWith("video/")
              ? "video"
              : "image"
          : "avatar",
      };
      uploads.push(item);
      data = [item];
    } else if (path === "/rest/v1/rpc/menchat_starred") data = [...stars];
    else if (path === "/rest/v1/rpc/menchat_star_message") {
      if (body.p_star) stars.add(String(body.p_id));
      else stars.delete(String(body.p_id));
      data = body.p_star;
    } else if (path === "/rest/v1/rpc/menchat_send_composed") {
      const attachment = uploads.find((u) => u.id === body.p_upload);
      const previous = messages.find((m) => m.id === body.p_id);
      const row = previous || {
        id: body.p_id,
        thread_id: body.p_thread,
        sender_id: userId,
        body: body.p_body,
        seq: messages.length + 1,
        created_at: new Date().toISOString(),
        attachment_id: attachment?.id || null,
        reply_to: body.p_reply || null,
        mention_ids: body.p_mentions || [],
      };
      if (!previous) messages.push(row);
      if (attachment) attachment.used_by = body.p_id;
      if (attachment && loseResponse && !lost) {
        lost = true;
        failConfirm = true;
        await route.fulfill({
          status: 503,
          json: { message: "Resposta perdida de teste" },
        });
        return;
      }
      data = row;
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
            (url.searchParams.get("id")?.startsWith("in.")
              ? url.searchParams
                  .get("id")!
                  .slice(4, -1)
                  .split(",")
                  .includes(String(m.id))
              : String(m.id) === url.searchParams.get("id")?.slice(3)),
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
    seedParticipants: () => {
      invited = true;
    },
    setTyping: (value: boolean) => {
      typing = value;
    },
    seedWelcome: () => {
      welcome = [{ name: "Quem convidou", code: "B0T123" }];
    },
    seedInbox: () =>
      threads.push({
        id: randomUUID(),
        name: "Mensagens novas",
        kind: "group",
        can_send: true,
        owner_id: userId,
        creator_id: userId,
        last_at: new Date().toISOString(),
        last_body: "Olá",
        last_sender: "other",
        unread_count: 3,
      }),
    recover: () => {
      failConfirm = false;
    },
  };
}
export async function createGroup(page: Page) {
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
