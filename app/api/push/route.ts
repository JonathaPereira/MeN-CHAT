import { hasSameOrigin } from "@/lib/push/validation";
import { cookies } from "next/headers";
import { getAccount } from "@/lib/auth/account";
import { createClient } from "@/lib/supabase/server";
import { parseSubscription, pushReady } from "@/lib/push/validation";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  const account = await getAccount();
  if (account.kind !== "active")
    return Response.json(
      { error: "Entre na sua conta." },
      { status: 401, headers },
    );
  if (!pushReady(process.env))
    return Response.json(
      {
        error:
          "As notificações em segundo plano aguardam a configuração do administrador.",
      },
      { status: 503, headers },
    );
  return Response.json(
    { publicKey: process.env.MENCHAT_VAPID_PUBLIC_KEY },
    { headers },
  );
}
export async function POST(request: Request) {
  if (!hasSameOrigin(request))
    return new Response(null, { status: 403, headers });
  const account = await getAccount();
  if (account.kind !== "active")
    return new Response(null, { status: 401, headers });
  try {
    if (Number(request.headers.get("content-length")) > 10000)
      throw new Error();
    const raw = await request.text();
    if (raw.length > 10000) throw new Error();
    const body = JSON.parse(raw);
    const subscription = parseSubscription(body.subscription);
    if (
      typeof body.enabled !== "boolean" ||
      !Array.isArray(body.muted) ||
      body.muted.length > 256 ||
      body.muted.some(
        (id: unknown) => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id),
      )
    )
      throw new Error();
    const client = await createClient();
    const result = await client.rpc("menchat_register_push", {
      p_subscription: subscription,
      p_enabled: body.enabled,
      p_muted: body.muted,
    });
    if (result.error)
      return Response.json(
        {
          error:
            "Não foi possível salvar o dispositivo. Confira a atualização do banco.",
        },
        { status: 503, headers },
      );
    (await cookies()).set("menchat_push_id", result.data, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 31536000,
    });
    return new Response(null, { status: 204, headers });
  } catch {
    return new Response(null, { status: 400, headers });
  }
}
