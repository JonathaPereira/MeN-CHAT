import { hasSameOrigin } from "@/lib/push/validation";
import { after } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getAccount } from "@/lib/auth/account";
import { deliverPush } from "@/lib/push/server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const secret = process.env.MENCHAT_PUSH_CRON_SECRET;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer /, "");
  const cron =
    !!secret &&
    secret.length >= 32 &&
    !!bearer &&
    Buffer.byteLength(secret) === Buffer.byteLength(bearer) &&
    timingSafeEqual(Buffer.from(secret), Buffer.from(bearer));
  if (cron) {
    after(() => deliverPush(null, null));
    return new Response(null, { status: 202, headers });
  }
  if (!hasSameOrigin(request))
    return new Response(null, { status: 403, headers });
  const account = await getAccount();
  if (account.kind !== "active")
    return new Response(null, { status: 401, headers });
  // The privileged worker is restricted to messages from this validated actor.
  after(() => deliverPush(account.profile.id, null));
  return new Response(null, { status: 202, headers });
}
