import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { createConnection } from "node:net";
const execute = promisify(execFile);
/** Disposable localhost-only TURN. No production credentials or external media routes. */
export default async function setup() {
  if (process.env.MENCHAT_TEST_TURN_URL) return;
  const name = `menchat-turn-test-${randomUUID()}`;
  const docker = (args: string[]) =>
    execute("docker", args, { timeout: 120000, maxBuffer: 1024 * 1024 });
  try {
    await docker(["info", "--format", "{{.ServerVersion}}"]);
    await docker([
      "run",
      "--detach",
      "--rm",
      "--name",
      name,
      "--publish",
      "127.0.0.1::3478/tcp",
      "coturn/coturn:4.6.3@sha256:71c3c990283385567f11794ee692e3a47b66fd9b0bb39e42afbe776e331dd888",
      "--no-cli",
      "--no-tls",
      "--no-dtls",
      "--realm",
      "menchat.fixture",
      "--user",
      "fixture:fixture-only",
      "--lt-cred-mech",
      "--listening-port",
      "3478",
      "--listening-ip",
      "0.0.0.0",
      "--min-port",
      "49160",
      "--max-port",
      "49200",
      "--allow-loopback-peers",
      "--no-multicast-peers",
      "--log-file",
      "stdout",
    ]);
    const { stdout } = await docker(["port", name, "3478/tcp"]);
    const port = Number(stdout.trim().split(":").at(-1));
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error();
    let ready = false;
    for (let i = 0; i < 40; i++) {
      ready = await new Promise<boolean>((resolve) => {
        const socket = createConnection({ host: "127.0.0.1", port });
        socket.setTimeout(500);
        socket.once("connect", () => {
          socket.destroy();
          resolve(true);
        });
        socket.once("error", () => {
          socket.destroy();
          resolve(false);
        });
        socket.once("timeout", () => {
          socket.destroy();
          resolve(false);
        });
      });
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!ready) throw new Error();
    process.env.MENCHAT_TEST_TURN_URL = `turn:127.0.0.1:${port}?transport=tcp`;
    return async () => {
      await docker(["rm", "--force", name]).catch(() => {});
    };
  } catch {
    await docker(["rm", "--force", name]).catch(() => {});
    throw new Error(
      "Os testes de chamada precisam do Docker iniciado para o TURN local descartável. Abra o Docker e repita. Nenhuma credencial de produção é usada.",
    );
  }
}
