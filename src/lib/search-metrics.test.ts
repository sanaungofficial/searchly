import { describe, expect, it } from "vitest";
import {
  aggregateJobSearchMetrics,
  aggregateRelationshipMetrics,
} from "./search-metrics";

describe("search-metrics", () => {
  const now = new Date("2026-07-01T12:00:00.000Z");

  it("counts active pipeline and funnel stages", () => {
    const metrics = aggregateJobSearchMetrics(
      [
        { stage: "SAVED", appliedAt: null, createdAt: now },
        { stage: "APPLIED", appliedAt: new Date("2026-06-20"), createdAt: now },
        { stage: "INTERVIEWING", appliedAt: new Date("2026-06-10"), createdAt: now },
        { stage: "OFFER", appliedAt: new Date("2026-05-01"), createdAt: now },
        { stage: "REJECTED", appliedAt: new Date("2026-04-01"), createdAt: now },
      ],
      now,
    );

    expect(metrics.activePipeline).toBe(4);
    expect(metrics.interviewing).toBe(1);
    expect(metrics.offers).toBe(1);
    expect(metrics.funnel).toEqual({
      saved: 1,
      applied: 1,
      interview: 1,
      offer: 1,
    });
  });

  it("counts applied lifetime, this week, and last 7d", () => {
    const metrics = aggregateJobSearchMetrics(
      [
        { stage: "APPLIED", appliedAt: new Date("2026-06-30T10:00:00.000Z"), createdAt: now },
        { stage: "APPLIED", appliedAt: new Date("2026-06-28T10:00:00.000Z"), createdAt: now },
        { stage: "APPLIED", appliedAt: new Date("2026-06-01T10:00:00.000Z"), createdAt: now },
        { stage: "SAVED", appliedAt: null, createdAt: now },
      ],
      now,
    );

    expect(metrics.appliedLifetime).toBe(3);
    expect(metrics.appliedThisWeek).toBe(2);
    expect(metrics.appliedLast7d).toBe(2);
  });

  it("promotes saved rows with appliedAt into applied funnel bucket", () => {
    const metrics = aggregateJobSearchMetrics(
      [{ stage: "SAVED", appliedAt: new Date("2026-06-01"), createdAt: now }],
      now,
    );
    expect(metrics.funnel.saved).toBe(0);
    expect(metrics.funnel.applied).toBe(1);
  });

  it("aggregates relationship counts with legacy status mapping", () => {
    const metrics = aggregateRelationshipMetrics(
      [
        { status: "new", statusUpdatedAt: new Date("2026-06-29") },
        { status: "outreach", statusUpdatedAt: new Date("2026-06-20") },
        { status: "replied", statusUpdatedAt: null },
        { status: "meeting", statusUpdatedAt: new Date("2026-06-30") },
        { status: "not_interested", statusUpdatedAt: null },
      ],
      now,
    );

    expect(metrics.new).toBe(1);
    expect(metrics.inConversation).toBe(2);
    expect(metrics.meetingScheduled).toBe(1);
    expect(metrics.archived).toBe(1);
    expect(metrics.statusUpdatesLast7d).toBe(2);
  });
});
