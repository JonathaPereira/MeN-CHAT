import { after } from "next/server";
import { getAccount } from "@/lib/auth/account";
import { boundedJson, privateHeaders as headers } from "@/lib/mobile/auth";
import { hasSameOrigin } from "@/lib/push/validation";
import { deliverNativePush } from "@/lib/native-push/server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  if (!hasSameOrigin(request))
    return new Response(null, { status: 403, headers });
  const account = await getAccount();
  if (account.kind !== "active")
    return new Response(null, { status: 401, headers });
  try {
    const data = (await boundedJson(request)) as { id?: unknown };
    if (typeof data?.id !== "string" || !/^[a-f0-9-]{36}$/i.test(data.id))
      throw new Error();
    after(() => deliverNativePush(account.profile.id, data.id as string));
    return new Response(null, { status: 202, headers });
  } catch {
    return new Response(null, { status: 400, headers });
  }
}
