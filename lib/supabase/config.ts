/** Apenas valores públicos; erros nunca incluem o conteúdo das variáveis. */
export function parseSupabaseConfig(
  url: string | undefined,
  key: string | undefined,
) {
  if (!url?.trim() || !key?.trim())
    throw new Error(
      "Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no arquivo .env.local.",
    );
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error(
      "A URL do Supabase é inválida. Copie a Project URL do painel.",
    );
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/"
  )
    throw new Error(
      "Use a Project URL HTTPS, sem senha, caminho, parâmetros ou fragmentos.",
    );
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key.trim()))
    throw new Error(
      "Use a publishable key (sb_publishable_...). Não use secret key, service_role ou senha do banco.",
    );
  return { url: parsed.origin, key: key.trim() };
}
