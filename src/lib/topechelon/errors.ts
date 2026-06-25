export class TopEchelonMfaRequiredError extends Error {
  readonly code = "MFA_REQUIRED";

  constructor(
    message = "Top Echelon login requires an email verification code.",
    readonly kind: "mfa" | "new_device" = "new_device"
  ) {
    super(message);
    this.name = "TopEchelonMfaRequiredError";
  }
}

export class TopEchelonAuthError extends Error {
  readonly code = "AUTH_FAILED";

  constructor(message: string) {
    super(message);
    this.name = "TopEchelonAuthError";
  }
}

export class TopEchelonSessionExpiredError extends Error {
  readonly code = "SESSION_EXPIRED";

  constructor(message = "Top Echelon session expired. Re-authenticate with a fresh email code.") {
    super(message);
    this.name = "TopEchelonSessionExpiredError";
  }
}

export function parseTopEchelonAuthError(body: string): TopEchelonMfaRequiredError | TopEchelonAuthError {
  let message = body;
  try {
    const parsed = JSON.parse(body) as { error?: string; grant_type?: string; message?: string };
    message = parsed.error ?? parsed.message ?? parsed.grant_type ?? body;
  } catch {
    /* use raw body */
  }

  const lower = message.toLowerCase();
  const looksLikeMfa =
    lower.includes("verification code") ||
    lower.includes("authentication code") ||
    lower.includes("new device") ||
    lower.includes("verify your") ||
    lower.includes("mfa") ||
    lower.includes("two-factor") ||
    lower.includes("2fa") ||
    message === "Invalid verification code" ||
    message === "Invalid Authentication Code";

  if (looksLikeMfa) {
    return new TopEchelonMfaRequiredError(
      "Enter the 6-digit code from your Top Echelon email to finish login.",
      lower.includes("new device") ? "new_device" : "mfa"
    );
  }

  return new TopEchelonAuthError(message || "Top Echelon authentication failed.");
}
