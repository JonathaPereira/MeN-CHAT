import {
  mobileAccount,
  privateHeaders as headers,
  boundedJson,
} from "@/lib/mobile/auth";
import { readEmail } from "@/lib/auth/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionInviteIdentity } from "@/lib/invitations/provision";
import {
  invitationHash,
  invitationUrl,
  newInvitationToken,
} from "@/lib/invitations/token";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const auth = await mobileAccount(request);
  if (!auth) return new Response(null, { status: 401, headers });
  if (auth.account.profile.app_role !== "admin")
    return new Response(null, { status: 403, headers });
  let email: string | null;
  try {
    const body = (await boundedJson(request)) as { email?: unknown };
    email = readEmail(typeof body?.email === "string" ? body.email : null);
    if (!email) throw new Error();
  } catch {
    return new Response(null, { status: 400, headers });
  }
  try {
    const token = newInvitationToken();
    const url = invitationUrl(process.env.MENCHAT_SITE_URL || "", token);
    const prepared = await auth.client.rpc("menchat_prepare_invite", {
      p_email: email,
    });
    if (prepared.error || prepared.data !== true)
      return new Response(null, { status: 429, headers });
    const id = await provisionInviteIdentity(createAdminClient(), email);
    if (!id) return new Response(null, { status: 409, headers });
    const result = await auth.client.rpc("menchat_create_invite", {
      p_email: email,
      p_user: id,
      p_hash: invitationHash(token),
    });
    if (result.error) return new Response(null, { status: 409, headers });
    return Response.json({ url }, { headers });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
