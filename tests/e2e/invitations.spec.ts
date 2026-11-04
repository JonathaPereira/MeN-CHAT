import { expect, test } from "@playwright/test";
test("entrada principal é real e administração de convites exige sessão", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/entrar$/);
  const response = await page.goto("/conta/convites");
  await expect(page).toHaveURL(/\/entrar$/);
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(page.getByRole("button", { name: "Gerar convite" })).toHaveCount(
    0,
  );
});
test("link privado fica no fragmento e não persiste no navegador", async ({
  page,
}) => {
  const token = "A".repeat(43);
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(`/convite#token=${token}`);
  await expect(page.getByLabel("Seu e-mail convidado")).toBeVisible();
  await expect(page).toHaveURL(/\/convite$/);
  await expect(
    page.getByLabel("Crie sua senha", { exact: true }),
  ).toHaveAttribute("autocomplete", "new-password");
  expect(
    await page.evaluate(
      () => JSON.stringify(localStorage) + JSON.stringify(sessionStorage),
    ),
  ).not.toContain(token);
  expect(requests.every((url) => !url.includes(token))).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Acesso ao MenChat" }).getByRole("alert"),
  ).toContainText("link completo");
  await expect(
    page.getByRole("button", { name: "Aceitar convite e entrar" }),
  ).toHaveCount(0);
});
test("convite inválido não oferece cadastro público", async ({ page }) => {
  await page.goto("/convite#token=incorreto");
  await expect(
    page.getByRole("region", { name: "Acesso ao MenChat" }).getByRole("alert"),
  ).toContainText("Não há cadastro público");
  await expect(page.getByLabel("Seu e-mail convidado")).toHaveCount(0);
});
