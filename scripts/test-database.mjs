import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const container = `menchat-db-test-${randomUUID()}`;
function docker(args, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
    let output = "",
      error = "";
    child.stdout.on("data", (data) => {
      output += data;
    });
    child.stderr.on("data", (data) => {
      error += data;
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(output.trim())
        : reject(new Error(error.trim() || `Docker saiu com código ${code}.`)),
    );
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}
function sql(input) {
  return docker(
    [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-qAt",
      "-U",
      "postgres",
    ],
    input,
  );
}
try {
  // Sem rede e sem portas publicadas. Trust é somente para este banco descartável.
  await docker([
    "run",
    "--detach",
    "--rm",
    "--name",
    container,
    "--network",
    "none",
    "-e",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    "postgres:17",
  ]);
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await docker([
        "exec",
        container,
        "pg_isready",
        "-h",
        "127.0.0.1",
        "-U",
        "postgres",
      ]);
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (!ready)
    throw new Error("PostgreSQL de teste não iniciou em 30 segundos.");
  await sql(
    await readFile(
      new URL("../supabase/tests/bootstrap.sql", import.meta.url),
      "utf8",
    ),
  );
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20261104000100_initial_accounts.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await sql(migration);
  assert.match(
    await sql(
      await readFile(
        new URL("../supabase/verify.sql", import.meta.url),
        "utf8",
      ),
    ),
    /BASE_OK/,
  );
  await sql(
    await readFile(
      new URL("../supabase/tests/accounts.sql", import.meta.url),
      "utf8",
    ),
  );
  console.log(
    "PASS: migração, RLS, perfis pendentes, privilégios, códigos, convites e cota.",
  );
  // Reaplicar deve falhar sem apagar nem modificar o esquema existente.
  await assert.rejects(sql(migration));
  assert.equal(
    await sql("select count(*) from menchat_private.schema_migrations;"),
    "1",
  );
  console.log("PASS: reaplicação não altera o esquema existente.");
  await sql(
    "insert into auth.users(id) select ('00000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid from generate_series(1,21) i;",
  );
  const attempts = await Promise.allSettled(
    Array.from({ length: 21 }, (_, index) =>
      sql(
        `set role service_role; insert into public.menchat_profiles(id,display_name,account_status) values ('00000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}', 'Concorrência', 'active');`,
      ),
    ),
  );
  assert.equal(
    attempts.filter((result) => result.status === "fulfilled").length,
    20,
  );
  assert.equal(
    await sql(
      "select count(*) from public.menchat_profiles where account_status = 'active';",
    ),
    "20",
  );
  assert.equal(
    await sql("select active_profiles from menchat_private.app_state;"),
    "20",
  );
  assert.equal(
    await sql("select count(distinct user_code) from public.menchat_profiles;"),
    "20",
  );
  console.log(
    "PASS: 21 ativações concorrentes resultam em exatamente 20 contas/códigos únicos.",
  );
  // Exercita também a ativação de perfis já pendentes, caminho futuro dos convites.
  await sql(
    "delete from public.menchat_profiles; insert into public.menchat_profiles(id,display_name) select id,'Pendente' from auth.users;",
  );
  const activations = await Promise.allSettled(
    Array.from({ length: 21 }, (_, index) =>
      sql(
        `set role service_role; update public.menchat_profiles set account_status = 'active' where id = '00000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}';`,
      ),
    ),
  );
  assert.equal(
    activations.filter((result) => result.status === "fulfilled").length,
    20,
  );
  assert.equal(
    await sql(
      "select count(*) from public.menchat_profiles where account_status = 'active';",
    ),
    "20",
  );
  assert.equal(
    await sql("select active_profiles from menchat_private.app_state;"),
    "20",
  );
  console.log(
    "PASS: 21 contas pendentes ativadas simultaneamente respeitam a mesma cota.",
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Falha no banco de teste.",
  );
  process.exitCode = 1;
} finally {
  await docker(["rm", "--force", container]).catch(() => {});
}
