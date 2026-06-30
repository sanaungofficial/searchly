import { describe, expect, it } from "vitest";
import {
  buildContactNotesFromRow,
  buildContactsFromMapping,
  buildContactsImportPreview,
  parseContactsSheetFromText,
  suggestContactsMappings,
  validateContactsMapping,
} from "./contact-field-mapping";

describe("contact-field-mapping", () => {
  const sampleTsv = `Company\tContact Name\tEmail\tContacted?\tNotes\tDate\tLinkedIn connections\tGmail
Oak Street Health\tEmily Moe\temily.moe@oakstreethealth.com\tYes\thttps://linkedin.com/in/emily-moe\t04/05/2026\tConnection sent\tEmail sent
Autodesk\tNirav Shah\tnirav@autodesk.com\tNo\thttps://linkedin.com/in/nirav-shah\t03/28/2026\t\t
ZoomInfo\tAlex Lee\talex@zoominfo.com\tYes\t\t04/01/2026\tPending\t`;

  const headers = [
    "Company",
    "Contact Name",
    "Email",
    "Contacted?",
    "Notes",
    "Date",
    "LinkedIn connections",
    "Gmail",
  ];

  it("suggests core contact columns from headers", () => {
    const map = suggestContactsMappings(headers);
    expect(map.get(0)).toBe("company");
    expect(map.get(1)).toBe("name");
    expect(map.get(2)).toBe("email");
    expect(map.get(3)).toBe("contacted");
    expect(map.get(4)).toBe("notes");
    expect(map.get(6)).toBeUndefined();
  });

  it("parses pasted rows into sheet preview", () => {
    const preview = parseContactsSheetFromText(sampleTsv, "paste.txt");
    expect(preview.columns.some((c) => c.destination === "email")).toBe(true);
    expect(preview.dataRowCount).toBe(3);
  });

  it("buildContactNotesFromRow folds outreach columns", () => {
    const row = [
      "Oak Street Health",
      "Emily Moe",
      "emily.moe@oakstreethealth.com",
      "Yes",
      "https://linkedin.com/in/emily-moe",
      "04/05/2026",
      "Connection sent",
      "Email sent",
    ];
    const mappedCols = {
      email: 2,
      name: 1,
      company: 0,
      linkedinUrl: -1,
      contacted: 3,
      notes: 4,
    };
    const notes = buildContactNotesFromRow(row, headers, mappedCols);
    expect(notes).toContain("Date: 04/05/2026");
    expect(notes).toContain("LinkedIn Connections: Connection sent");
    expect(notes).toContain("Gmail: Email sent");
  });

  it("builds contacts with linkedin from notes and contacted flag", () => {
    const preview = parseContactsSheetFromText(sampleTsv, "paste.txt");
    const contacts = buildContactsFromMapping(preview, preview.columns);
    expect(contacts).toHaveLength(3);

    const emily = contacts.find((c) => c.data.email === "emily.moe@oakstreethealth.com");
    expect(emily?.data.name).toBe("Emily Moe");
    expect(emily?.data.company).toBe("Oak Street Health");
    expect(emily?.data.contacted).toBe(true);
    expect(emily?.data.linkedinUrl).toContain("linkedin.com/in/emily-moe");
    expect(emily?.data.notes).toContain("Date: 04/05/2026");
    expect(emily?.data.notes).toContain("Gmail: Email sent");
  });

  it("requires email mapping", () => {
    const preview = parseContactsSheetFromText(sampleTsv, "paste.txt");
    const badCols = preview.columns.map((c) =>
      c.destination === "email" ? { ...c, destination: null } : c,
    );
    expect(validateContactsMapping(badCols)).toMatch(/Email/i);
  });

  it("buildContactsImportPreview returns mapping recommendation", () => {
    const preview = parseContactsSheetFromText(sampleTsv, "paste.txt");
    const result = buildContactsImportPreview(preview, preview.columns);
    expect(result.contacts).toHaveLength(3);
    expect(result.mappingRecommendation).toContain("Imported 3 contact(s)");
  });
});
