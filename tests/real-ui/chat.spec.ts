import { expect, test } from "@playwright/test";
import { mock, createGroup } from "../support/browser-fixture";
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
      .getByRole("button", { name: "Baixar imagem", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Selecionar anexo", { exact: true })
    .setInputFiles("tests/fixtures/audio-teste.mp3");
  await page
    .getByRole("button", { name: "Enviar mensagem", exact: true })
    .click();
  await expect(
    page.getByRole("log").getByRole("button", { name: "Reproduzir áudio" }),
  ).toBeVisible();
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
  await expect(
    page.getByRole("log").getByRole("button", { name: "Reproduzir áudio" }),
  ).toBeVisible();
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
      .getByRole("button", { name: "Baixar imagem", exact: true }),
  ).toHaveCount(1);
});

test("não lidas mostram quantidade e mensagens podem ser apagadas", async ({
  page,
}) => {
  const service = await mock(page);
  service.seedInbox();
  await page.goto("/conta/chat");
  await expect(page.getByLabel("3 mensagens não lidas")).toBeVisible();
  await page.getByRole("button", { name: /Mensagens novas/ }).click();
  await page
    .getByLabel("Mensagem", { exact: true })
    .fill("Mensagem descartável");
  await page
    .getByRole("button", { name: "Enviar mensagem", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Opções da mensagem", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Apagar para todos", exact: true })
    .click();
  await expect(
    page.getByRole("log").getByText("Mensagem apagada.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Opções da mensagem", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Apagar para mim", exact: true })
    .click();
  await expect(
    page.getByRole("log").getByText("Mensagem apagada.", { exact: true }),
  ).toHaveCount(0);
});

test("convite aceito mostra o código de quem convidou", async ({ page }) => {
  const service = await mock(page);
  service.seedWelcome();
  await page.goto("/conta/chat");
  await expect(page.getByText("B0T123", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Conversar com Quem" }),
  ).toBeVisible();
});
