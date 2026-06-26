export class ExecThreadAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecThreadAuthError";
  }
}

export class ExecThreadSessionExpiredError extends Error {
  readonly code = "SESSION_EXPIRED";

  constructor(message = "ExecThread session expired. Re-authenticate with email and password.") {
    super(message);
    this.name = "ExecThreadSessionExpiredError";
  }
}

/** Redeem failures we can ignore — listing was already unlocked or sync can continue. */
export function isExecThreadBenignRedeemError(error: unknown): boolean {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === "object" && error && "error" in error
          ? String((error as { error?: unknown }).error ?? "")
          : "";

  const normalized = message.toLowerCase();
  return (
    normalized.includes("redeem-error-exists") ||
    normalized.includes("already redeemed") ||
    normalized.includes("already redeemed this job")
  );
}

export class ExecThreadRedeemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecThreadRedeemError";
  }
}

export function parseExecThreadAuthError(body: string, status: number): ExecThreadAuthError {
  let message = body;
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string };
    message = parsed.message ?? parsed.error ?? body;
  } catch {
    // keep raw body
  }
  if (status === 401) {
    return new ExecThreadAuthError(message || "Invalid ExecThread credentials.");
  }
  return new ExecThreadAuthError(message || `ExecThread auth failed (${status})`);
}
