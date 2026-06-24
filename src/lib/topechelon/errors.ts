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
    const parsed = JSON.parse(body) as { error?: string; grant_type?: string };
    message = parsed.error ?? parsed.grant_type ?? body;
  } catch {
    /* use raw body */
  }

  if (
    message === "Invalid verification code" ||
    message === "Invalid Authentication Code"
  ) {
    return new TopEchelonMfaRequiredError(
      "Enter the 6-digit code from your email to finish Top Echelon login.",
      "new_device"
    );
  }

  return new TopEchelonAuthError(message || "Top Echelon authentication failed.");
}
