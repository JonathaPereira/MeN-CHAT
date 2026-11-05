import { after } from "next/server";
import {
  mobileAccount,
  privateHeaders as headers,
  boundedJson,
} from "@/lib/mobile/auth";
import { deliverPush } from "@/lib/push/server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const auth = await mobileAccount(request);
  if (!auth) return new Response(null, { status: 401, headers });
  let id: string;
  try {
    const data = (await boundedJson(request)) as { id?: unknown };
    if (
      typeof data?.id !== "string" ||
      !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(data.id)
    )
      throw new Error();
    id = data.id;
  } catch {
    return new Response(null, { status: 400, headers });
  }
  const row = await auth.client
    .from("menchat_messages")
    .select("id")
    .eq("id", id)
    .eq("sender_id", auth.account.profile.id)
    .maybeSingle();
  if (row.error || !row.data)
    return new Response(null, { status: 403, headers });
  after(() => deliverPush(auth.account.profile.id, id));
  return new Response(null, { status: 202, headers });
}
