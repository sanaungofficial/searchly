import { describe, expect, it } from "vitest";
import { CoachStatus } from "@prisma/client";
import { activeCoachListWhere } from "@/lib/coach-list-query";

describe("activeCoachListWhere", () => {
  it("returns ACTIVE-only public directory filter by default", () => {
    expect(activeCoachListWhere()).toEqual({
      status: CoachStatus.ACTIVE,
      isInternal: false,
    });
  });

  it("excludes a user id while keeping unlinked coach profiles", () => {
    expect(activeCoachListWhere("user_123")).toEqual({
      status: CoachStatus.ACTIVE,
      isInternal: false,
      OR: [{ userId: null }, { userId: { not: "user_123" } }],
    });
  });

  it("can include internal coaches for signed-in client views", () => {
    expect(activeCoachListWhere(undefined, { includeInternal: true })).toEqual({
      status: CoachStatus.ACTIVE,
    });
  });
});
