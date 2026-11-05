import "server-only";
import { createClient } from "@supabase/supabase-js";
import { parseSupabaseConfig } from "@/lib/supabase/config";
import { authFetch } from "@/lib/supabase/request";
import { loadAccount } from "@/lib/auth/access";
export async function mobileAccount(request: Request) {
  const value = request.headers.get("authorization");
  if (!value || !/^Bearer [A-Za-z0-9._-]{20,8192}$/.test(value)) return null;
  try {
    const config = parseSupabaseConfig(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    const client = createClient(config.url, config.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { fetch: authFetch, headers: { Authorization: value } },
    });
    const account = await loadAccount(client);
    return account.kind === "active" ? { client, account } : null;
  } catch {
    return null;
  }
}
export const privateHeaders = { "Cache-Control": "private, no-store" };
export async function boundedJson(
  request: Request,
  limit = 4096,
): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > limit)
    throw new Error("body");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("body");
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > limit) {
        await reader.cancel();
        throw new Error("body");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const buffer = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
}
