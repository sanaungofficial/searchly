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
