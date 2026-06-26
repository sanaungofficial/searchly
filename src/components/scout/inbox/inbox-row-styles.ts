const LAST_OPENED_KEY = "kimchi:inbox:last-opened";

export function readLastOpenedMessageId(accountEmail?: string | null): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(accountKey(accountEmail));
    return raw?.trim() || null;
  } catch {
    return null;
  }
}

export function writeLastOpenedMessageId(messageId: string, accountEmail?: string | null) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(accountKey(accountEmail), messageId);
  } catch {
    /* ignore */
  }
}

function accountKey(email?: string | null) {
  return email ? `${LAST_OPENED_KEY}:${email}` : LAST_OPENED_KEY;
}

export type InboxRowVisualState = {
  expanded: boolean;
  hovered: boolean;
  isLastOpened: boolean;
  isFocusUnread: boolean;
  unread: boolean;
};

export function inboxRowStyle(state: InboxRowVisualState): {
  background: string;
  boxShadow: string;
  transition: string;
} {
  if (state.expanded) {
    return {
      background: "#FFFFFF",
      boxShadow: "inset 3px 0 0 #1C3A2F",
      transition: "background 0.14s ease, box-shadow 0.14s ease",
    };
  }
  if (state.hovered) {
    return {
      background: "rgba(26, 58, 47, 0.06)",
      boxShadow: "inset 3px 0 0 rgba(26, 58, 47, 0.18)",
      transition: "background 0.14s ease, box-shadow 0.14s ease",
    };
  }
  if (state.isLastOpened) {
    return {
      background: "rgba(59, 130, 246, 0.07)",
      boxShadow: "inset 3px 0 0 rgba(59, 130, 246, 0.55)",
      transition: "background 0.14s ease, box-shadow 0.14s ease",
    };
  }
  if (state.isFocusUnread) {
    return {
      background: "rgba(42, 107, 74, 0.07)",
      boxShadow: "inset 3px 0 0 rgba(42, 107, 74, 0.4)",
      transition: "background 0.14s ease, box-shadow 0.14s ease",
    };
  }
  if (state.unread) {
    return {
      background: "rgba(255, 255, 255, 0.95)",
      boxShadow: "inset 3px 0 0 transparent",
      transition: "background 0.14s ease, box-shadow 0.14s ease",
    };
  }
  return {
    background: "transparent",
    boxShadow: "inset 3px 0 0 transparent",
    transition: "background 0.14s ease, box-shadow 0.14s ease",
  };
}
