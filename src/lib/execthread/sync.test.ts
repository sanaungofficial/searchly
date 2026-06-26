import { describe, expect, it } from "vitest";
import { searchRowFromStoredExecThreadJob } from "./sync";

describe("searchRowFromStoredExecThreadJob", () => {
  it("uses slug from networkId when raw is sparse", () => {
    expect(
      searchRowFromStoredExecThreadJob({
        externalId: "abc123",
        networkId: "head-of-strategy-sf",
        raw: { _id: "abc123", title: "VP Strategy" },
      }),
    ).toEqual({
      _id: "abc123",
      title: "VP Strategy",
      slug: "head-of-strategy-sf",
    });
  });

  it("returns null without an external id", () => {
    expect(
      searchRowFromStoredExecThreadJob({
        externalId: "",
        networkId: null,
        raw: {},
      }),
    ).toBeNull();
  });
});
