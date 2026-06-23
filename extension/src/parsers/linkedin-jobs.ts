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
  ".artdeco-entity-lockup__subtitle",
  ".job-card-container__company-name",
  ".job-card-container__primary-description",
];

const DESCRIPTION_SELECTORS = [
  ".jobs-description-content__text--stretch",
  ".jobs-description-content__text",
  ".jobs-description__content",
  ".jobs-box__html-content",
  "#job-details",
  ".jobs-description__container",
  "article.jobs-description__container",
];

const LOCATION_SELECTORS = [
  ".job-details-jobs-unified-top-card__bullet",
  ".jobs-unified-top-card__bullet",
  ".job-details-jobs-unified-top-card__primary-description",
  ".job-card-container__metadata-item",
  ".job-details-jobs-unified-top-card__job-insight",
];

const SALARY_SELECTORS = [
  ".job-details-jobs-unified-top-card__salary-info",
  ".jobs-unified-top-card__job-insight",
  ".mt1.t-black--light",
];

const SHOW_MORE_SELECTORS = [
  'button[aria-label*="Show more" i]',
  'button[aria-label*="see more" i]',
  ".jobs-description__footer-button",
  ".inline-show-more-text__button",
  ".show-more-less-html__button",
  ".feed-shared-inline-show-more-text__see-more-less-toggle",
];

function linkedInDetailRoot(): ParentNode {
  for (const selector of DETAIL_ROOT_SELECTORS) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  return document;
}

function linkedInActiveCard(): Element | null {
  return document.querySelector(
    ".jobs-search-results__list-item--active, .scaffold-layout__list-item--active, .job-card-container--active"
  );
}

function expandLinkedInShowMore(root: ParentNode = document): void {
  for (const selector of SHOW_MORE_SELECTORS) {
    root.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
      try {
        button.click();
      } catch {
        // ignore click failures
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

/** Expand collapsed sections and wait for lazy-loaded description before parsing. */
export async function prepareLinkedInPage(): Promise<void> {
  if (!/linkedin\.com/i.test(window.location.hostname)) return;
  expandLinkedInShowMore();
  expandLinkedInShowMore(linkedInDetailRoot());
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
    if (paragraphs.length) {
      return paragraphs.join("\n\n").slice(0, 12000);
    }
  }

  const aboutHeader = Array.from(root.querySelectorAll("h2, h3")).find((h) =>
    /about the job|job description/i.test(text(h))
  );
  if (aboutHeader) {
    const section = aboutHeader.closest("section") ?? aboutHeader.parentElement;
    if (section) {
      const sectionText = text(section);
      if (sectionText.length > 40) return sectionText.slice(0, 12000);
    }
  }

  return "";
}

function readLinkedInInsights(root: ParentNode): { salary?: string; jobType?: string } {
  const insightText = queryAllText(SALARY_SELECTORS, root);
  const salary = insightText.match(/\$[\d,.]+(?:\s*[-–—]\s*\$[\d,.]+)?(?:\s*\/?\s*(?:yr|year|hr|hour))?/i)?.[0];
  const jobType = insightText.match(/\b(Full-time|Part-time|Contract|Temporary|Internship|Remote|Hybrid|On-site)\b/i)?.[0];
  return { salary, jobType };
}

export function parseLinkedInJobs(): ParsedJob | null {
  const rawUrl = window.location.href.split("#")[0];
  if (!/linkedin\.com/i.test(window.location.hostname) || !/\/jobs\//i.test(rawUrl)) {
    return null;
  }

  const url = normalizeLinkedInJobUrl(rawUrl);
  const detailRoot = linkedInDetailRoot();
  const activeCard = linkedInActiveCard();

  const role = firstNonEmpty(
    queryAllText(ROLE_SELECTORS, detailRoot),
    activeCard ? queryAllText(ROLE_SELECTORS, activeCard) : "",
    queryAllText(ROLE_SELECTORS)
  );

  const company = firstNonEmpty(
    queryAllText(COMPANY_SELECTORS, detailRoot),
    activeCard ? queryAllText(COMPANY_SELECTORS, activeCard) : "",
    queryAllText(COMPANY_SELECTORS)
  );

  const location = firstNonEmpty(
    queryAllText(LOCATION_SELECTORS, detailRoot),
    activeCard ? queryAllText(LOCATION_SELECTORS, activeCard) : ""
  );

  const description = firstNonEmpty(
    extractLinkedInDescription(detailRoot),
    extractLinkedInDescription(document)
  );

  const { salary, jobType } = readLinkedInInsights(detailRoot);

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
      ...(salary ? { salary } : {}),
      ...(jobType ? { jobType } : {}),
      rawUrl: rawUrl !== url ? rawUrl : undefined,
    }),
  };

  logParse("linkedin-jobs", result);
  return result;
}
