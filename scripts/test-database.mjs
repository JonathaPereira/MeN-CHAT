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
  // Reproduz o contador antigo antes de aplicar a correção incremental.
  await sql(
    "insert into auth.users(id) values ('90000000-0000-0000-0000-000000000001'); insert into public.menchat_profiles(id,display_name,account_status) values ('90000000-0000-0000-0000-000000000001','Repetido','active'); insert into public.menchat_profiles(id,display_name,account_status) values ('90000000-0000-0000-0000-000000000001','Repetido','active') on conflict (id) do update set display_name = excluded.display_name;",
  );
  assert.equal(
    await sql("select active_profiles from menchat_private.app_state;"),
    "2",
  );
  await sql(
    await readFile(
      new URL(
        "../supabase/migrations/20261104000200_profile_accounting.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await sql(
    await readFile(
      new URL(
        "../supabase/migrations/20261104000300_private_chat.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await sql(
    await readFile(
      new URL(
        "../supabase/migrations/20261104000400_managed_invitations.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await sql(
    await readFile(
      new URL(
        "../supabase/migrations/20261104000500_complete_chat.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await sql(
    await readFile(
      new URL("../supabase/tests/complete-chat.sql", import.meta.url),
      "utf8",
    ),
  );
  assert.match(
    await sql(
      await readFile(
        new URL("../supabase/verify-complete-chat.sql", import.meta.url),
        "utf8",
      ),
    ),
    /CHAT_COMPLETO_OK/,
  );
  await sql(
    await readFile(
      new URL(
        "../supabase/migrations/20261104000600_official_app.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await sql(
    await readFile(
      new URL("../supabase/tests/official-app.sql", import.meta.url),
      "utf8",
    ),
  );
  await sql(
    await readFile(
      new URL(
        "../supabase/migrations/20261104000700_chat_refinements.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await sql(
    await readFile(
      new URL("../supabase/tests/chat-refinements.sql", import.meta.url),
      "utf8",
    ),
  );
  console.log(
    "PASS: respostas isoladas por conversa, menções autorizadas e marcações pessoais.",
  );
  console.log(
    "PASS: exclusão por autor, ocultação pessoal e contagem privada de não lidas.",
  );
  console.log("PASS: grupos, mídia privada, limites, perfil e indicadores.");
  assert.match(
    await sql(
      await readFile(
        new URL("../supabase/verify-invitations.sql", import.meta.url),
        "utf8",
      ),
    ),
    /CONVITES_OK/,
  );
  await sql(
    await readFile(
      new URL("../supabase/tests/invitations.sql", import.meta.url),
      "utf8",
    ),
  );
  console.log(
    "PASS: convites exigem admin, e-mail e OTP recente; uso único, revogação, validade, cota e privilégios.",
  );
  await sql(
    await readFile(
      new URL("../supabase/tests/private-chat.sql", import.meta.url),
      "utf8",
    ),
  );
  console.log(
    "PASS: privados, autores, admin externo, conta desativada, privacidade e limite de busca.",
  );
  assert.equal(
    await sql("select active_profiles from menchat_private.app_state;"),
    "1",
  );
  await sql(
    "insert into public.menchat_profiles(id,display_name,account_status) values ('90000000-0000-0000-0000-000000000001','Repetido','active') on conflict (id) do update set display_name = excluded.display_name;",
  );
  assert.equal(
    await sql("select active_profiles from menchat_private.app_state;"),
    "1",
  );
  await sql(
    "delete from auth.users where id = '90000000-0000-0000-0000-000000000001';",
  );
  console.log(
    "PASS: upgrade corrige o contador antigo e upsert não consome vaga extra.",
  );
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
    "7",
  );
  console.log("PASS: reaplicação não altera o esquema existente.");
  const ownerScript = (
    await readFile(
      new URL("../supabase/setup-owner.sql", import.meta.url),
      "utf8",
    )
  )
    .replace(/begin;\s*do/i, "do")
    .replace(/commit;\s*$/, "");
  const owner = ownerScript.replace(
    "lower(btrim('SEU_EMAIL_AQUI'))",
    "lower(btrim('owner@example.test'))",
  );
  await assert.rejects(
    sql(`begin; ${owner} rollback;`),
    /não encontrada|não verificado/,
  );
  await sql(
    "insert into auth.users(id,email) values ('10000000-0000-0000-0000-000000000001','owner@example.test');",
  );
  await assert.rejects(sql(`begin; ${owner} rollback;`), /não verificado/);
  await sql(
    "update auth.users set email_confirmed_at = now() where email = 'owner@example.test';",
  );
  await sql(
    `begin; ${owner} ${owner} do $$ begin if (select active_profiles from menchat_private.app_state) <> 1 then raise exception 'Proprietário repetido alterou contador.'; end if; end $$; rollback;`,
  );
  await sql(
    "insert into auth.users(id,email,email_confirmed_at) values ('10000000-0000-0000-0000-000000000002','other@example.test',now());",
  );
  await assert.rejects(
    sql(
      `begin; ${owner} ${owner.replaceAll("owner@example.test", "other@example.test")} rollback;`,
    ),
    /Já existe outro/,
  );
  await sql("delete from auth.users;");
  assert.equal(
    await sql("select active_profiles from menchat_private.app_state;"),
    "0",
  );
  console.log(
    "PASS: proprietário exige e-mail verificado, é idempotente e não promove outra pessoa.",
  );
  // Reservas concorrentes não podem ultrapassar a capacidade restante.
  await sql(
    "insert into auth.users(id,email,email_confirmed_at) select ('50000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'race'||i||'@example.test',now() from generate_series(1,22) i; insert into public.menchat_profiles(id,display_name,account_status,app_role) values('50000000-0000-0000-0000-000000000001','Admin','active','admin');",
  );
  const reservations = await Promise.allSettled(
    Array.from({ length: 21 }, (_, index) => {
      const i = index + 2;
      return sql(
        `select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000001',false); set role authenticated; select public.menchat_create_invite('race${i}@example.test',('50000000-0000-0000-0000-'||lpad('${i}',12,'0'))::uuid,encode(sha256(convert_to(repeat(lpad('${i}',2,'0'),21)||'A','UTF8')),'hex'));`,
      );
    }),
  );
  assert.equal(reservations.filter((r) => r.status === "fulfilled").length, 19);
  const winner = await sql(
    "select pending_user_id from menchat_private.invitations where consumed_at is null and revoked_at is null order by pending_user_id limit 1;",
  );
  assert.match(winner, /^50000000-0000-0000-0000-[0-9]{12}$/);
  const number = Number(winner.slice(-12));
  const accept = `select set_config('request.jwt.claim.sub','${winner}',false); select set_config('request.jwt.claims',jsonb_build_object('amr',jsonb_build_array(jsonb_build_object('method','otp','timestamp',extract(epoch from now())::bigint)))::text,false); set role authenticated; select public.menchat_accept_invite(repeat(lpad('${number}',2,'0'),21)||'A','Aceite concorrente');`;
  const accepts = await Promise.allSettled([sql(accept), sql(accept)]);
  assert.equal(accepts.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    await sql(
      "select count(*) from menchat_private.invitations where consumed_at is not null;",
    ),
    "1",
  );
  assert.equal(
    await sql("select active_profiles from menchat_private.app_state;"),
    "2",
  );
  await sql("delete from menchat_private.invitations; delete from auth.users;");
  console.log(
    "PASS: 21 reservas concorrentes deixam 19 vagas com um admin; dois aceites simultâneos consomem o convite uma vez.",
  );
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
  await sql(
    "delete from auth.users; insert into auth.users(id) select ('80000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,21) i; insert into public.menchat_profiles(id,display_name) select id,'Corrida de grupos' from auth.users; update public.menchat_profiles set account_status='active' where right(id::text,12)::integer<=20;",
  );
  const ownerId = "80000000-0000-0000-0000-000000000001";
  const codes = await sql(
    "select string_agg(quote_literal(user_code),',') from public.menchat_profiles where right(id::text,12)::integer between 2 and 19;",
  );
  const creation = await sql(
    `select set_config('request.jwt.claim.sub','${ownerId}',false); set role authenticated; select public.menchat_create_group('Última vaga',array[${codes}]);`,
  );
  const group = creation.split("\n").at(-1);
  assert.match(group, /^[0-9a-f-]{36}$/);
  await sql(
    "update public.menchat_profiles set account_status='disabled' where id='80000000-0000-0000-0000-000000000019'; update public.menchat_profiles set account_status='active' where id='80000000-0000-0000-0000-000000000021';",
  );
  const joins = await Promise.allSettled(
    [20, 21].map(async (i) => {
      const code = await sql(
        `select user_code from public.menchat_profiles where id=('80000000-0000-0000-0000-'||lpad('${i}',12,'0'))::uuid;`,
      );
      return sql(
        `select set_config('request.jwt.claim.sub','${ownerId}',false); set role authenticated; select public.menchat_manage_group('${group}','add',null,'${code}');`,
      );
    }),
  );
  assert.equal(joins.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    await sql(
      `select count(*) from public.menchat_group_members where thread_id='${group}' and active;`,
    ),
    "20",
  );
  for (let i = 0; i < 3; i++) {
    const reservation = await sql(
      `select set_config('request.jwt.claim.sub','${ownerId}',false); set role authenticated; select id::text||'|'||path from public.menchat_reserve_upload('${group}','race.png','image/png',100);`,
    );
    const [uploadId, path] = reservation.split("\n").at(-1).split("|");
    await sql(
      `select set_config('request.jwt.claim.sub','${ownerId}',false); set role authenticated; insert into storage.objects(bucket_id,name,metadata) values('menchat-media','${path}','{"size":100,"mimetype":"image/png"}');`,
    );
    const messageId = randomUUID();
    const operations = await Promise.allSettled([
      sql(
        `begin; select set_config('request.jwt.claim.sub','${ownerId}',true); set local role authenticated; select public.menchat_send_upload('${messageId}','${uploadId}','Corrida'); select pg_sleep(0.1); commit;`,
      ),
      sql(
        `begin; select set_config('request.jwt.claim.sub','${ownerId}',true); set local role authenticated; delete from storage.objects where bucket_id='menchat-media' and name='${path}'; select pg_sleep(0.1); commit;`,
      ),
    ]);
    assert.ok(operations.some((r) => r.status === "fulfilled"));
    assert.equal(
      await sql(
        `select count(*) from public.menchat_messages m where m.id='${messageId}' and not exists(select 1 from storage.objects o where o.name='${path}' and o.bucket_id='menchat-media');`,
      ),
      "0",
    );
  }
  console.log(
    "PASS: última vaga de grupo e publicação/descarte concorrentes preservam limite e arquivos publicados.",
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Falha no banco de teste.",
  );
  process.exitCode = 1;
} finally {
  await docker(["rm", "--force", container]).catch(() => {});
}
