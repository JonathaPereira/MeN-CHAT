import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
const png = readFileSync(
  new URL("../fixtures/foto-teste.png", import.meta.url),
);
async function picker(page: Page) {
  await page.getByRole("button", { name: "Abrir emojis e figurinhas" }).click();
  return page.getByRole("dialog", { name: "Emojis e figurinhas" });
}
async function stickers(page: Page) {
  const dialog = await picker(page);
  await dialog.getByRole("button", { name: "Figurinhas", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Criar figurinha", exact: true }),
  ).toBeEnabled();
  return dialog;
}
test("busca emoji sem acentos, insere no cursor e conserva texto", async ({
  page,
}) => {
  await page.goto("/conversas");
  const field = page.getByLabel("Mensagem", { exact: true });
  await field.fill("Olá mundo");
  await field.evaluate((element: HTMLTextAreaElement) =>
    element.setSelectionRange(4, 4),
  );
  const dialog = await picker(page);
  await dialog.getByLabel("Buscar emoji").fill("coracao");
  await dialog.getByRole("button", { name: "Coração", exact: true }).click();
  await expect(field).toHaveValue("Olá ❤️mundo");
  await field.press("Enter");
  await expect(page.getByRole("log")).toContainText("Olá ❤️mundo");
  await picker(page);
  await page.getByLabel("Buscar emoji").fill("zzzzzzz");
  await expect(page.getByRole("dialog")).toContainText(
    "Nenhum emoji encontrado",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await field.fill("a".repeat(4000));
  await picker(page);
  await page.getByRole("button", { name: "Sorriso", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("p[role=alert]")).toContainText("4000 caracteres");
  await expect(field).toHaveValue("a".repeat(4000));
});
test("cria, edita e envia WebP 512 transparente sem apagar rascunho", async ({
  page,
}) => {
  await page.goto("/conversas");
  await page
    .getByLabel("Mensagem", { exact: true })
    .fill("rascunho preservado");
  const dialog = await stickers(page);
  await dialog
    .getByLabel("Imagem para criar figurinha")
    .setInputFiles({ name: "minha.png", mimeType: "image/png", buffer: png });
  await dialog.getByLabel("Nome da figurinha").fill("Oi amigos");
  await dialog.getByLabel("Texto na figurinha (opcional)").fill("Olá!");
  await dialog.getByRole("button", { name: "Girar", exact: true }).click();
  await dialog.getByRole("button", { name: "Recortar ao centro" }).click();
  await dialog
    .getByRole("button", { name: "Salvar figurinha", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText("Figurinha criada");
  const image = dialog.getByRole("img", { name: "Oi amigos", exact: true });
  const info = await image.evaluate(async (element: HTMLImageElement) => {
    const blob = await (await fetch(element.src)).blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const result = {
      width: bitmap.width,
      height: bitmap.height,
      size: blob.size,
      type: blob.type,
      alpha: ctx.getImageData(0, 0, 1, 1).data[3],
    };
    bitmap.close();
    return result;
  });
  expect(info).toMatchObject({
    width: 512,
    height: 512,
    type: "image/webp",
    alpha: 0,
  });
  expect(info.size).toBeLessThanOrEqual(102400);
  await dialog
    .getByRole("button", { name: "Enviar figurinha Oi amigos", exact: true })
    .click();
  await expect(
    page
      .getByRole("log")
      .getByRole("img", { name: "Oi amigos.webp", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Mensagem", { exact: true })).toHaveValue(
    "rascunho preservado",
  );
  await expect(page.getByRole("log").locator(".sticker-bubble")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("importa várias imagens, persiste coleção após recarregar e exclui sem apagar mensagem", async ({
  page,
}) => {
  await page.goto("/conversas");
  let dialog = await stickers(page);
  await dialog.getByLabel("Importar imagens como figurinhas").setInputFiles([
    { name: "importada.png", mimeType: "image/png", buffer: png },
    { name: "segunda.png", mimeType: "image/png", buffer: png },
  ]);
  await expect(dialog.getByRole("status")).toContainText(
    "2 figurinha(s) importada(s)",
  );
  await page.reload();
  dialog = await stickers(page);
  await expect(dialog.getByRole("listitem")).toHaveCount(2);
  await dialog
    .getByRole("button", { name: "Enviar figurinha importada", exact: true })
    .click();
  dialog = await stickers(page);
  await dialog
    .getByRole("button", { name: "Excluir figurinha importada", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText("excluída");
  await expect(dialog.getByRole("listitem")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(
    page
      .getByRole("log")
      .getByRole("img", { name: "importada.webp", exact: true }),
  ).toBeVisible();
});
test("rejeita arquivos inválidos e permite cancelar edição sem salvar", async ({
  page,
}) => {
  await page.goto("/conversas");
  const dialog = await stickers(page);
  const input = dialog.getByLabel("Imagem para criar figurinha");
  await input.setInputFiles({
    name: "ruim.png",
    mimeType: "image/png",
    buffer: Buffer.from("inválido"),
  });
  await expect(dialog.locator("p[role=alert]")).toContainText(
    "Não foi possível ler",
  );
  await input.setInputFiles({
    name: "grande.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(5242881),
  });
  await expect(dialog.locator("p[role=alert]")).toContainText("até 5 MB");
  await input.setInputFiles({
    name: "pacote.wastickers",
    mimeType: "application/zip",
    buffer: Buffer.from("pacote"),
  });
  await expect(dialog.locator("p[role=alert]")).toContainText(
    "não são suportados",
  );
  await input.setInputFiles({
    name: "ok.png",
    mimeType: "image/png",
    buffer: png,
  });
  await dialog.getByRole("button", { name: "Cancelar edição" }).click();
  await expect(dialog.getByRole("listitem")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
