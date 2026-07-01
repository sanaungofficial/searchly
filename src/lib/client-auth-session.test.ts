import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const signOut = vi.fn();

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser, signOut },
  }),
}));

describe("hasValidClientSession", () => {
  beforeEach(() => {
    getUser.mockReset();
    signOut.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns false when Supabase has no user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { hasValidClientSession } = await import("@/lib/client-auth-session");
    await expect(hasValidClientSession()).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns true when profile API accepts the session", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    const { hasValidClientSession } = await import("@/lib/client-auth-session");
    await expect(hasValidClientSession()).resolves.toBe(true);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("signs out and returns false when profile API rejects a stale session", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 401 } as Response);
    signOut.mockResolvedValue({});
    const { hasValidClientSession } = await import("@/lib/client-auth-session");
    await expect(hasValidClientSession()).resolves.toBe(false);
    expect(signOut).toHaveBeenCalled();
  });
});
