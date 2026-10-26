import { networkInterfaces } from "node:os";
import { expect, test } from "@playwright/test";

for (const hostname of ["localhost", "127.0.0.1"]) {
  test(`JavaScript e interações carregam em desenvolvimento usando ${hostname}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    const failedAssets: string[] = [];
    let hmrFrames = 0;
    page.on("websocket", (socket) => {
      if (socket.url().includes("hmr"))
        socket.on("framereceived", () => hmrFrames++);
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.url().includes("/_next/") && response.status() >= 400)
        failedAssets.push(
          `${response.status()} ${new URL(response.url()).pathname}`,
        );
    });
    await page.goto(`http://${hostname}:3102/conversas`);
    await page
      .getByRole("link", { name: "Abrir configurações", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Configurações", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Voltar ao chat", exact: true })
      .click();
    await page
      .getByLabel("Mensagem", { exact: true })
      .fill("Teste do servidor de desenvolvimento");
    await page
      .getByRole("button", { name: "Enviar mensagem de teste", exact: true })
      .click();
    await expect(page.getByRole("log")).toContainText(
      "Mensagem de teste recebida!",
    );
    // A recarga também verifica se o cache do navegador preserva uma página interativa.
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Anexar arquivo", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Abrir configurações", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Configurações", exact: true }),
    ).toBeVisible();
    await expect.poll(() => hmrFrames).toBeGreaterThan(0);
    expect(failedAssets).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("scripts do Next aceitam somente as origens desta máquina", async ({
  request,
}) => {
  const html = await request.get("/conversas");
  expect(html.status()).toBe(200);
  const script = (await html.text()).match(
    /<script[^>]+src="(\/_next\/[^"]+)"/,
  );
  expect(script).not.toBeNull();
  const path = script![1].replaceAll("&amp;", "&");
  const localIPs = Object.values(networkInterfaces())
    .flatMap((items) => items ?? [])
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);
  for (const host of ["localhost", "127.0.0.1", ...localIPs]) {
    const response = await request.get(path, {
      headers: { Origin: `http://${host}:3102` },
    });
    expect(response.status(), `Origin ${host}`).toBe(200);
    expect(response.headers()["content-type"]).toContain("javascript");
  }
  const blocked = await request.get(path, {
    headers: { Origin: "https://site-nao-autorizado.invalid" },
  });
  expect(blocked.status()).toBe(403);
  const rejectedReferer = await request.get(path, {
    headers: {
      "sec-fetch-mode": "no-cors",
      "sec-fetch-site": "cross-site",
      Referer: "https://site-nao-autorizado.invalid/",
    },
  });
  expect(rejectedReferer.status()).toBe(403);
});
