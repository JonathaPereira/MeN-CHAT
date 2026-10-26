import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
const png = readFileSync(
  new URL("../fixtures/foto-teste.png", import.meta.url),
);
const audio = readFileSync(
  new URL("../fixtures/audio-teste.mp3", import.meta.url),
);
async function settingsSection(page: Page, name: string) {
  await page.goto("/configuracoes");
  await page.getByRole("button", { name: new RegExp(name) }).click();
}
async function trackMicrophone(page: Page) {
  await page.addInitScript(() => {
    const target = window as typeof window & { testTracks: MediaStreamTrack[] };
    target.testTracks = [];
    if (!navigator.mediaDevices) return;
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      target.testTracks.push(...stream.getTracks());
      return stream;
    };
  });
}
async function tracksEnded(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const tracks = (
          window as typeof window & { testTracks: MediaStreamTrack[] }
        ).testTracks;
        return (
          tracks.length > 0 &&
          tracks.every((track) => track.readyState === "ended")
        );
      }),
    )
    .toBe(true);
}

test("chat ocupa a janela inteira e lista e menus ficam escondidos", async ({
  page,
}) => {
  await page.goto("/conversas");
  await expect(
    page.getByRole("heading", { name: "Assistente M&N", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Lista de conversas" }),
  ).toHaveCount(0);
  const bounds = await page.locator("main").boundingBox();
  expect(bounds?.x).toBe(0);
  expect(bounds?.width).toBe(page.viewportSize()!.width);
  expect(bounds?.height).toBe(page.viewportSize()!.height);
  await page.getByRole("button", { name: "Abrir lista de conversas" }).click();
  await expect(
    page.getByRole("dialog", { name: "Suas conversas" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Abrir menu do chat" }).click();
  await page.getByRole("link", { name: "Configurações", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Configurações", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Aparência/ }).click();
  await page.getByLabel("Tamanho do texto no chat").selectOption("large");
  await page.reload();
  await page.getByRole("button", { name: /Aparência/ }).click();
  await expect(page.getByLabel("Tamanho do texto no chat")).toHaveValue(
    "large",
  );
  await page.goto("/conversas");
  await expect(page.locator("main")).toHaveAttribute("data-text-size", "large");
});

test("Enter, carregamento manual de mídia e velocidade têm efeito na conversa", async ({
  page,
}) => {
  await settingsSection(page, "Conversas e voz");
  await page
    .getByRole("switch", { name: "Enter para enviar", exact: true })
    .uncheck();
  await page.getByLabel("Velocidade dos áudios").selectOption("2");
  await settingsSection(page, "Dados e armazenamento");
  await page
    .getByRole("switch", { name: "Economia de dados", exact: true })
    .check();
  await page.goto("/conversas");
  await page.getByLabel("Mensagem", { exact: true }).fill("Uma linha");
  await page.getByLabel("Mensagem", { exact: true }).press("Enter");
  await expect(page.getByLabel("Mensagem", { exact: true })).toHaveValue(
    "Uma linha\n",
  );
  await expect(page.getByRole("article", { name: "Sua mensagem" })).toHaveCount(
    0,
  );
  await page.getByLabel("Selecionar anexos", { exact: true }).setInputFiles([
    { name: "foto.png", mimeType: "image/png", buffer: png },
    { name: "audio.mp3", mimeType: "audio/mpeg", buffer: audio },
  ]);
  await page.getByRole("button", { name: "Enviar mensagem de teste" }).click();
  await expect(page.locator("audio")).toHaveCount(0);
  await expect(
    page.getByRole("img", { name: "foto.png", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Carregar áudio audio.mp3" }).click();
  await expect(page.locator("audio")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((element: HTMLAudioElement) => element.playbackRate),
    )
    .toBe(2);
  await page.getByRole("button", { name: "Carregar foto foto.png" }).click();
  await expect(
    page.getByRole("img", { name: "foto.png", exact: true }),
  ).toBeVisible();
});

test("avisos respeitam prévia e só são emitidos fora da conversa ativa", async ({
  page,
}) => {
  await page.goto("/conversas");
  await page.getByLabel("Mensagem", { exact: true }).fill("Teste de aviso");
  await page.getByRole("button", { name: "Enviar mensagem de teste" }).click();
  await page.getByRole("button", { name: "Abrir menu do chat" }).click();
  await page.getByRole("link", { name: "Configurações", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Aviso de notificação" }),
  ).toContainText("Você recebeu uma mensagem de teste.");
  await expect(
    page.getByRole("status", { name: "Aviso de notificação" }),
  ).not.toContainText("Mensagem de teste recebida");
  await page.getByRole("button", { name: "Fechar notificação" }).click();
  await page.getByRole("button", { name: /Notificações/ }).click();
  await page
    .getByRole("switch", { name: "Mostrar prévia da mensagem", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Testar notificação", exact: true })
    .click();
  await expect(
    page.getByRole("status", { name: "Aviso de notificação" }),
  ).toContainText("Este é um exemplo de prévia");
  await page.getByRole("button", { name: "Fechar notificação" }).click();
  await page.goto("/conversas");
  await page.getByRole("button", { name: "Abrir menu do chat" }).click();
  await page
    .getByRole("button", { name: "Silenciar esta conversa", exact: true })
    .click();
  await page
    .getByLabel("Mensagem", { exact: true })
    .fill("Nova mensagem silenciada");
  await page.getByRole("button", { name: "Enviar mensagem de teste" }).click();
  await page.getByRole("button", { name: "Abrir menu do chat" }).click();
  await expect(page.locator("[role=log]")).toContainText(
    "Mensagem de teste recebida",
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("status", { name: "Aviso de notificação" }),
  ).toHaveCount(0);
});

test("microfone grava, para, libera o aparelho e permite ouvir antes de anexar", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  await trackMicrophone(page);
  await page.goto("/conversas");
  await page.getByRole("button", { name: "Gravar mensagem de voz" }).click();
  await page.getByRole("button", { name: "Iniciar gravação" }).click();
  await expect(page.getByRole("status")).toContainText("Gravando");
  await expect(page.getByRole("status")).toContainText("0:01");
  await page.getByRole("button", { name: "Parar e ouvir" }).click();
  await expect(page.getByLabel("Ouvir gravação antes de enviar")).toBeVisible();
  await tracksEnded(page);
  await page.getByRole("button", { name: "Anexar gravação" }).click();
  await expect(
    page.getByRole("region", { name: "Gravador de áudio" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Enviar mensagem de teste" }).click();
  await expect(page.locator("[role=log] audio")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator("[role=log] audio")
        .evaluate((element: HTMLAudioElement) => element.readyState),
    )
    .toBeGreaterThanOrEqual(2);
  await expect(page.getByRole("log")).toContainText(
    "nenhum arquivo foi enviado para a nuvem",
  );
});

test("trocar de conversa durante a gravação interrompe o microfone", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  await trackMicrophone(page);
  await page.goto("/conversas");
  await page.getByRole("button", { name: "Gravar mensagem de voz" }).click();
  await page.getByRole("button", { name: "Iniciar gravação" }).click();
  await expect(page.getByRole("status")).toContainText("Gravando");
  await page.getByRole("button", { name: "Abrir lista de conversas" }).click();
  await page.getByRole("button", { name: /Ana Oliveira/ }).click();
  await expect(
    page.getByRole("heading", { name: "Ana Oliveira" }),
  ).toBeVisible();
  await tracksEnded(page);
  await expect(
    page.getByRole("region", { name: "Gravador de áudio" }),
  ).toHaveCount(0);
});

test("permissão negada oferece um caminho para anexar áudio do aparelho", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("negada", "NotAllowedError");
    };
  });
  await page.goto("/conversas");
  await page.getByRole("button", { name: "Gravar mensagem de voz" }).click();
  await page.getByRole("button", { name: "Iniciar gravação" }).click();
  await expect(page.locator("p[role=alert]")).toContainText(
    "Permissão do microfone negada",
  );
  await page.getByLabel("Selecionar arquivo de áudio").setInputFiles({
    name: "do-aparelho.mp3",
    mimeType: "audio/mpeg",
    buffer: audio,
  });
  await page.getByRole("button", { name: "Enviar mensagem de teste" }).click();
  await expect(page.getByLabel("Áudio: do-aparelho.mp3")).toBeVisible();
});

test("notificação do sistema só pede permissão por botão e respeita desativação", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const target = window as typeof window & {
      permissionRequests: number;
      systemNotices: string[];
    };
    target.permissionRequests = 0;
    target.systemNotices = [];
    let permission: NotificationPermission = "default";
    class FakeNotification {
      static get permission() {
        return permission;
      }
      static async requestPermission() {
        target.permissionRequests++;
        permission = "granted";
        return permission;
      }
      onclick: (() => void) | null = null;
      constructor(_title: string, options: NotificationOptions) {
        target.systemNotices.push(options.body || "");
      }
      close() {}
    }
    Object.defineProperty(window, "Notification", {
      value: FakeNotification,
      configurable: true,
    });
  });
  await settingsSection(page, "Notificações");
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { permissionRequests: number })
          .permissionRequests,
    ),
  ).toBe(0);
  await page
    .getByRole("button", { name: "Permitir avisos do navegador" })
    .click();
  await expect(
    page.getByRole("switch", { name: "Avisos do sistema", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Testar notificação", exact: true })
    .click();
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { permissionRequests: number })
          .permissionRequests,
    ),
  ).toBe(1);
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { systemNotices: string[] }).systemNotices,
    ),
  ).toEqual(["Você recebeu uma mensagem de teste."]);
  await page
    .getByRole("switch", { name: "Avisos do sistema", exact: true })
    .uncheck();
  await page
    .getByRole("button", { name: "Testar notificação", exact: true })
    .click();
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { systemNotices: string[] }).systemNotices
          .length,
    ),
  ).toBe(1);
  await page
    .getByRole("switch", { name: "Avisos do sistema", exact: true })
    .check();
  await page
    .getByRole("switch", {
      name: "Somente fora da conversa ativa",
      exact: true,
    })
    .uncheck();
  await page.getByRole("button", { name: "Fechar notificação" }).click();
  await page.getByRole("button", { name: "Todas as configurações" }).click();
  await page.getByRole("link", { name: "Voltar ao chat" }).click();
  await page.getByLabel("Mensagem", { exact: true }).fill("Teste ativo");
  await page.getByRole("button", { name: "Enviar mensagem de teste" }).click();
  await expect(page.getByRole("log")).toContainText(
    "Mensagem de teste recebida",
  );
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { systemNotices: string[] }).systemNotices
          .length,
    ),
  ).toBe(2);
});

test("HTTP sem contexto seguro explica restrições sem pedir acesso ao microfone", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "isSecureContext", {
      value: false,
      configurable: true,
    });
    navigator.mediaDevices.getUserMedia = async () => {
      throw new Error("Não deve solicitar microfone neste contexto");
    };
  });
  await page.goto("/conversas");
  await page.getByRole("button", { name: "Gravar mensagem de voz" }).click();
  await page.getByRole("button", { name: "Iniciar gravação" }).click();
  await expect(page.locator("p[role=alert]")).toContainText(
    "A gravação exige HTTPS ou localhost",
  );
  await expect(
    page.getByRole("button", { name: "Escolher áudio do aparelho" }),
  ).toBeVisible();
  await settingsSection(page, "Notificações");
  await expect(
    page.getByRole("button", { name: "Permitir avisos do navegador" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Permissão: exige HTTPS ou localhost"),
  ).toBeVisible();
});
