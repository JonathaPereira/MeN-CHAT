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
    await page.goto(`http://${hostname}:3102/entrar`);
    await expect(
      page.getByRole("heading", { name: "Entrar", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Ativar modo escuro" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.reload();
    await expect(page.getByLabel("E-mail", { exact: true })).toBeVisible();
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

test("rotas reais usam proxy e exigem sessão também em desenvolvimento", async ({
  page,
}) => {
  const response = await page.goto("/conta");
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(
    page.getByRole("heading", { name: "Entrar", exact: true }),
  ).toBeVisible();
  expect(response?.headers()["cache-control"]).toContain("no-store");
  const inviteAdmin = await page.goto("/conta/convites");
  await expect(page).toHaveURL(/\/entrar$/);
  expect(inviteAdmin?.headers()["cache-control"]).toContain("no-store");
  await page
    .getByRole("link", { name: "Primeiro acesso ou redefinir senha" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Verificar e-mail e definir senha",
      exact: true,
    }),
  ).toBeVisible();
  const invite = await page.goto(`/convite#token=${"A".repeat(43)}`);
  await expect(page.getByLabel("Seu e-mail convidado")).toBeVisible();
  await expect(page).toHaveURL(/\/convite$/);
  expect(invite?.headers()["cache-control"]).toContain("no-store");
  await page.getByLabel("Seu e-mail convidado").fill("amigo@example.test");
  await expect(page.getByLabel("Seu e-mail convidado")).toHaveValue(
    "amigo@example.test",
  );
});
