const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Identificador público de demonstração. Não é senha, convite nem credencial. */
export function generateUserCode(existing: readonly string[] = []): string {
  const occupied = new Set(existing.map((code) => code.toUpperCase()));
  for (let attempt = 0; attempt < 1000; attempt++) {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const code = Array.from(
      bytes,
      (byte) => alphabet[byte % alphabet.length],
    ).join("");
    if (/[A-Z]/.test(code) && /[0-9]/.test(code) && !occupied.has(code))
      return code;
  }
  throw new Error(
    "Não foi possível gerar um código disponível. Tente novamente.",
  );
}

export function normalizeUserCode(code: string): string {
  return code.trim().toUpperCase();
}
