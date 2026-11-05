import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
test("APK e vínculo de domínio são públicos, com checksum verificável", async ({
  request,
  page,
}) => {
  const response = await request.get("/downloads/menchat-3.0.0.apk");
  expect(response.ok()).toBe(true);
  const body = await response.body();
  expect(body.length).toBeGreaterThan(1000000);
  const checksum = await request.get("/downloads/menchat-3.0.0.apk.sha256");
  expect((await checksum.text()).split(" ")[0]).toBe(
    createHash("sha256").update(body).digest("hex"),
  );
  const links = await request.get("/.well-known/assetlinks.json");
  const target = (await links.json())[0].target;
  expect(target.package_name).toBe("app.menchat.android");
  expect(target.sha256_cert_fingerprints[0]).toMatch(
    /^([A-F0-9]{2}:){31}[A-F0-9]{2}$/,
  );
  const previous = await request.get("/downloads/menchat-1.0.0.apk", { maxRedirects: 0 });
  expect(previous.status()).toBe(307);
  expect(previous.headers().location).toBe("/downloads/menchat-1.0.1.apk");
  await page.goto("/entrar");
  await page
    .getByRole("button", { name: "Baixar app Android", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: /Baixar APK Android/ }),
  ).toHaveAttribute("download", "menchat-3.0.0.apk");
});
test("push exige identidade e protege requisições de outro site", async ({
  request,
}) => {
  expect((await request.get("/api/push")).status()).toBe(401);
  expect(
    (
      await request.post("/api/push", {
        headers: { Origin: "https://outro.test" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/push/dispatch", {
        headers: { Origin: "http://127.0.0.1:3100" },
      })
    ).status(),
  ).toBe(401);
});
