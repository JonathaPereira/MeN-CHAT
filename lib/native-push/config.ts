export type FirebasePublic = {
  appId: string;
  projectId: string;
  senderId: string;
  apiKey: string;
};
export function firebasePublic(
  env: Record<string, string | undefined>,
): FirebasePublic | null {
  const appId = env.MENCHAT_FIREBASE_APP_ID || "",
    projectId = env.MENCHAT_FIREBASE_PROJECT_ID || "",
    senderId = env.MENCHAT_FIREBASE_SENDER_ID || "",
    apiKey = env.MENCHAT_FIREBASE_API_KEY || "";
  return /^1:[0-9]+:android:[a-f0-9]+$/i.test(appId) &&
    appId.split(":")[1] === senderId &&
    /^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId) &&
    /^[0-9]{5,20}$/.test(senderId) &&
    /^AIza[A-Za-z0-9_-]{35}$/.test(apiKey)
    ? { appId, projectId, senderId, apiKey }
    : null;
}
export function nativePushReady(env: Record<string, string | undefined>) {
  return (
    !!firebasePublic(env) &&
    !!env.SUPABASE_SECRET_KEY &&
    /^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/.test(
      env.MENCHAT_FIREBASE_CLIENT_EMAIL || "",
    ) &&
    (env.MENCHAT_FIREBASE_PRIVATE_KEY || "")
      .replace(/\\n/g, "\n")
      .startsWith("-----BEGIN PRIVATE KEY-----")
  );
}
export type NativePushJob = {
  id: string;
  device: string;
  recipient: string;
  thread: string;
  kind: "message" | "call";
  stamp: string;
  lease: string;
  token: string;
};
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
export function parseNativeJob(raw: unknown): NativePushJob {
  if (!raw || typeof raw !== "object") throw new Error("job");
  const value = raw as Record<string, unknown>;
  for (const key of ["id", "device", "recipient", "thread", "lease"])
    if (typeof value[key] !== "string" || !uuid.test(value[key]))
      throw new Error("job");
  if (
    !["message", "call"].includes(String(value.kind)) ||
    typeof value.token !== "string" ||
    !/^[A-Za-z0-9:_.-]{20,4096}$/.test(value.token) ||
    typeof value.stamp !== "string" ||
    !/^[0-9]{10,16}$/.test(value.stamp)
  )
    throw new Error("job");
  return value as NativePushJob;
}
export function notificationPreview(value: unknown): {title: string; body: string} | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.title !== "string" || typeof row.body !== "string" || !row.title.trim()) return null;
  const clean = (text: string) => text.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  // Match Android UTF-16 bounds without cutting an emoji surrogate pair.
  const clip = (text: string, limit: number) => {
    let result = "";
    for (const symbol of text) {
      if (result.length + symbol.length > limit) break;
      result += symbol;
    }
    return result;
  };
  const body = clean(row.body), summary = clip(body,160);
  return { title: clip(clean(row.title),60), body: summary + (body.length>summary.length ? "…" : "") };
}
export function nativePayload(job: NativePushJob, preview: {title: string; body: string} | null = null) {
  return {
    message: {
      token: job.token,
      data: {
        id: job.id,
        recipient: job.recipient,
        thread: job.thread,
        kind: job.kind,
        stamp: job.stamp,
        ...(job.kind === "message" && preview ? {title: preview.title, body: preview.body} : {}),
      },
      android: {
        priority: "HIGH",
        ttl: job.kind === "call" ? "45s" : "3600s",
        collapse_key: job.kind === "call" ? "menchat-call" : "menchat-message",
      },
    },
  };
}
