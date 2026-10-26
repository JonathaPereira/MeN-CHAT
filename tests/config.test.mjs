import test from "node:test";
import assert from "node:assert/strict";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces, tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import config from "../next.config.ts";

test("Turbopack usa a pasta da configuração como raiz, sem depender do diretório do terminal", () => {
  assert.equal(
    config.turbopack.root,
    dirname(fileURLToPath(new URL("../next.config.ts", import.meta.url))),
  );
  const child = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `const config = (await import(${JSON.stringify(new URL("../next.config.ts", import.meta.url).href)})).default; process.stdout.write(config.turbopack.root);`,
    ],
    { cwd: tmpdir(), encoding: "utf8" },
  );
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, config.turbopack.root);
});
test("origens de desenvolvimento contêm apenas loopback e os IPv4 da própria máquina", () => {
  const actualIPs = Object.values(networkInterfaces())
    .flatMap((items) => items ?? [])
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);
  assert.deepEqual(config.allowedDevOrigins, [
    ...new Set(["127.0.0.1", ...actualIPs]),
  ]);
  assert.ok(!config.allowedDevOrigins.some((host) => host.includes("*")));
});
