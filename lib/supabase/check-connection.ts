/** Leitura pública das configurações de Auth. Não cria usuários ou tabelas. */
export async function checkSupabaseConnection(
  config: { url: string; key: string },
  request: typeof fetch = fetch,
) {
  let response: Response;
  try {
    response = await request(`${config.url}/auth/v1/settings`, {
      headers: { apikey: config.key },
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "Não foi possível alcançar o Supabase. Confira a URL, se o projeto está ativo e o acesso à rede. A tentativa tem limite de 10 segundos.",
    );
  }
  if (response.status === 401 || response.status === 403)
    throw new Error(
      "Acesso recusado. Confira se a URL e a chave publicável pertencem ao mesmo projeto.",
    );
  if (!response.ok)
    throw new Error(
      `O Supabase respondeu com HTTP ${response.status}. Confira o estado do projeto no painel.`,
    );
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("Resposta inesperada do serviço de autenticação.");
  }
  if (
    !data ||
    typeof data !== "object" ||
    !("disable_signup" in data) ||
    data.disable_signup !== true
  )
    throw new Error(
      "Não foi possível confirmar o bloqueio de cadastro público. Desative Allow new users to sign up em Authentication e execute novamente.",
    );
  return { connected: true, publicSignupDisabled: true } as const;
}
