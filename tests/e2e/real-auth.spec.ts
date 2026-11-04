import { expect, test } from "@playwright/test";

test("conta real exige sessão e mantém resposta privada sem cache", async ({
  page,
}) => {
  const response = await page.goto("/conta");
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(
    page.getByRole("heading", { name: "Entrar", exact: true }),
  ).toBeVisible();
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(
    page.getByText("Sua conta está conectada", { exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/conta/chat");
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(
    page.getByRole("heading", { name: "Entrar", exact: true }),
  ).toBeVisible();
});

test("acesso real e primeiro acesso ficam separados da demonstração", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(
    page.getByRole("link", { name: "Criar perfil", exact: true }),
  ).toHaveCount(0);
  const login = page.getByRole("button", {
    name: "Entrar na conta",
    exact: true,
  });
  const missingConfig = await login.isDisabled();
  if (missingConfig)
    await expect(page.locator("p[role=alert]")).toContainText("Configure");
  await page
    .getByRole("link", { name: "Primeiro acesso ou redefinir senha" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Verificar e-mail e definir senha" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Código recebido", { exact: true }),
  ).toHaveAttribute("autocomplete", "one-time-code");
  await expect(
    page.getByText("Esta tela não cria cadastros nem ativa convites.", {
      exact: false,
    }),
  ).toBeVisible();
  if (missingConfig)
    await expect(
      page.getByRole("button", {
        name: "Enviar código por e-mail",
        exact: true,
      }),
    ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  expect(storage).not.toContain("access_token");
});
