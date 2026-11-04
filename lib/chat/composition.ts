export type SendContext = { replyId: string | null; mentionIds: string[] };
export function sameComposition(a: SendContext, b: SendContext) {
  return (
    a.replyId === b.replyId &&
    [...a.mentionIds].sort().join(",") === [...b.mentionIds].sort().join(",")
  );
}
export function quotedText(body: string, hasAttachment: boolean) {
  return body.trim()
    ? body.slice(0, 180)
    : hasAttachment
      ? "Anexo"
      : "Mensagem indisponível";
}
export function mentionStart(
  text: string,
  caret: number,
  names: readonly string[],
): number {
  const before = text.slice(0, caret),
    at = before.lastIndexOf("@");
  if (at < 0 || (at > 0 && !/\s/.test(before[at - 1]))) return -1;
  const token = before.slice(at);
  if (
    token.length > 31 ||
    token.includes("\n") ||
    names.some((name) => token.startsWith(`@${name} `))
  )
    return -1;
  return at;
}
