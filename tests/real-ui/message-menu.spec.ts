import { test, expect } from "@playwright/test";
import { mock, createGroup } from "../support/browser-fixture";
test("seta abre menu local sem mover o histórico e responde mídia", async ({
  page,
}, info) => {
  await mock(page);
  await createGroup(page);
  await page
    .getByLabel("Selecionar anexo", { exact: true })
    .setInputFiles("tests/fixtures/foto-teste.png");
  await page
    .getByRole("button", { name: "Enviar mensagem", exact: true })
    .click();
  const bubble = page.locator("article.real-message").last();
  const arrow = bubble.getByRole("button", { name: "Opções da mensagem" });
  const bounds = await bubble.boundingBox(),
    button = await arrow.boundingBox();
  expect(button!.y).toBeLessThan(bounds!.y + 5);
  expect(button!.x + button!.width).toBeGreaterThan(
    bounds!.x + bounds!.width - 8,
  );
  const scroll = await page
    .locator(".real-message-list")
    .evaluate((el) => el.scrollTop);
  await arrow.click();
  await expect(
    page.getByRole("group", { name: "Ações da mensagem" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.locator(".real-message-list").evaluate((el) => el.scrollTop),
  ).toBe(scroll);
  await page.screenshot({ path: info.outputPath("menu.png") });
  await page.getByRole("button", { name: "Responder", exact: true }).click();
  await expect(page.getByLabel("Mensagem", { exact: true })).toBeFocused();
  await page.getByLabel("Mensagem", { exact: true }).fill("Resposta à foto");
  await page
    .getByRole("button", { name: "Enviar mensagem", exact: true })
    .click();
  await expect(page.locator(".message-quote").last()).toContainText("Anexo");
  await page.getByRole("button", { name: "Opções da mensagem" }).last().click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("group", { name: "Ações da mensagem" }),
  ).toHaveCount(0);
});
test("instalar no celular abre instruções mesmo sem oferta automática", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/conta/chat");
  await page
    .getByRole("button", { name: "Baixar app Android", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Instalar MenChat",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Endereço para abrir no celular")).toHaveValue(
    "http://127.0.0.1:3106",
  );
  await expect(dialog.getByText(/Android:/)).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: /Baixar APK Android/ }),
  ).toHaveAttribute("href", "/downloads/menchat-2.0.0.apk");
});

test("push informa configuração pendente sem pedir permissão antes da hora", async ({ page }) => {
  await mock(page); await createGroup(page);
  await page.evaluate(async () => { await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready; });
  await page.getByRole("link", { name: "Configurações da aplicação", exact: true }).click();
  await page.getByRole("button", { name: "Notificações", exact: true }).click();
  await page.getByRole("button", { name: "Ativar notificações em segundo plano", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("aguardam a configuração do administrador");
});
