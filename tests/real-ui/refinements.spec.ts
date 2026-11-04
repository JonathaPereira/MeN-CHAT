import { expect, test } from "@playwright/test";
import { mock, createGroup } from "../support/browser-fixture";
test("fotos ampliáveis e áudios sem nomes nem opções extras", async ({
  page,
}, testInfo) => {
  await mock(page);
  await createGroup(page);
  await page
    .getByLabel("Selecionar anexo", { exact: true })
    .setInputFiles("tests/fixtures/foto-teste.png");
  await page
    .getByRole("button", { name: "Enviar mensagem", exact: true })
    .click();
  await expect(
    page.getByRole("log").getByText("foto-teste.png", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Ampliar foto", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "Foto", exact: true });
  await expect(viewer).toBeVisible();
  await viewer.getByRole("button", { name: "Aumentar foto" }).click();
  await expect(viewer.getByText("150%", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByLabel("Selecionar anexo", { exact: true })
    .setInputFiles("tests/fixtures/audio-teste.mp3");
  await page
    .getByRole("button", { name: "Enviar mensagem", exact: true })
    .click();
  await expect(
    page.getByRole("log").getByText("audio-teste.mp3", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Recarregar prévia" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Baixar áudio", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reproduzir áudio", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pausar áudio", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pausar áudio", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Reproduzir áudio", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("midia.png") });
});
test("respostas, marcações e menções em grupo preservam o contexto", async ({
  page,
}) => {
  const service = await mock(page);
  service.seedParticipants();
  await createGroup(page);
  await page.getByLabel("Mensagem", { exact: true }).fill("Mensagem original");
  await page
    .getByRole("button", { name: "Enviar mensagem", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Opções da mensagem", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Marcar mensagem", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mensagens marcadas", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog", { name: "Mensagens marcadas" })
      .getByText("Mensagem original", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fechar janela" }).click();
  await page
    .getByRole("button", { name: "Opções da mensagem", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Responder", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cancelar resposta" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mencionar participante", exact: true })
    .click();
  await page.getByRole("button", { name: "Ana Teste", exact: true }).click();
  await page.getByLabel("Mensagem", { exact: true }).press("End");
  await page.getByLabel("Mensagem", { exact: true }).press("Space");
  await page.getByLabel("Mensagem", { exact: true }).press("KeyO");
  await page
    .getByRole("button", { name: "Enviar mensagem", exact: true })
    .click();
  await expect(
    page
      .locator(".message-quote")
      .getByText("Mensagem original", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".message-mentions").getByText("@Ana Teste", { exact: true }),
  ).toBeVisible();
  service.setTyping(true);
  await expect(
    page.getByRole("status", { name: "Digitação na conversa" }),
  ).toContainText("Ana está digitando");
  service.setTyping(false);
  await expect(
    page.getByRole("status", { name: "Digitação na conversa" }),
  ).toHaveCount(0);
});
test("configurações abrem sem navegar e preservam o rascunho", async ({
  page,
}, testInfo) => {
  await mock(page);
  await createGroup(page);
  await page
    .getByLabel("Mensagem", { exact: true })
    .fill("Rascunho preservado");
  const navigations: string[] = [];
  page.on("request", (request) => {
    if (
      request.url().includes("/conta/configuracoes") ||
      request.url().includes("/auth/v1/user")
    )
      navigations.push(request.url());
  });
  const start = Date.now();
  await page
    .getByRole("link", { name: "Configurações da aplicação", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Configurações", exact: true }),
  ).toBeVisible();
  const elapsed = Date.now() - start;
  console.log(
    `[${testInfo.project.name}] Configurações: ${elapsed} ms, ${navigations.length} requisições de página/Auth.`,
  );
  testInfo.annotations.push({
    type: "navigation",
    description: `Configurações: ${elapsed} ms; novas validações de página: ${navigations.length}`,
  });
  expect(navigations).toEqual([]);
  await page.getByRole("button", { name: "Fechar janela" }).click();
  await expect(page.getByLabel("Mensagem", { exact: true })).toHaveValue(
    "Rascunho preservado",
  );
  await expect(page).toHaveURL(/\/conta\/chat$/);
});
test("câmera captura foto e vídeo e libera os dispositivos", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["camera", "microphone"]);
  await page.addInitScript(() => {
    const captured: MediaStream[] = [];
    (window as unknown as { captured: MediaStream[] }).captured = captured;
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (options) => {
      const stream = await original(options);
      captured.push(stream);
      return stream;
    };
  });
  await mock(page);
  await createGroup(page);
  await page.getByRole("button", { name: "Câmera", exact: true }).click();
  await page.getByRole("button", { name: "Abrir câmera", exact: true }).click();
  await page.getByRole("button", { name: "Tirar foto", exact: true }).click();
  await expect(page.getByAltText("Prévia do anexo")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { captured: MediaStream[] }).captured.every((s) =>
          s.getTracks().every((t) => t.readyState === "ended"),
        ),
      ),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Enviar mensagem", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Ampliar foto" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Câmera", exact: true }).click();
  await page.getByRole("button", { name: "Abrir câmera", exact: true }).click();
  await page.getByRole("button", { name: "Gravar vídeo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Concluir vídeo" }),
  ).toBeVisible();
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "Concluir vídeo" }).click();
  await expect(
    page.getByRole("button", { name: "Remover anexo" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { captured: MediaStream[] }).captured.every((s) =>
          s.getTracks().every((t) => t.readyState === "ended"),
        ),
      ),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Enviar mensagem", exact: true })
    .click();
  await expect(page.getByRole("log").locator("video")).toBeVisible();
});
test("fechar a câmera antes da permissão resolver encerra o stream tardio", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["camera"]);
  await page.addInitScript(() => {
    const state = {
      stream: null as MediaStream | null,
      release: null as (() => void) | null,
    };
    (window as unknown as { lateCamera: typeof state }).lateCamera = state;
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (options) => {
      const stream = await original(options);
      state.stream = stream;
      await new Promise<void>((resolve) => {
        state.release = resolve;
      });
      return stream;
    };
  });
  await mock(page);
  await createGroup(page);
  await page.getByRole("button", { name: "Câmera", exact: true }).click();
  await page.getByRole("button", { name: "Abrir câmera", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          !!(window as unknown as {
            lateCamera: { release: (() => void) | null };
          }).lateCamera.release,
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Fechar janela" }).click();
  await page.evaluate(() =>
    (window as unknown as { lateCamera: { release: () => void } })
      .lateCamera.release(),
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { lateCamera: { stream: MediaStream } })
          .lateCamera.stream.getTracks()
          .every((track) => track.readyState === "ended"),
      ),
    )
    .toBe(true);
  await expect(
    page.getByRole("dialog", { name: "Câmera", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Remover anexo" })).toHaveCount(0);
});
