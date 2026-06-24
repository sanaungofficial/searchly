import type { ParsedJob } from "../lib/types";
import {
  buildNotes,
  detectStage,
  firstNonEmpty,
  logParse,
  normalizeLinkedInJobUrl,
  parseTitleHeuristic,
  queryAllText,
  readJsonLdJobPosting,
  readOpenGraph,
  text,
} from "./utils";

const DETAIL_ROOT_SELECTORS = [
  ".jobs-search__job-details",
  ".jobs-search__job-details--container",
  ".scaffold-layout__detail",
  ".jobs-details",
  ".jobs-details__main-content",
  ".jobs-details__main-content .jobs-box--fadein",
  ".top-card-layout",
  ".core-section-container.description",
];

const ROLE_SELECTORS = [
  ".job-details-jobs-unified-top-card__job-title",
  ".jobs-unified-top-card__job-title",
  ".job-details-jobs-unified-top-card__job-title h1",
  ".job-details-jobs-unified-top-card__job-title a",
  ".jobs-unified-top-card__job-title-link",
  ".t-24.job-details-jobs-unified-top-card__job-title",
  "h1.t-24",
  "h2.t-24",
  ".top-card-layout__title",
  "h1.top-card-layout__title",
  ".jobs-search__job-details h1",
  ".scaffold-layout__detail h1",
  "[class*='job-details'] h1",
  ".job-card-list__title",
  ".job-card-container__link",
];

const COMPANY_SELECTORS = [
  ".job-details-jobs-unified-top-card__company-name a",
  ".job-details-jobs-unified-top-card__company-name",
  ".jobs-unified-top-card__company-name a",
  ".jobs-unified-top-card__company-name",
  ".job-details-jobs-unified-top-card__primary-description a",
  ".job-details-jobs-unified-top-card__primary-description",
  ".top-card-layout__second-subline a",
  ".top-card-layout__second-subline",
  ".jobs-search__job-details a[href*='/company/']",
  ".scaffold-layout__detail a[href*='/company/']",
  ".artdeco-entity-lockup__subtitle",
  ".job-card-container__company-name",
  ".job-card-container__primary-description",
];

const DESCRIPTION_SELECTORS = [
  ".jobs-description-content__text--stretch",
  ".jobs-description-content__text",
  ".jobs-description__content",
  ".description__text--rich",
  ".description__text",
  ".jobs-box__html-content",
  "#job-details",
  ".jobs-description__container",
  "article.jobs-description__container",
];

const LOCATION_SELECTORS = [
  ".job-details-jobs-unified-top-card__bullet",
  ".jobs-unified-top-card__bullet",
  ".job-card-container__metadata-item",
];

const SHOW_MORE_SELECTORS = [
  'button[aria-label*="Show more" i]',
  'button[aria-label*="see more" i]',
  ".jobs-description__footer-button",
  ".inline-show-more-text__button",
  ".show-more-less-html__button",
];

function linkedInDetailRoot(): ParentNode {
  for (const selector of DETAIL_ROOT_SELECTORS) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  return document;
}

function linkedInActiveCard(): Element | null {
  return (
    document.querySelector(
      ".jobs-search-results__list-item--active, .scaffold-layout__list-item--active, .job-card-container--active, .jobs-search-results-list__list-item--active"
    ) ??
    document.querySelector(`[data-job-id="${new URL(window.location.href).searchParams.get("currentJobId") ?? ""}"]`) ??
    null
  );
}

function unescapeLinkedInJson(value: string): string {
  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function readLinkedInEmbeddedJob(): {
  role?: string;
  company?: string;
  description?: string;
} | null {
  const html = document.documentElement.innerHTML;
  const role =
    html.match(/"jobPostingTitle"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1] ??
    html.match(/"jobPostingTitle"\s*:\s*\{\s*"text"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1];
  const company =
    html.match(/"companyName"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1] ??
    html.match(/"companyDetails"\s*:\s*\{[^}]*"name"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1];

  if (!role && !company) return null;

  return {
    ...(role ? { role: unescapeLinkedInJson(role) } : {}),
    ...(company ? { company: unescapeLinkedInJson(company) } : {}),
  };
}

function readFromActiveListCard(): { role?: string; company?: string } {
  const card = linkedInActiveCard();
  if (!card) return {};

  const titleLink = card.querySelector<HTMLAnchorElement>("a[href*='/jobs/view/']");
  const companyLink = card.querySelector<HTMLAnchorElement>("a[href*='/company/']");
  const aria = card.getAttribute("aria-label")?.trim() ?? "";

  return {
    role: firstNonEmpty(text(titleLink), aria.split("\n")[0]?.trim()),
    company: text(companyLink),
  };
}

async function waitForLinkedInJobHeader(timeoutMs = 3500): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const embedded = readLinkedInEmbeddedJob();
    const card = readFromActiveListCard();
    const role = firstNonEmpty(
      queryAllText(ROLE_SELECTORS, linkedInDetailRoot()),
      card.role,
      embedded?.role
    );
    if (role && role !== "Unknown Role") return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

function expandLinkedInShowMore(root: ParentNode = document): void {
  for (const selector of SHOW_MORE_SELECTORS) {
    root.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
      try {
        button.click();
      } catch {
        // ignore
      }
    });
  }
}

