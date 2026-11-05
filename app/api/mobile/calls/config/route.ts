import { mobileAccount, privateHeaders as headers } from "@/lib/mobile/auth";
import { iceConfiguration } from "@/lib/calls/config";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const auth = await mobileAccount(request);
  if (!auth) return new Response(null, { status: 401, headers });
  try {
    return Response.json(
      iceConfiguration(process.env, auth.account.profile.id),
      { headers },
    );
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
