"use server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { invitationHash, validInvitationToken } from "@/lib/invitations/token";
import {
  readEmail,
  validNewPassword,
  validOtp,
  type AuthResult,
} from "@/lib/auth/validation";
import { requestEmailCode, verifyEmailAndSetPassword } from "@/lib/auth/flows";
async function validTarget(token: string, email: string) {
  const root = createAdminClient();
  const { data, error } = await root.rpc("menchat_invite_valid", {
    p_hash: invitationHash(token),
    p_email: email,
  });
  return !error && data === true;
}
export async function requestInviteCode(
  _state: AuthResult,
  form: FormData,
): Promise<AuthResult> {
  const token = form.get("invite");
  const email = readEmail(form.get("email"));
  if (!validInvitationToken(token) || !email)
    return { error: "Abra o link original do convite e informe seu e-mail." };
  try {
    if (await validTarget(token, email)) {
      const client = await createClient();
      const result = await requestEmailCode(client.auth, email);
      if (result.error) return result;
    }
    return {
      notice:
        "Se este convite está disponível para o e-mail informado, você receberá um código. Confira a caixa de entrada e o spam.",
    };
  } catch {
    return {
      error: "O serviço de convites está indisponível. Avise o administrador.",
    };
  }
}
export async function acceptInvitation(
  _state: AuthResult,
  form: FormData,
): Promise<AuthResult> {
  const token = form.get("invite"),
    email = readEmail(form.get("email")),
    otp = form.get("otp"),
    password = form.get("password"),
    name = form.get("name");
  if (
    !validInvitationToken(token) ||
    !email ||
    typeof otp !== "string" ||
    !validOtp(otp.trim())
  )
    return { error: "Confira o link original, o e-mail e o código recebido." };
  if (
    typeof name !== "string" ||
    name.trim().length < 2 ||
    name.trim().length > 50
  )
    return { error: "Informe seu nome, de 2 a 50 caracteres." };
  if (
    typeof password !== "string" ||
    !validNewPassword(password) ||
    password !== form.get("confirm")
  )
    return {
      error:
        "Use uma senha de pelo menos 12 caracteres e confirme a mesma senha. Se for muito longa, reduza-a.",
    };
  try {
    if (!(await validTarget(token, email)))
      return {
        error:
          "Convite indisponível para este e-mail. Ele pode ter expirado, sido revogado ou utilizado. Peça outro ao administrador.",
      };
    const client = await createClient();
    const verified = await verifyEmailAndSetPassword(
      client.auth,
      email,
      otp.trim(),
      password,
    );
    if (verified.error) return verified;
    const result = await client.rpc("menchat_accept_invite", {
      p_token: token,
      p_name: name.trim(),
    });
    if (result.error || !result.data)
      return {
        error:
          "Não foi possível ativar a conta. O convite pode ter sido usado/revogado durante a verificação ou o limite de contas foi atingido. Peça um novo convite.",
      };
  } catch {
    return {
      error:
        "Não foi possível concluir o convite. Tente novamente ou fale com o administrador.",
    };
  }
  redirect("/conta/chat");
}
