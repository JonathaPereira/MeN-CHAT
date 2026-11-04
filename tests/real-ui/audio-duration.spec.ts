import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { mock, createGroup } from "../support/browser-fixture";

test("áudio usa os dois segundos decodificados em vez dos dez minutos do cabeçalho", async ({
  page,
}) => {
  await mock(page);
  await createGroup(page);
  const bytes = await readFile("tests/fixtures/audio-duracao-incorreta.webm");
  let reads = 0;
  await page.route("**/storage/v1/object/sign/**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const range = route
      .request()
      .headers()
      ["range"]?.match(/^bytes=(\d+)-(\d*)$/);
    if (!range) reads++;
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2]
      ? Math.min(Number(range[2]), bytes.length - 1)
      : bytes.length - 1;
    await route.fulfill({
      status: range ? 206 : 200,
      body: bytes.subarray(start, end + 1),
      contentType: "audio/webm",
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Accept-Ranges": "bytes",
        ...(range
          ? { "Content-Range": `bytes ${start}-${end}/${bytes.length}` }
          : {}),
      },
    });
  });
  await page.getByLabel("Selecionar anexo", { exact: true }).setInputFiles({
    name: "audio-duracao-incorreta.webm",
    mimeType: "audio/webm",
    buffer: bytes,
  });
  await page
    .getByRole("button", { name: "Enviar mensagem", exact: true })
    .click();
  const player = page.locator(".simple-audio");
  await expect
    .poll(() =>
      player.locator("audio").evaluate((a: HTMLAudioElement) => a.duration),
    )
    .toBe(600);
  await expect(player).not.toContainText("10:00");
  await player.getByRole("button", { name: "Reproduzir áudio" }).click();
  await expect(player).toContainText("/ 0:02");
  await expect(
    player.getByRole("slider", { name: "Posição do áudio" }),
  ).toHaveAttribute("max", "2");
  const before = reads;
  await page.waitForTimeout(3300); // The normal chat poll must not decode/download again.
  expect(reads).toBe(before);
  await expect(player).not.toContainText("10:00");
  await expect(
    player.getByRole("button", { name: "Reproduzir áudio" }),
  ).toBeVisible();
  const slider = player.getByRole("slider", { name: "Posição do áudio" });
  await slider.press("Home");
  await slider.press("ArrowRight");
  await expect
    .poll(() =>
      player.locator("audio").evaluate((a: HTMLAudioElement) => a.currentTime),
    )
    .toBeCloseTo(0.1, 1);
  await slider.press("End");
  await player.getByRole("button", { name: "Reproduzir áudio" }).click();
  expect(
    await player
      .locator("audio")
      .evaluate((a: HTMLAudioElement) => a.currentTime),
  ).toBeLessThan(2);
  expect(reads).toBe(before);
});
