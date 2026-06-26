import { InboxActivityDirection } from "@prisma/client";
import type { NylasMessage } from "@/lib/nylas-inbox";

function normalizeEmail(email: string | null | undefined): string | null {
  return email?.trim().toLowerCase() ?? null;
}

function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeEmail(a);
  const nb = normalizeEmail(b);
  return Boolean(na && nb && na === nb);
}

export function messageDirection(
  message: NylasMessage,
  userEmail: string | null | undefined,
): InboxActivityDirection {
  const user = normalizeEmail(userEmail);
  const fromEmail = normalizeEmail(message.from?.[0]?.email);

  if (user && fromEmail === user) return InboxActivityDirection.OUTBOUND;

  if (user && message.to?.some((p) => emailsMatch(p.email, user)) && fromEmail !== user) {
    return InboxActivityDirection.INBOUND;
  }

  if (user && message.from?.every((p) => !emailsMatch(p.email, user)) && message.to?.some((p) => emailsMatch(p.email, user))) {
    return InboxActivityDirection.INBOUND;
  }

  return fromEmail && user && fromEmail !== user ? InboxActivityDirection.INBOUND : InboxActivityDirection.OUTBOUND;
}
