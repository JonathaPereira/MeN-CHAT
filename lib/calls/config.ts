import { createHmac } from "node:crypto";
export type IceServer = {
  urls: string[];
  username?: string;
  credential?: string;
};
export function turnUrls(env: Record<string, string | undefined>): string[] {
  try {
    const urls: unknown = JSON.parse(env.MENCHAT_TURN_URLS || "[]");
    if (
      !Array.isArray(urls) ||
      urls.length < 1 ||
      urls.length > 8 ||
      urls.some(
        (url) =>
          typeof url !== "string" ||
          !/^turns?:[a-z0-9.-]+(?::[0-9]{1,5})?(?:\?transport=(?:udp|tcp))?$/i.test(
            url,
          ),
      )
    )
      return [];
    return urls;
  } catch {
    return [];
  }
}
function turnReady(env: Record<string, string | undefined>) {
  return (
    !!env.MENCHAT_TURN_SECRET &&
    env.MENCHAT_TURN_SECRET.length >= 32 &&
    turnUrls(env).length > 0
  );
}
// Direct WebRTC is available without an external relay. Administrators may opt out.
export function callsReady(env: Record<string, string | undefined>) {
  return env.MENCHAT_CALLS_ENABLED?.trim().toLowerCase() !== "false";
}
export function iceConfiguration(
  env: Record<string, string | undefined>,
  actor: string,
  now = Date.now(),
) {
  if (!callsReady(env) || !/^[a-f0-9-]{36}$/i.test(actor))
    throw new Error("Calls unavailable");
  const expires = Math.floor(now / 1000) + 1200;
  const servers: IceServer[] = [{ urls: ["stun:stun.l.google.com:19302"] }];
  if (turnReady(env)) {
    const username = `${expires}:${actor}`;
    const credential = createHmac("sha1", env.MENCHAT_TURN_SECRET!)
      .update(username).digest("base64");
    servers.push({ urls: turnUrls(env), username, credential });
  }
  return { iceServers: servers, expires, maxParticipants: 4 };
}
