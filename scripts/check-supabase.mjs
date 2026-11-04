import { existsSync } from "node:fs";
import { parseSupabaseConfig } from "../lib/supabase/config.ts";
import { checkSupabaseConnection } from "../lib/supabase/check-connection.ts";
try {
  // Variáveis já configuradas no ambiente têm precedência sobre o arquivo local.
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const config = parseSupabaseConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  await checkSupabaseConnection(config);
  console.log("Conexão com Supabase OK. Cadastro público bloqueado.");
  console.log(
    "Teste somente de Auth/HTTP: não valida tabelas, RLS, login ou convites. Nenhum dado foi alterado.",
  );
} catch (error) {
  // Não imprimir stack, corpo HTTP, variáveis ou causas que possam conter chaves.
  console.error(
    error instanceof Error && error.message
      ? error.message
      : "Não foi possível verificar o Supabase.",
  );
  process.exitCode = 1;
}
