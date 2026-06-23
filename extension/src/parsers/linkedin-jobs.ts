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
  ".artdeco-entity-lockup__subtitle",
  ".job-card-container__company-name",
  ".job-card-container__primary-description",
];

const DESCRIPTION_SELECTORS = [
  ".jobs-description__content",
  ".jobs-description-content__text",
  ".jobs-box__html-content",
  "#job-details",
  ".jobs-description__container",
];

const LOCATION_SELECTORS = [
  ".job-details-jobs-unified-top-card__bullet",
  ".jobs-unified-top-card__bullet",
  ".job-card-container__metadata-item",
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

function extractLinkedInDescription(root: ParentNode): string {
  for (const selector of DESCRIPTION_SELECTORS) {
    const el = root.querySelector(selector);
    const value = text(el);
    if (value.length > 40) return value.slice(0, 12000);
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

  const jsonLd = readJsonLdJobPosting();
  const og = readOpenGraph();
  const titleFallback = parseTitleHeuristic(document.title);

  const resolvedRole = firstNonEmpty(role, jsonLd?.title, og.title, titleFallback.role) || "Unknown Role";
  const resolvedCompany =
    firstNonEmpty(company, jsonLd?.company, titleFallback.company) || "Unknown Company";

  const result: ParsedJob = {
    company: resolvedCompany,
    role: resolvedRole,
    url,
    stage: detectStage(url),
    parser: "linkedin-jobs",
    notes: buildNotes("linkedin-jobs", {
      ...(description ? { description } : jsonLd?.description ? { description: jsonLd.description } : {}),
      ...(location ? { location } : {}),
      rawUrl: rawUrl !== url ? rawUrl : undefined,
    }),
  };

  logParse("linkedin-jobs", result);
  return result;
}
