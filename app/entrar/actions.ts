"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  loginWithPassword,
  requestEmailCode,
  verifyEmailAndSetPassword,
} from "@/lib/auth/flows";
import {
  readEmail,
  validNewPassword,
  validOtp,
  type AuthResult,
} from "@/lib/auth/validation";

const unavailable = {
  error:
    "Não foi possível acessar o Supabase. Confira a configuração do projeto e tente novamente.",
};
export async function signIn(
  _previous: AuthResult,
  form: FormData,
): Promise<AuthResult> {
  const email = readEmail(form.get("email"));
  const password = form.get("password");
  if (
    !email ||
    typeof password !== "string" ||
    !password ||
    password.length > 256
  )
    return { error: "Informe e-mail e senha válidos." };
  let result: AuthResult;
  try {
    const client = await createClient();
    result = await loginWithPassword(client.auth, email, password);
  } catch {
    return unavailable;
  }
  if (result.error) return result;
  redirect("/conta/chat");
}
export async function sendCode(
  _previous: AuthResult,
  form: FormData,
): Promise<AuthResult> {
  const email = readEmail(form.get("email"));
  if (!email) return { error: "Informe um e-mail válido." };
  try {
    const client = await createClient();
    return await requestEmailCode(client.auth, email);
  } catch {
    return unavailable;
  }
}
export async function verifyCode(
  _previous: AuthResult,
  form: FormData,
): Promise<AuthResult> {
  const email = readEmail(form.get("email"));
  const token = form.get("token");
  const password = form.get("password");
  if (!email || typeof token !== "string" || !validOtp(token.trim()))
    return { error: "Informe o e-mail e o código numérico recebido." };
  if (typeof password !== "string" || !validNewPassword(password))
    return {
      error:
        "Use pelo menos 12 caracteres na senha. Se ela estiver muito longa, reduza-a.",
    };
  if (password !== form.get("confirm"))
    return { error: "As senhas não coincidem." };
  let result: AuthResult;
  try {
    const client = await createClient();
    result = await verifyEmailAndSetPassword(
      client.auth,
      email,
      token.trim(),
      password,
    );
  } catch {
    return unavailable;
  }
  if (result.error) return result;
  redirect("/conta");
}
export async function signOut(): Promise<void> {
  let failed = false;
  try {
    const client = await createClient();
    const jar = await cookies();
    const device = jar.get("menchat_push_id")?.value;
    if (device && /^[0-9a-f-]{36}$/i.test(device)) {
      const removal = await client.rpc("menchat_remove_push", { p_id: device });
      if (removal.error) throw new Error("Não foi possível encerrar o dispositivo.");
      jar.delete("menchat_push_id");
    }
    const { error } = await client.auth.signOut({ scope: "local" });
    failed = Boolean(error);
  } catch {
    failed = true;
  }
  redirect(failed ? "/entrar?saida=erro" : "/entrar");
}
