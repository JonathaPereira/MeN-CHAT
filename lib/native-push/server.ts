import "server-only";
import { createSign, createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { nativePushReady, nativePayload, parseNativeJob } from "./config";
let cached: { identity: string; token: string; expires: number } | undefined;
let acquiring: Promise<string> | undefined;
async function accessToken(): Promise<string> {
  const project = process.env.MENCHAT_FIREBASE_PROJECT_ID!,
    email = process.env.MENCHAT_FIREBASE_CLIENT_EMAIL!,
    key = process.env.MENCHAT_FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const identity = createHash("sha256")
    .update(project + email + key)
    .digest("hex");
  if (cached?.identity === identity && cached.expires > Date.now() + 60_000)
    return cached.token;
  if (acquiring) return acquiring;
  const task = (async () => {
    const now = Math.floor(Date.now() / 1000);
    const encode = (value: unknown) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iss: email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
    const signature = createSign("RSA-SHA256")
      .update(unsigned)
      .sign(key, "base64url");
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: unsigned + "." + signature,
      }),
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("FCM unavailable");
    const result = await response.json();
    if (
      typeof result.access_token !== "string" ||
      result.access_token.length > 8192 ||
      typeof result.expires_in !== "number"
    )
      throw new Error("FCM unavailable");
    cached = {
      identity,
      token: result.access_token,
      expires: Date.now() + Math.min(3600, result.expires_in) * 1000,
    };
    return cached.token;
  })();
  acquiring = task;
  try {
    return await task;
  } finally {
    if (acquiring === task) acquiring = undefined;
  }
}
export async function deliverNativePush(
  actor: string | null,
  event: string | null,
) {
  if (!nativePushReady(process.env)) return;
  const client = createAdminClient();
  let authorization: string;
  try {
    authorization = await accessToken();
  } catch {
    return;
  }
  const claim = await client.rpc("menchat_claim_native_push", {
    p_actor: actor,
    p_event: event,
  });
  if (claim.error || !Array.isArray(claim.data)) return;
  for (let offset = 0; offset < claim.data.length; offset += 20) {
    await Promise.all(
      claim.data.slice(offset, offset + 20).map(async (raw: unknown) => {
        let job;
        try {
          job = parseNativeJob(raw);
        } catch {
          return;
        }
        let result = "retry";
        try {
          const response = await fetch(
            `https://fcm.googleapis.com/v1/projects/${process.env.MENCHAT_FIREBASE_PROJECT_ID!}/messages:send`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${authorization}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(nativePayload(job)),
              redirect: "error",
              cache: "no-store",
              signal: AbortSignal.timeout(5000),
            },
          );
          if (response.ok) result = "sent";
          else if (response.status === 404) {
            const details = await response.json().catch(() => null);
            if (
              details?.error?.details?.some(
                (item: { errorCode?: string }) =>
                  item.errorCode === "UNREGISTERED",
              )
            )
              result = "expired";
          }
        } catch {
          /* Lease retries on the next scheduled pass. No token/body logging. */
        }
        await client.rpc("menchat_finish_native_push", {
          p_event: job.id,
          p_device: job.device,
          p_lease: job.lease,
          p_result: result,
        });
      }),
    );
  }
}
