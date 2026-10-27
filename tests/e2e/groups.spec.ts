import { expect, test, type Page } from "@playwright/test";
async function openGroup(page: Page, name: string) {
  await page.goto("/conversas");
  const back = page.getByRole("button", { name: "Abrir lista de conversas" });
  if (await back.isVisible()) await back.click();
  await page
    .getByRole("complementary", { name: "Lista de conversas" })
    .getByRole("button", { name: new RegExp(name) })
    .click();
  await page
    .getByRole("heading", { name, exact: true })
    .getByRole("button")
    .click();
  return page.getByRole("dialog", { name: "Participantes do grupo" });
}
async function ownGroup(page: Page) {
  await page.goto("/conversas");
  await page.getByRole("button", { name: "Abrir menu do chat" }).click();
  await page
    .getByRole("dialog", { name: "Menu do chat" })
    .getByRole("button", { name: "Criar grupo", exact: true })
    .click();
  await page.getByLabel("Nome do grupo").fill("Grupo administrado");
  await page.getByRole("checkbox", { name: /Ana Oliveira/ }).check();
  await page.getByRole("checkbox", { name: /Lucas Santos/ }).check();
  await page.getByRole("button", { name: "Criar grupo de teste" }).click();
  await page
    .getByRole("heading", { name: "Grupo administrado", exact: true })
    .getByRole("button")
    .click();
  return page.getByRole("dialog", { name: "Participantes do grupo" });
}

test("admin convida pelo código, promove e preserva criador protegido", async ({
  page,
}) => {
  const dialog = await openGroup(page, "Família reunida");
  await expect(
    dialog.getByRole("button", {
      name: "Remover Ana Oliveira do grupo",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("button", {
      name: "Revogar administrador Ana Oliveira",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(dialog).toContainText("Criador protegido");
  await dialog.getByLabel("Convidar por código de usuário").fill("P3D4R5");
  await dialog
    .getByRole("button", { name: "Adicionar participante pelo código" })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "Pedro Lima adicionado",
  );
  await expect(
    dialog
      .getByRole("list", { name: "Participantes", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(5);
  await dialog
    .getByRole("button", {
      name: "Tornar Pedro Lima administrador",
      exact: true,
    })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "Pedro Lima agora é administrador",
  );
  await expect(
    dialog.getByRole("button", {
      name: "Remover Pedro Lima do grupo",
      exact: true,
    }),
  ).toHaveCount(0);
  await dialog.getByLabel("Convidar por código de usuário").fill("P3D4R5");
  await dialog
    .getByRole("button", { name: "Adicionar participante pelo código" })
    .click();
  await expect(dialog.locator("p[role=alert]")).toContainText("já participa");
});

test("membro comum não administra e pode sair com grupo somente para consulta", async ({
  page,
}) => {
  const dialog = await openGroup(page, "Os de sempre");
  await expect(dialog.getByLabel("Convidar por código de usuário")).toHaveCount(
    0,
  );
  await expect(
    dialog.getByRole("button", { name: /Tornar .* administrador/ }),
  ).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Sair do grupo", exact: true })
    .click();
  await dialog
    .getByRole("alertdialog")
    .getByRole("button", { name: "Cancelar", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Sair do grupo", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Sair do grupo", exact: true })
    .click();
  await dialog
    .getByRole("alertdialog")
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText("Você saiu do grupo");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Mensagem", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("Você saiu do grupo. Envio de mensagens indisponível.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("criador transfere propriedade antes de sair e novo dono preserva identificação original", async ({
  page,
}) => {
  const dialog = await ownGroup(page);
  await expect(dialog).toContainText("Criador · dono");
  await dialog
    .getByRole("button", { name: "Sair do grupo", exact: true })
    .click();
  await expect(dialog.locator("p[role=alert]")).toContainText(
    "Transfira a propriedade",
  );
  await expect(dialog.getByRole("alertdialog")).toHaveCount(0);
  await dialog.getByLabel("Novo dono", { exact: true }).selectOption("ana");
  await dialog
    .getByRole("button", { name: "Transferir propriedade", exact: true })
    .click();
  await dialog
    .getByRole("alertdialog")
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "Propriedade transferida",
  );
  await expect(
    dialog.getByRole("button", { name: "Transferir propriedade", exact: true }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("button", {
      name: "Remover Ana Oliveira do grupo",
      exact: true,
    }),
  ).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Sair do grupo", exact: true })
    .click();
  await dialog
    .getByRole("alertdialog")
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Mensagem", { exact: true })).toHaveCount(0);
});

test("dono pode promover, revogar e remover participante com confirmação", async ({
  page,
}) => {
  const dialog = await ownGroup(page);
  await dialog
    .getByRole("button", {
      name: "Tornar Lucas Santos administrador",
      exact: true,
    })
    .click();
  await dialog
    .getByRole("button", {
      name: "Revogar administrador Lucas Santos",
      exact: true,
    })
    .click();
  await expect(dialog.getByRole("status")).toContainText("revogada");
  await dialog
    .getByRole("button", { name: "Remover Lucas Santos do grupo", exact: true })
    .click();
  await dialog
    .getByRole("alertdialog")
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(
    dialog
      .getByRole("list", { name: "Participantes", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
