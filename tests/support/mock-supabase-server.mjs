// Preload EXCLUSIVO do processo de teste. Sem importação em app/, components/ ou lib/.
import { profile, user } from "./real-ui-fixtures.mjs";
const original = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
  );
  if (url.hostname !== "menchat.invalid") return original(input, init);
  const headers = { "content-type": "application/json" };
  if (url.pathname === "/auth/v1/user")
    return new Response(JSON.stringify(user), { headers });
  if (url.pathname === "/rest/v1/menchat_profiles")
    return new Response(JSON.stringify(profile), { headers });
  return new Response(JSON.stringify({ message: "Endpoint não simulado" }), {
    status: 404,
    headers,
  });
};
