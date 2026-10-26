import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

async function openAssistant(page: Page) {
  await page.goto("/conversas");
  await page.getByRole("button", { name: /Assistente M&N/ }).click();
}
async function backToList(page: Page) {
  const button = page.getByRole("button", {
    name: "Voltar à lista de conversas",
  });
  if (await button.isVisible()) await button.click();
}
async function noHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
const png = readFileSync(
  new URL("../fixtures/foto-teste.png", import.meta.url),
);

test("tema, convite, cadastro de teste e perfil persistente sem armazenar credenciais", async ({
  page,
}) => {
  const errors: string[] = [];
  const writes: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.method() === "POST") writes.push(request.url());
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "Ativar modo escuro" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("link", { name: "Criar perfil", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Pessoa de Teste");
  await page.getByLabel("E-mail", { exact: true }).fill("teste@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("apenas-teste-123");
  await page.getByRole("button", { name: "Mostrar senha" }).click();
  await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Ocultar senha" }).click();
  await page.getByLabel("Confirmar senha").fill("senha-diferente");
  await page.getByLabel("Convite do administrador").fill("INVALIDO");
  await page
    .getByRole("button", { name: "Criar perfil de demonstração" })
    .click();
  await expect(page.locator("p[role=alert]")).toContainText("não coincidem");
  await page.getByLabel("Confirmar senha").fill("apenas-teste-123");
  await page
    .getByRole("button", { name: "Criar perfil de demonstração" })
    .click();
  await expect(page.locator("p[role=alert]")).toContainText("AMIGOS20");
  await page.getByLabel("Convite do administrador").fill("amigos20");
  await page
    .getByRole("button", { name: "Criar perfil de demonstração" })
    .click();
  await expect(page).toHaveURL(/\/perfil$/);
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue(
    "Pessoa de Teste",
  );
  const code = (await page.locator("code").textContent())!;
  expect(code).toMatch(/^[A-Z0-9]{6}$/);
  expect(code).toMatch(/[0-9]/);
  expect(code).toMatch(/[A-Z]/);
  await page
    .getByLabel("Status personalizado")
    .fill("Testando meu novo chat 🌿");
  await page.getByLabel("Arquivo da foto de perfil").setInputFiles({
    name: "corrompida.png",
    mimeType: "image/png",
    buffer: Buffer.from("imagem inválida"),
  });
  await expect(page.locator("p[role=alert]")).toContainText(
    "Não foi possível ler esta imagem",
  );
  await page
    .getByLabel("Arquivo da foto de perfil")
    .setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: png });
  await expect(
    page.getByRole("img", { name: "Foto de Pessoa de Teste" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(page.getByRole("status")).toContainText("Perfil salvo");
  await page.reload();
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue(
    "Pessoa de Teste",
  );
  await expect(page.getByLabel("Status personalizado")).toHaveValue(
    "Testando meu novo chat 🌿",
  );
  await expect(page.locator("code")).toHaveText(code);
  await expect(
    page.getByRole("img", { name: "Foto de Pessoa de Teste" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/dark/);
  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  expect(storage).not.toContain("apenas-teste-123");
  expect(storage).not.toContain("teste@example.com");
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
  await noHorizontalOverflow(page);
});

test("assistente responde e o chat mantém compositor e rolagem independentes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openAssistant(page);
  await page
    .getByLabel("Mensagem", { exact: true })
    .fill("Oi, quero testar o modo escuro");
  await page.getByRole("button", { name: "Enviar mensagem de teste" }).click();
  await expect(page.getByText("Assistente de teste digitando…")).toBeVisible();
  await expect(page.getByRole("log")).toContainText(
    "Oi! 👋 Sou o assistente de teste",
  );
  await page
    .getByLabel("Mensagem", { exact: true })
    .fill("Mensagem comprida " + "muitolongasemespacos".repeat(80));
  await page.getByLabel("Mensagem", { exact: true }).press("Enter");
  await expect(page.getByRole("log")).toContainText(
    "Mensagem de teste recebida!",
  );
  await noHorizontalOverflow(page);
  await expect(
    page.getByRole("button", { name: "Enviar mensagem de teste" }),
  ).toBeInViewport();
  await page.getByLabel("Mensagem", { exact: true }).fill("Linha 1");
  await page.getByLabel("Mensagem", { exact: true }).press("Shift+Enter");
  await page
    .getByLabel("Mensagem", { exact: true })
    .pressSequentially("Linha 2");
  await expect(page.getByLabel("Mensagem", { exact: true })).toHaveValue(
    "Linha 1\nLinha 2",
  );
  const width = page.viewportSize()!.width;
  await page.setViewportSize({ width, height: 480 });
  await expect(
    page.getByRole("button", { name: "Enviar mensagem de teste" }),
  ).toBeInViewport();
  await noHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("busca por código, conversa privada, grupo e filtros", async ({
  page,
}) => {
  await page.goto("/conversas");
  await page.getByRole("button", { name: "Nova conversa por código" }).click();
  await page.getByLabel("Código do usuário").fill("ZZ9999");
  await page
    .getByRole("button", { name: "Buscar usuário pelo código" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Nenhum perfil fictício",
  );
  await page.getByLabel("Código do usuário").fill("a1b2c3");
  await page
    .getByRole("button", { name: "Buscar usuário pelo código" })
    .click();
  await page.getByRole("button", { name: "Abrir conversa de teste" }).click();
  await expect(
    page.getByRole("heading", { name: "Ana Oliveira" }),
  ).toBeVisible();
  await backToList(page);
  await page.getByRole("button", { name: "Criar grupo", exact: true }).click();
  await page.getByLabel("Nome do grupo").fill("Grupo de teste");
  await page.getByRole("button", { name: "Criar grupo de teste" }).click();
  await expect(page.locator("p[role=alert]")).toContainText(
    "pelo menos um participante",
  );
  await page.getByRole("checkbox", { name: /Ana Oliveira/ }).check();
  await page.getByRole("checkbox", { name: /Lucas Santos/ }).check();
  await page.getByRole("button", { name: "Criar grupo de teste" }).click();
  await expect(
    page.getByRole("heading", { name: "Grupo de teste" }),
  ).toBeVisible();
  await expect(
    page.getByText("3 participantes fictícios · você incluído"),
  ).toBeVisible();
  await page.getByLabel("Mensagem", { exact: true }).fill("testando grupo");
  await page.getByRole("button", { name: "Enviar mensagem de teste" }).click();
  await expect(page.getByRole("log")).toContainText(
    "Eu também respondo por lá",
  );
  await backToList(page);
  await page.getByRole("button", { name: "Grupos", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Assistente M&N/ }),
  ).toHaveCount(0);
  await page.getByLabel("Buscar conversas pelo nome").fill("não existe");
  await expect(page.getByRole("status")).toContainText(
    "Nenhuma conversa encontrada",
  );
  await noHorizontalOverflow(page);
});

test("anexos são locais, validam limites, podem ser removidos e recebem resposta", async ({
  page,
}) => {
  const remote: string[] = [];
  page.on("request", (request) => {
    if (
      !new URL(request.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/) &&
      !request.url().startsWith("blob:")
    )
      remote.push(request.url());
  });
  await openAssistant(page);
  const input = page.getByLabel("Selecionar anexos", { exact: true });
  await input.setInputFiles({
    name: "foto.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(
    page.getByRole("button", { name: "Remover foto.png" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remover foto.png" }).click();
  await expect(
    page.getByRole("button", { name: "Enviar mensagem de teste" }),
  ).toBeDisabled();
  await input.setInputFiles({
    name: "arquivo.exe",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("teste"),
  });
  await expect(page.locator("p[role=alert]")).toContainText(
    "formato não permitido",
  );
  await input.setInputFiles({
    name: "grande.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(5_000_001),
  });
  await expect(page.locator("p[role=alert]")).toContainText("excede o limite");
  await input.setInputFiles(
    Array.from({ length: 6 }, (_, i) => ({
      name: `foto${i}.png`,
      mimeType: "image/png",
      buffer: png,
    })),
  );
  await expect(page.locator("p[role=alert]")).toContainText("no máximo 5");
  await input.setInputFiles([
    { name: "foto.png", mimeType: "image/png", buffer: png },
    {
      name: "notas.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("arquivo local"),
    },
  ]);
  await page.getByRole("button", { name: "Enviar mensagem de teste" }).click();
  await expect(
    page.getByRole("img", { name: "foto.png", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Baixar notas.txt" }),
  ).toHaveAttribute("href", /^blob:/);
  await expect(page.getByRole("log")).toContainText(
    "nenhum arquivo foi enviado para a nuvem",
  );
  await noHorizontalOverflow(page);
  expect(remote).toEqual([]);
});

test("janelas modais suportam Escape e login funciona sem sessão real", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill("teste@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("senha-ficticia");
  await page.getByRole("button", { name: "Entrar na demonstração" }).click();
  await expect(page).toHaveURL(/\/conversas$/);
  await page.getByRole("button", { name: "Nova conversa por código" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Ativar modo claro" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await noHorizontalOverflow(page);
});

test("vídeo e áudio locais carregam e reproduzem sem upload", async ({
  page,
}) => {
  await openAssistant(page);
  const input = page.getByLabel("Selecionar anexos", { exact: true });
  await input.setInputFiles([
    {
      name: "video-teste.webm",
      mimeType: "video/webm",
      buffer: readFileSync(
        new URL("../fixtures/video-teste.webm", import.meta.url),
      ),
    },
    {
      name: "audio-teste.mp3",
      mimeType: "audio/mpeg",
      buffer: readFileSync(
        new URL("../fixtures/audio-teste.mp3", import.meta.url),
      ),
    },
  ]);
  await page.getByRole("button", { name: "Enviar mensagem de teste" }).click();
  await expect(page.locator("video")).toHaveAttribute("controls", "");
  await expect(page.locator("audio")).toHaveAttribute("controls", "");
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate((video: HTMLVideoElement) => video.readyState),
    )
    .toBeGreaterThanOrEqual(2);
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((audio: HTMLAudioElement) => audio.readyState),
    )
    .toBeGreaterThanOrEqual(2);
  await page.locator("video").evaluate(async (video: HTMLVideoElement) => {
    video.muted = true;
    await video.play();
  });
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate((video: HTMLVideoElement) => video.currentTime),
    )
    .toBeGreaterThan(0);
  await page.locator("audio").evaluate(async (audio: HTMLAudioElement) => {
    audio.muted = true;
    await audio.play();
  });
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((audio: HTMLAudioElement) => audio.currentTime),
    )
    .toBeGreaterThan(0);
  await noHorizontalOverflow(page);
});

test("mensagens, grupos e anexos funcionam sem randomUUID como no acesso HTTP por Wi-Fi", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, "randomUUID", {
      value: undefined,
      configurable: true,
    });
  });
  await openAssistant(page);
  expect(await page.evaluate(() => typeof crypto.randomUUID)).toBe("undefined");
  await page.getByLabel("Mensagem", { exact: true }).fill("Teste por Wi-Fi");
  await page.getByRole("button", { name: "Enviar mensagem de teste" }).click();
  await expect(page.getByRole("log")).toContainText(
    "Mensagem de teste recebida!",
  );
  await backToList(page);
  await page.getByRole("button", { name: "Criar grupo", exact: true }).click();
  await page.getByLabel("Nome do grupo").fill("Grupo Wi-Fi");
  await page.getByRole("checkbox", { name: /Ana Oliveira/ }).check();
  await page.getByRole("button", { name: "Criar grupo de teste" }).click();
  await expect(
    page.getByRole("heading", { name: "Grupo Wi-Fi" }),
  ).toBeVisible();
  await page
    .getByLabel("Selecionar anexos", { exact: true })
    .setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Enviar mensagem de teste" }).click();
  await expect(page.getByRole("log")).toContainText(
    "nenhum arquivo foi enviado para a nuvem",
  );
});
