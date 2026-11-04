/** Limita esperas no servidor sem registrar cabeçalhos, corpo ou credenciais. */
export const authFetch: typeof fetch = (input, init) => {
  const timeout = AbortSignal.timeout(10_000);
  return fetch(input, {
    ...init,
    signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
    redirect: "error",
  });
};
