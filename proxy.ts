import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { parseSupabaseConfig } from "@/lib/supabase/config";
import { authFetch } from "@/lib/supabase/request";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const preventCache = () => {
    response.headers.set(
      "Cache-Control",
      "private, no-cache, no-store, must-revalidate, max-age=0",
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
  };
  preventCache();
  let config;
  try {
    config = parseSupabaseConfig(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
  } catch {
    return response;
  }
  const client = createServerClient(config.url, config.key, {
    global: { fetch: authFetch },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies, headers) {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
        preventCache();
      },
    },
  });
  // Renovação oficial SSR. Autorização é revalidada com getUser + RLS na página.
  try {
    await client.auth.getClaims();
  } catch {
    /* A página falha fechada se a identidade não puder ser validada. */
  }
  return response;
}
export const config = {
  matcher: ["/convite", "/entrar", "/primeiro-acesso", "/conta/:path*"],
};
