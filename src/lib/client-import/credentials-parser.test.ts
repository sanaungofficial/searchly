import { describe, expect, it } from "vitest";
import {
  formatCredentialAnswer,
  parseCredentialsFromText,
  parseCredentialsFromSheetRows,
  dedupeCredentials,
} from "./credentials-parser";

describe("credentials-parser", () => {
  it("formats login and password", () => {
    expect(formatCredentialAnswer("user@x.com", "secret")).toBe("Login: user@x.com\nPassword: secret");
    expect(formatCredentialAnswer(null, "secret")).toBe("Password: secret");
  });

  it("parses tab-separated site login password", () => {
    const rows = parseCredentialsFromText("LinkedIn\tuser@email.com\tpass123");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.data.question).toBe("LinkedIn");
    expect(rows[0]?.data.answer).toContain("Login: user@email.com");
    expect(rows[0]?.data.tags).toContain("passwords");
  });

  it("parses site: login / password", () => {
    const rows = parseCredentialsFromText("Greenhouse: jane@co.com / hunter2");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.data.answer).toContain("hunter2");
  });

  it("parses sheet rows with headers", () => {
    const rows = parseCredentialsFromSheetRows(
      [
        ["Site", "Login", "Password"],
        ["Workday", "jane", "abc"],
      ],
      "Passwords",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.data.question).toBe("Workday");
  });

  it("dedupes by site name", () => {
    const a = parseCredentialsFromText("Greenhouse\tpass1");
    const b = parseCredentialsFromText("Greenhouse\tpass2");
    const merged = dedupeCredentials([...a, ...b]);
    expect(merged).toHaveLength(1);
  });
});
