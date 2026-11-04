export type Subscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};
export function parseSubscription(value: unknown): Subscription {
  if (!value || typeof value !== "object")
    throw new Error("Dispositivo inválido.");
  const s = value as Partial<Subscription>;
  if (typeof s.endpoint !== "string" || s.endpoint.length > 2048)
    throw new Error("Dispositivo inválido.");
  const url = new URL(s.endpoint);
  const allowed =
    url.hostname === "fcm.googleapis.com" ||
    url.hostname === "web.push.apple.com" ||
    url.hostname === "updates.push.services.mozilla.com";
  if (
    !allowed ||
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error("Serviço de notificações inválido.");
  if (
    !s.keys ||
    !/^[\w-]{87}$/.test(s.keys.p256dh) ||
    !/^[\w-]{22}$/.test(s.keys.auth)
  )
    throw new Error("Chaves do dispositivo inválidas.");
  return {
    endpoint: url.href,
    keys: { p256dh: s.keys.p256dh, auth: s.keys.auth },
  };
}
export function pushReady(env: Record<string, string | undefined>) {
  return (
    /^[\w-]{87}$/.test(env.MENCHAT_VAPID_PUBLIC_KEY || "") &&
    /^[\w-]{43}$/.test(env.MENCHAT_VAPID_PRIVATE_KEY || "") &&
    !!env.SUPABASE_SECRET_KEY
  );
}

export function hasSameOrigin(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).origin !== origin) return false;
    const internal = new URL(request.url);
    const host = request.headers.get("host") || internal.host;
    const protocol = request.headers.get("x-forwarded-proto") || internal.protocol.slice(0, -1);
    if (!["https", "http"].includes(protocol)) return false;
    return origin === `${protocol}://${host}`;
  } catch { return false; }
}