async function waitForLinkedInDescription(timeoutMs = 2500): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (extractLinkedInDescription(document).length > 40) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

export async function prepareLinkedInPage(): Promise<void> {
  if (!/linkedin\.com/i.test(window.location.hostname)) return;
  expandLinkedInShowMore();
  expandLinkedInShowMore(linkedInDetailRoot());
  await waitForLinkedInJobHeader();
  await waitForLinkedInDescription();
}

function extractLinkedInDescription(root: ParentNode): string {
  for (const selector of DESCRIPTION_SELECTORS) {
    const el = root.querySelector(selector);
    if (!el) continue;
    const value = text(el);
    if (value.length > 40) return value.slice(0, 12000);
    const paragraphs = Array.from(el.querySelectorAll("p, li"))
      .map((node) => text(node))
      .filter((part) => part.length > 15);
    if (paragraphs.length) return paragraphs.join("\n\n").slice(0, 12000);
  }
  return "";
}

export function parseLinkedInJobs(): ParsedJob | null {
  const rawUrl = window.location.href.split("#")[0];
  if (!/linkedin\.com/i.test(window.location.hostname) || !/\/jobs\//i.test(rawUrl)) {
    return null;
  }

  const url = normalizeLinkedInJobUrl(rawUrl);
  const detailRoot = linkedInDetailRoot();
  const activeCard = linkedInActiveCard();
  const embedded = readLinkedInEmbeddedJob();
  const listCard = readFromActiveListCard();

  const role = firstNonEmpty(
    queryAllText(ROLE_SELECTORS, detailRoot),
    activeCard ? queryAllText(ROLE_SELECTORS, activeCard) : "",
    queryAllText(ROLE_SELECTORS),
    listCard.role,
    embedded?.role
  );

  const company = firstNonEmpty(
    queryAllText(COMPANY_SELECTORS, detailRoot),
    activeCard ? queryAllText(COMPANY_SELECTORS, activeCard) : "",
    queryAllText(COMPANY_SELECTORS),
    listCard.company,
    embedded?.company
  );

  const location = firstNonEmpty(
    queryAllText(LOCATION_SELECTORS, detailRoot),
    activeCard ? queryAllText(LOCATION_SELECTORS, activeCard) : ""
  );

  const description = firstNonEmpty(
    extractLinkedInDescription(detailRoot),
    extractLinkedInDescription(document)
  );

  const jsonLd = readJsonLdJobPosting();
  const og = readOpenGraph();
  const titleFallback = parseTitleHeuristic(document.title);

  const resolvedRole = firstNonEmpty(role, jsonLd?.title, og.title, titleFallback.role) || "Unknown Role";
  const resolvedCompany =
    firstNonEmpty(company, jsonLd?.company, titleFallback.company) || "Unknown Company";
  const resolvedDescription = firstNonEmpty(description, jsonLd?.description);

  const result: ParsedJob = {
    company: resolvedCompany,
    role: resolvedRole,
    url,
    stage: detectStage(url),
    parser: "linkedin-jobs",
    notes: buildNotes("linkedin-jobs", {
      ...(resolvedDescription ? { description: resolvedDescription } : {}),
      ...(location ? { location } : {}),
      rawUrl: rawUrl !== url ? rawUrl : undefined,
    }),
  };

  logParse("linkedin-jobs", result);
  return result;
}

export function getDescriptionFromParsed(parsed: ParsedJob): string {
  try {
    const notes = JSON.parse(parsed.notes) as { description?: string };
    return notes.description?.trim() ?? "";
  } catch {
    return "";
  }
}
