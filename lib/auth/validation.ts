export type AuthResult = { error?: string; notice?: string };
export function readEmail(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? email
    : null;
}
export function validNewPassword(password: string): boolean {
  return (
    password.length >= 12 && new TextEncoder().encode(password).length <= 72
  );
}
export function validOtp(token: string): boolean {
  return /^[0-9]{6,10}$/.test(token);
}
