export function isPkceVerifierError(error: { message?: string; code?: string | number }) {
  const msg = (error.message ?? "").toLowerCase();
  const code = String(error.code ?? "").toLowerCase();
  return (
    msg.includes("code verifier") ||
    msg.includes("pkce") ||
    code.includes("pkce")
  );
}

export const PKCE_FRIENDLY_MESSAGE =
  "This link must be opened in the same browser where you started sign-in. If you signed up with email and password, go to Sign in and use your password instead.";

export function friendlyAuthMessage(message: string) {
  if (isPkceVerifierError({ message })) return PKCE_FRIENDLY_MESSAGE;
  return message;
}
