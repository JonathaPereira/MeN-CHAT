import { createHash, randomBytes } from "node:crypto";
export function newInvitationToken() {
  return randomBytes(32).toString("base64url");
}
export function validInvitationToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}
export function invitationHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
export function invitationUrl(origin: string, token: string): string {
  const url = new URL(origin);
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (
    (!local && url.protocol !== "https:") ||
    (local && !["http:", "https:"].includes(url.protocol)) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Configure MENCHAT_SITE_URL com a origem HTTPS do aplicativo.",
    );
  url.pathname = "/convite";
  url.hash = `token=${token}`;
  return url.toString();
}
