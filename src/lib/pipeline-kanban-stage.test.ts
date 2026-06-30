import { describe, expect, it } from "vitest";
import { DB_TO_KANBAN, dbStageToKanban, resolveDbJobKanbanStage } from "./pipeline-kanban-stage";

describe("pipeline kanban stage mapping", () => {
  it("maps only SAVED to the Saved tab (pre-application bucket)", () => {
    expect(DB_TO_KANBAN.SAVED).toBe("saved");
    expect(DB_TO_KANBAN.APPLYING).toBe("applied");
    expect(DB_TO_KANBAN.APPLIED).toBe("applied");
    expect(DB_TO_KANBAN.SCREENING).toBe("applied");
    expect(DB_TO_KANBAN.INTERVIEWING).toBe("interview");
    expect(DB_TO_KANBAN.OFFER).toBe("offer");
    expect(DB_TO_KANBAN.REJECTED).toBe("closed");
    expect(DB_TO_KANBAN.WITHDRAWN).toBe("closed");
  });

  it("defaults unknown DB stages to saved", () => {
    expect(dbStageToKanban("UNKNOWN")).toBe("saved");
  });

  it("promotes SAVED rows with appliedAt to the Applied tab", () => {
    expect(resolveDbJobKanbanStage("SAVED", null)).toBe("saved");
    expect(resolveDbJobKanbanStage("SAVED", "2024-06-01")).toBe("applied");
    expect(resolveDbJobKanbanStage("APPLIED", "2024-06-01")).toBe("applied");
  });
});
