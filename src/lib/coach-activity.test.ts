import { describe, expect, it } from "vitest";
import { dedupeCoachCommunications, coachActivityKind } from "@/lib/coach-activity";
import type { HubCommunication } from "@/lib/coach-hub";

function comm(partial: Partial<HubCommunication> & Pick<HubCommunication, "id" | "type" | "createdAt">): HubCommunication {
  return {
    audience: "GUEST",
    recipientEmail: "guest@example.com",
    subject: "Test",
    bodyPreview: null,
    bookingId: null,
    clientName: null,
    clientEmail: null,
    coachName: "Coach",
    ...partial,
  };
}

describe("coachActivityKind", () => {
  it("maps confirmation and synthetic booked to the same kind", () => {
    expect(coachActivityKind("GUEST_CONFIRMATION")).toBe("booked");
    expect(coachActivityKind("SESSION_BOOKED")).toBe("booked");
  });
});

describe("dedupeCoachCommunications", () => {
  it("keeps one row per booking lifecycle event", () => {
    const rows = dedupeCoachCommunications([
      comm({
        id: "stored",
        type: "GUEST_CONFIRMATION",
        bookingId: "b1",
        createdAt: "2026-06-20T12:00:00.000Z",
      }),
      comm({
        id: "synthetic",
        type: "SESSION_BOOKED",
        bookingId: "b1",
        createdAt: "2026-06-20T11:00:00.000Z",
      }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("stored");
  });

  it("keeps distinct lifecycle events for the same booking", () => {
    const rows = dedupeCoachCommunications([
      comm({
        id: "booked",
        type: "GUEST_CONFIRMATION",
        bookingId: "b1",
        createdAt: "2026-06-20T12:00:00.000Z",
      }),
      comm({
        id: "cancelled",
        type: "CANCELLATION",
        bookingId: "b1",
        createdAt: "2026-06-21T12:00:00.000Z",
      }),
    ]);

    expect(rows).toHaveLength(2);
  });
});
