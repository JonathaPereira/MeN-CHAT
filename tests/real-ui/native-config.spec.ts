import { test, expect } from "@playwright/test";

test("inicialização nativa entrega somente configuração pública, sem conceder sessão", async ({
  request,
}) => {
  const response = await request.get("/api/mobile/config");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const data = await response.json();
  expect(Object.keys(data).sort()).toEqual(["publishableKey", "url"]);
  expect(data.url).toBe("https://menchat.invalid");
  expect(data.publishableKey).toBe("sb_publishable_ui_test");
  expect(response.headers()["set-cookie"]).toBeUndefined();
});
