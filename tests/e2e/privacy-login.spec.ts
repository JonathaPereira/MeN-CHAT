import { expect, test, type Page } from "@playwright/test";
async function openChat(page: Page, name: string) {
  const back = page.getByRole("button", { name: "Abrir lista de conversas" });
  if (await back.isVisible()) await back.click();
  await page
    .getByRole("complementary", { name: "Lista de conversas" })
    .getByRole("button", { name: new RegExp(name) })
    .click();
}
async function privacy(page: Page) {
  await page.goto("/configuracoes");
  await page.getByRole("button", { name: /Privacidade/ }).click();
}

test("login tem somente marca, formulário e ações, com animação e clipe sem texto", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.locator(".brand-word")).toHaveText("MenChat");
  await expect(page.getByText("Perto de quem", { exact: false })).toHaveCount(
    0,
  );
  await expect(
    page.getByText("Entre na conversa.", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("E-mail", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".auth-card")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  await page.goto("/conversas");
  const attachment = page.getByRole("button", {
    name: "Anexar arquivo",
    exact: true,
  });
  await expect(attachment).toBeVisible();
  expect((await attachment.textContent())?.trim()).toBe("");
  const row = await page.locator(".composer-row").boundingBox();
  const panel = await page.locator(".chat-panel").boundingBox();
  expect(row!.width).toBeGreaterThan(panel!.width * 0.85);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("perfis mostram código conforme privacidade e permitem abrir conversa", async ({
  page,
}) => {
  await page.goto("/conversas");
  await openChat(page, "Ana Oliveira");
  await page
    .getByRole("heading", { name: "Ana Oliveira", exact: true })
    .getByRole("button")
    .click();
  const dialog = page.getByRole("dialog", { name: "Perfil do contato" });
  await expect(dialog.locator("code")).toHaveText("A1B2C3");
  await dialog
    .getByRole("button", { name: "Enviar mensagem", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await openChat(page, "Lucas Santos");
  await page
    .getByRole("heading", { name: "Lucas Santos", exact: true })
    .getByRole("button")
    .click();
  await expect(
    page.getByRole("dialog").getByText("Código oculto", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog").locator("code")).toHaveCount(0);
  await expect(
    page.getByRole("dialog").getByText("L4C5S6", { exact: true }),
  ).toHaveCount(0);
});

test("privacidade do próprio código afeta prévia e busca sem mudar o código gerado", async ({
  page,
}) => {
  await page.goto("/perfil");
  const code = (await page.locator("code").textContent())!.trim();
  await page
    .getByRole("switch", { name: "Mostrar meu código no perfil", exact: true })
    .uncheck();
  await page
    .getByRole("button", { name: "Ver como contatos veem meu perfil" })
    .click();
  await expect(page.getByRole("dialog").locator("code")).toHaveCount(0);
  await expect(
    page.getByRole("dialog").getByText("Código oculto"),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("code")).toHaveText(code);
  await privacy(page);
  await page
    .getByRole("switch", {
      name: "Permitir busca pelo meu código",
      exact: true,
    })
    .uncheck();
  await page.reload();
  await page.getByRole("button", { name: /Privacidade/ }).click();
  await expect(
    page.getByRole("switch", {
      name: "Mostrar meu código no perfil",
      exact: true,
    }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("switch", {
      name: "Permitir busca pelo meu código",
      exact: true,
    }),
  ).not.toBeChecked();
  await page.goto("/conversas");
  await page.getByRole("button", { name: "Abrir menu do chat" }).click();
  await page
    .getByRole("dialog", { name: "Menu do chat", exact: true })
    .getByRole("button", { name: "Nova conversa por código", exact: true })
    .click();
  await page.getByLabel("Código do usuário").fill(code);
  await page
    .getByRole("button", { name: "Buscar usuário pelo código" })
    .click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "Nenhum perfil fictício",
  );
});

test("mensagem privada fica no seu chat e quem viu inclui somente o destinatário", async ({
  page,
}) => {
  await page.goto("/conversas");
  await openChat(page, "Ana Oliveira");
  await page
    .getByLabel("Mensagem", { exact: true })
    .fill("Mensagem exclusiva para Ana");
  await page.getByRole("button", { name: "Enviar mensagem de teste" }).click();
  await expect(
    page.getByRole("img", { name: "Avatar de Ana Oliveira", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Ana Oliveira digitando",
  );
  const receipt = page.getByRole("button", {
    name: "Ver quem viu a mensagem: Mensagem exclusiva para Ana",
    exact: true,
  });
  await expect(receipt).toContainText("Vista");
  await receipt.click();
  const dialog = page.getByRole("dialog", { name: "Quem viu", exact: true });
  await expect(dialog.getByRole("list").getByRole("listitem")).toHaveCount(1);
  await expect(dialog).toContainText("Ana Oliveira");
  await expect(dialog).toContainText("Viu às");
  await page.keyboard.press("Escape");
  await openChat(page, "Família reunida");
  await expect(page.getByRole("log")).not.toContainText(
    "Mensagem exclusiva para Ana",
  );
});

test("grupo identifica quem digita, lista leituras e abre perfis dos membros", async ({
  page,
}) => {
  await page.goto("/conversas");
  await openChat(page, "Família reunida");
  await page
    .getByLabel("Mensagem", { exact: true })
    .fill("Mensagem para o grupo");
  await page.getByRole("button", { name: "Enviar mensagem de teste" }).click();
  await expect(
    page.getByRole("img", { name: "Avatar de Ana Oliveira", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Avatar de Lucas Santos", exact: true }),
  ).toBeVisible();
  const receipt = page.getByRole("button", {
    name: "Ver quem viu a mensagem: Mensagem para o grupo",
    exact: true,
  });
  await expect(receipt).toContainText("2/3 viram");
  await receipt.click();
  const dialog = page.getByRole("dialog", { name: "Quem viu", exact: true });
  await expect(dialog.getByRole("listitem")).toHaveCount(3);
  await expect(dialog).toContainText("Confirmação indisponível");
  await expect(dialog).not.toContainText("Pedro Lima");
  await page.keyboard.press("Escape");
  await page
    .getByRole("heading", { name: "Família reunida", exact: true })
    .getByRole("button")
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Ana Oliveira/ })
    .click();
  await expect(page.getByRole("dialog").locator("code")).toHaveText("A1B2C3");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Enviar mensagem", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ana Oliveira", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("log")).not.toContainText(
    "Mensagem para o grupo",
  );
});

test("opções de leitura e digitação ocultam os indicadores na demonstração", async ({
  page,
}) => {
  await privacy(page);
  await page
    .getByRole("switch", { name: "Confirmações de leitura", exact: true })
    .uncheck();
  await page
    .getByRole("switch", { name: "Indicadores de digitação", exact: true })
    .uncheck();
  await page.goto("/conversas");
  await page
    .getByLabel("Mensagem", { exact: true })
    .fill("Sem compartilhamento de indicadores");
  await page.getByRole("button", { name: "Enviar mensagem de teste" }).click();
  await expect(page.locator(".typing-indicator")).toHaveCount(0);
  await expect(page.getByRole("log")).toContainText(
    "Mensagem de teste recebida",
  );
  await expect(
    page.getByRole("button", { name: /Ver quem viu a mensagem/ }),
  ).toHaveCount(0);
});
