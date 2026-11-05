import { firebasePublic, nativePushReady } from "@/lib/native-push/config";
import { callsReady } from "@/lib/calls/config";
import { parseSupabaseConfig } from "@/lib/supabase/config";
export const dynamic = "force-dynamic";
// Only the same public URL/key already used by the web client. Never administrative keys.
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const config = parseSupabaseConfig(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    return Response.json(
      {
        url: config.url,
        publishableKey: config.key,
        firebase: firebasePublic(process.env),
        nativePushReady: nativePushReady(process.env),
        callsReady: callsReady(process.env),
      },
      { headers },
    );
  } catch {
    return Response.json(
      { error: "Aplicativo indisponível. Tente novamente mais tarde." },
      { status: 503, headers },
    );
  }
}
