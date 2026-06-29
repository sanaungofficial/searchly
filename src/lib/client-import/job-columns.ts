/** Shared column header detection for job tracker sheets (xlsx + paste). */

export function normJobHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function jobColIndex(headers: unknown[], patterns: RegExp[], excludeCols: number[] = []): number {
  const excluded = new Set(excludeCols);
  for (let i = 0; i < headers.length; i++) {
    if (excluded.has(i)) continue;
    const h = normJobHeader(headers[i]);
    if (!h) continue;
    if (patterns.some((p) => p.test(h))) return i;
  }
  return -1;
}

export type JobTrackerColumns = {
  companyCol: number;
  roleCol: number;
  urlCol: number;
  statusCol: number;
  yesNoCol: number;
  notesCol: number;
  dateCol: number;
  resumeCol: number;
};

export function detectJobTrackerColumns(headers: unknown[]): JobTrackerColumns {
  const companyCol = jobColIndex(headers, [/company name/, /^company$/, /^company /, /employer/]);
  const roleCol = jobColIndex(headers, [/job title/, /^title$/, /^role$/, /position/]);
  const urlCol = jobColIndex(headers, [/^url$/, /job url/, /posting link/, /job description link/, /careers link/]);
  const yesNoCol = jobColIndex(headers, [/^yes no$/, /^yes\/no$/, /^approved$/, /coach approv/, /^apply\?/]);

  const statusCol = jobColIndex(
    headers,
    [/application status/, /app status/],
    yesNoCol >= 0 ? [yesNoCol] : [],
  );
  const fallbackStatusCol =
    statusCol >= 0
      ? statusCol
      : jobColIndex(headers, [/^status$/, /pipeline stage/, /^stage$/], yesNoCol >= 0 ? [yesNoCol] : []);

  const notesCol = jobColIndex(headers, [/^notes/, /please add notes/]);
  const dateCol = jobColIndex(headers, [/application date/, /date applied/, /applied date/]);
  const resumeCol = jobColIndex(headers, [/resume link/, /resume url/, /^resume$/]);

  return {
    companyCol,
    roleCol,
    urlCol,
    statusCol: fallbackStatusCol,
    yesNoCol,
    notesCol,
    dateCol,
    resumeCol,
  };
}
