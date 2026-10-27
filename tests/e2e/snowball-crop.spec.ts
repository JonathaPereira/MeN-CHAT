import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const png = readFileSync(
  new URL("../fixtures/foto-teste.png", import.meta.url),
);
async function launch(page: Page, settings = {}) {
  await page.addInitScript((settings) => {
    localStorage.setItem("mn-chat-preferences-v1", JSON.stringify(settings));
    const calls: number[][] = [];
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: (pattern: number[]) => {
        calls.push(pattern);
        return true;
      },
    });
    Object.assign(window, { vibrationCalls: calls });
  }, settings);
  await page.goto("/conversas");
}
async function throwBall(page: Page) {
  await page.getByRole("button", { name: "Abrir emojis e figurinhas" }).click();
  await page
    .getByRole("button", { name: "Jogar bola de neve", exact: true })
    .click();
}
async function group(page: Page) {
  const back = page.getByRole("button", { name: "Abrir lista de conversas" });
  if (page.viewportSize()!.width < 768) await back.click();
  await page
    .getByRole("complementary", { name: "Lista de conversas" })
    .getByRole("button", { name: /Família reunida/ })
    .click();
}
async function vibrations(page: Page) {
  return page.evaluate(
    () => (window as unknown as { vibrationCalls: number[][] }).vibrationCalls,
  );
}

test("bola de neve é única no privado e no grupo, não apaga rascunho nem repete ao abrir histórico", async ({
  page,
}) => {
  await launch(page);
  await page.getByLabel("Mensagem", { exact: true }).fill("Meu rascunho");
  await throwBall(page);
  await expect(page.getByRole("log")).toContainText(
    "Você jogou uma bola de neve",
  );
  await expect(page.getByLabel("Mensagem", { exact: true })).toHaveValue(
    "Meu rascunho",
  );
  await expect(
    page.getByRole("status", { name: "Aviso de notificação" }),
  ).toContainText("bola de neve de teste");
  expect(await vibrations(page)).toEqual([[90, 50, 90]]);
  await page.getByRole("button", { name: "Abrir emojis e figurinhas" }).click();
  await expect(
    page.getByRole("button", { name: "Bola de neve já usada", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await group(page);
  await throwBall(page);
  await expect(page.getByRole("log").locator(".snowball-message")).toHaveCount(
    1,
  );
  expect(await vibrations(page)).toHaveLength(2);
  await page.getByRole("button", { name: "Abrir emojis e figurinhas" }).click();
  await expect(
    page.getByRole("button", { name: "Bola de neve já usada", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await page
    .getByRole("heading", { name: "Família reunida", exact: true })
    .getByRole("button")
    .click();
  await page.keyboard.press("Escape");
  expect(await vibrations(page)).toHaveLength(2);
});
test("bola de neve respeita silenciamento, notificações e vibração desativada", async ({
  page,
}) => {
  await launch(page, { snowballVibration: false, mutedChatIds: ["familia"] });
  await throwBall(page);
  await expect(
    page.getByRole("status", { name: "Aviso de notificação" }),
  ).toBeVisible();
  expect(await vibrations(page)).toEqual([]);
  await page.getByRole("button", { name: "Fechar notificação" }).click();
  await group(page);
  await throwBall(page);
  await expect(
    page.getByRole("status", { name: "Aviso de notificação" }),
  ).toHaveCount(0);
  await expect(page.locator(".snowball-burst")).toHaveCount(0);
  expect(await vibrations(page)).toEqual([]);
  await page.goto("/configuracoes");
  await page.getByRole("button", { name: /Notificações Avisos/ }).click();
  await page
    .getByRole("switch", { name: "Receber notificações", exact: true })
    .uncheck();
  await page.getByRole("button", { name: "Todas as configurações" }).click();
  await page.getByRole("link", { name: "Voltar ao chat" }).click();
  // Um novo privado tem uma cota independente.
  const back = page.getByRole("button", { name: "Abrir lista de conversas" });
  if (page.viewportSize()!.width < 768) await back.click();
  await page
    .getByRole("complementary", { name: "Lista de conversas" })
    .getByRole("button", { name: /Ana Oliveira/ })
    .click();
  await throwBall(page);
  await expect(
    page.getByRole("status", { name: "Aviso de notificação" }),
  ).toHaveCount(0);
  expect(await vibrations(page)).toEqual([]);
});
test("recorte com zoom, teclado, arraste e formato circular é salvo na figurinha", async ({
  page,
}) => {
  await page.goto("/conversas");
  await page.getByRole("button", { name: "Abrir emojis e figurinhas" }).click();
  const dialog = page.getByRole("dialog", { name: "Emojis e figurinhas" });
  await dialog.getByRole("button", { name: "Figurinhas", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Criar figurinha", exact: true }),
  ).toBeEnabled();
  await dialog
    .getByLabel("Imagem para criar figurinha")
    .setInputFiles({ name: "recorte.png", mimeType: "image/png", buffer: png });
  const preview = dialog.getByRole("img", { name: "Prévia da figurinha" });
  const original = await preview.evaluate((element: HTMLCanvasElement) =>
    element.toDataURL(),
  );
  await dialog.getByLabel("Zoom da figurinha").focus();
  await dialog.getByLabel("Zoom da figurinha").press("End");
  await expect(dialog.getByLabel("Zoom da figurinha")).toHaveValue("4");
  await preview.focus();
  await preview.press("ArrowRight");
  await expect(
    dialog.getByLabel("Posição horizontal da figurinha"),
  ).toHaveValue("5");
  await preview.scrollIntoViewIfNeeded();
  const box = (await preview.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 20,
    box.y + box.height / 2 + 10,
  );
  await page.mouse.up();
  expect(
    Number(
      await dialog.getByLabel("Posição horizontal da figurinha").inputValue(),
    ),
  ).toBeGreaterThan(5);
  await dialog.getByRole("button", { name: "Redefinir recorte" }).click();
  await expect(dialog.getByLabel("Zoom da figurinha")).toHaveValue("1");
  await expect(
    dialog.getByLabel("Posição horizontal da figurinha"),
  ).toHaveValue("0");
  await expect
    .poll(() =>
      preview.evaluate((element: HTMLCanvasElement) => element.toDataURL()),
    )
    .toBe(original);
  await dialog.getByLabel("Formato do recorte").selectOption("circle");
  await dialog
    .getByRole("button", { name: "Salvar figurinha", exact: true })
    .click();
  const alpha = await dialog
    .getByRole("img", { name: "recorte", exact: true })
    .evaluate(async (element: HTMLImageElement) => {
      const image = await createImageBitmap(
        await (await fetch(element.src)).blob(),
      );
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 512;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0);
      image.close();
      return [
        ctx.getImageData(20, 20, 1, 1).data[3],
        ctx.getImageData(256, 256, 1, 1).data[3],
      ];
    });
  expect(alpha).toEqual([0, 255]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
