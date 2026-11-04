import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthResult } from "./validation";
type Auth = Pick<
  SupabaseClient["auth"],
  | "signInWithPassword"
  | "signInWithOtp"
  | "verifyOtp"
  | "updateUser"
  | "signOut"
>;
export async function loginWithPassword(
  auth: Auth,
  email: string,
  password: string,
): Promise<AuthResult> {
  try {
    const { data, error } = await auth.signInWithPassword({ email, password });
    if (error || !data.user || !data.session)
      return {
        error:
          "Não foi possível entrar. Confira os dados e a confirmação do e-mail. Use Primeiro acesso se necessário.",
      };
    return {};
  } catch {
    return {
      error: "Não foi possível conectar ao serviço de acesso. Tente novamente.",
    };
  }
}
export async function requestEmailCode(
  auth: Auth,
  email: string,
): Promise<AuthResult> {
  try {
    // Nunca criar conta via OTP. A identidade precisa ser provisionada pelo administrador.
    await auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    // Resposta uniforme: não revelar se um e-mail pertence aos convidados.
    return {
      notice:
        "Se existe uma conta preparada para este e-mail, o código será enviado. Confira a caixa de entrada e o spam. Aguarde antes de solicitar outro.",
    };
  } catch {
    return {
      error: "Não foi possível conectar ao serviço de acesso. Tente novamente.",
    };
  }
}
export async function verifyEmailAndSetPassword(
  auth: Auth,
  email: string,
  token: string,
  password: string,
): Promise<AuthResult> {
  try {
    const verified = await auth.verifyOtp({ email, token, type: "email" });
    if (
      verified.error ||
      !verified.data.session ||
      !verified.data.user?.email_confirmed_at ||
      verified.data.user.email?.toLowerCase() !== email
    )
      return {
        error:
          "Código inválido ou expirado. Confira o e-mail e solicite outro código se necessário.",
      };
    const updated = await auth.updateUser({ password });
    if (updated.error) {
      await auth.signOut({ scope: "local" });
      return {
        error:
          "Não foi possível definir a senha. Solicite outro código e tente novamente.",
      };
    }
    return {};
  } catch {
    return {
      error:
        "Não foi possível concluir a verificação. Solicite outro código e tente novamente.",
    };
  }
}
