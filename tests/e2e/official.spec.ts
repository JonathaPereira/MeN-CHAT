import { test, expect } from "@playwright/test";
test("rotas antigas encaminham ao acesso oficial", async ({ page }) => {
  for (const route of ["/conversas", "/perfil", "/configuracoes"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/entrar$/);
  }
  await page.goto("/cadastro");
  await expect(page).toHaveURL(/\/convite$/);
});
test("manifesto e worker oferecem instalação sem cache de mensagens", async ({
  page,
  request,
}) => {
  const manifest = await request.get("/manifest.webmanifest");
  const data = await manifest.json();
  expect(data.display).toBe("standalone");
  expect(data.start_url).toBe("/conta/chat");
  for (const icon of data.icons)
    expect((await request.get(icon.src)).status()).toBe(200);
  const sw = await request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toContain("no-store");
  await page.goto("/entrar");
  await expect
    .poll(() =>
      page.evaluate(
        async () => !!(await navigator.serviceWorker.getRegistration("/")),
      ),
    )
    .toBe(true);
  expect(await page.evaluate(async () => await caches.keys())).toEqual([]);
});
