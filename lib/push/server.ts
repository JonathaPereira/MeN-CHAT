import "server-only";
import { deliverNativePush } from "@/lib/native-push/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseSubscription, pushReady, type Subscription } from "./validation";
type Job = Subscription & { message: string; subscription: string };
async function deliverWebPush(actor: string | null, message: string | null) {
  if (!pushReady(process.env)) return;
  const client = createAdminClient();
  const claim = await client.rpc("menchat_claim_push", {
    p_actor: actor,
    p_message: message,
  });
  if (claim.error || !Array.isArray(claim.data)) return;
  const jobs = claim.data as Job[];
  // Bounded batches; timeouts leave durable leases for a scheduled retry.
  for (let offset = 0; offset < jobs.length; offset += 10) {
    await Promise.all(
      jobs.slice(offset, offset + 10).map(async (job) => {
        let result = "retry";
        try {
          const subscription = parseSubscription(job);
          await webpush.sendNotification(
            subscription,
            JSON.stringify({
              title: "MenChat",
              body: "Você tem uma nova mensagem.",
              tag: job.message,
            }),
            {
              TTL: 3600,
              urgency: "normal",
              timeout: 5000,
              vapidDetails: {
                subject:
                  process.env.MENCHAT_VAPID_SUBJECT ||
                  "https://men-chat.vercel.app",
                publicKey: process.env.MENCHAT_VAPID_PUBLIC_KEY!,
                privateKey: process.env.MENCHAT_VAPID_PRIVATE_KEY!,
              },
            },
          );
          result = "sent";
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) result = "expired";
        }
        await client.rpc("menchat_finish_push", {
          p_message: job.message,
          p_subscription: job.subscription,
          p_result: result,
        });
      }),
    );
  }
}

export async function deliverPush(
  actor: string | null,
  message: string | null,
) {
  await Promise.allSettled([
    deliverWebPush(actor, message),
    deliverNativePush(actor, message),
  ]);
}
