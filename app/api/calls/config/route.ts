import { getAccount } from "@/lib/auth/account";
import { iceConfiguration } from "@/lib/calls/config";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  const account = await getAccount();
  if (account.kind !== "active")
    return new Response(null, { status: 401, headers });
  try {
    return Response.json(iceConfiguration(process.env, account.profile.id), {
      headers,
    });
  } catch {
    return Response.json(
      {
        error: "Chamadas aguardam a configuração de conexão do administrador.",
      },
      { status: 503, headers },
    );
  }
}
