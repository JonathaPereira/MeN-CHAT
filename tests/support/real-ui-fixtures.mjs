// Identidades fictícias para testes isolados. Nunca usam um projeto Supabase.
export const userId = "70000000-0000-0000-0000-000000000001";
export const profile = {
  id: userId,
  display_name: "Pessoa de teste",
  user_code: "T3ST12",
  status_message: "Testando o MenChat",
  avatar_path: null,
  show_code: true,
  allow_code_lookup: true,
  read_receipts: true,
  show_typing: true,
  account_status: "active",
  app_role: "admin",
};
export const user = {
  id: userId,
  email: "ui@example.test",
  email_confirmed_at: "2026-11-04T00:00:00Z",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [],
  created_at: "2026-11-04T00:00:00Z",
};
export function sessionCookie() {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token =
    encode({ alg: "HS256", typ: "JWT" }) +
    "." +
    encode({
      sub: userId,
      aud: "authenticated",
      role: "authenticated",
      exp,
      iat: exp - 3600,
      iss: "https://menchat.invalid/auth/v1",
    }) +
    ".dGVzdA";
  return (
    "base64-" +
    encode({
      access_token: token,
      refresh_token: "ui-only",
      expires_at: exp,
      expires_in: 3600,
      token_type: "bearer",
      user,
    })
  );
}
