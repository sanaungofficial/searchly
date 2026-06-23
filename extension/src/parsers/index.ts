import type { ParsedJob } from "../lib/types";
import {
  attr,
  buildNotes,
  canonicalUrl,
  companyFromUrl,
  detectStage,
  firstNonEmpty,
  logParse,
  parseTitleHeuristic,
  readJsonLdJobPosting,
  readOpenGraph,
  text,
} from "./utils";

export function parseGreenhouse(): ParsedJob | null {
  const url = canonicalUrl();
  if (!/greenhouse\.io/i.test(window.location.hostname)) return null;

  const role = firstNonEmpty(
    text(document.querySelector("h1.app-title")),
    text(document.querySelector('[data-qa="job-title"]')),
    text(document.querySelector(".job-title")),
    text(document.querySelector("h1"))
  );

  const company = firstNonEmpty(
    text(document.querySelector(".company-name")),
    text(document.querySelector('[data-qa="company-name"]')),
    attr(document.querySelector('meta[property="og:site_name"]'), "content"),
    companyFromUrl(window.location.hostname, 0)
  );

  const jsonLd = readJsonLdJobPosting();
  const og = readOpenGraph();
  const titleFallback = parseTitleHeuristic(document.title);

  const isConfirmation =
    /confirmation/i.test(url) ||
    !!document.querySelector("#application_confirmation, .application-confirmation");

  const result: ParsedJob = {
    company: firstNonEmpty(company, jsonLd?.company, og.company, titleFallback.company),
    role: firstNonEmpty(role, jsonLd?.title, og.title, titleFallback.role),
    url,
    stage: detectStage(url, isConfirmation),
    parser: "greenhouse",
    notes: buildNotes("greenhouse"),
  };

  logParse("greenhouse", result);
  return result;
}

export function parseLever(): ParsedJob | null {
  const url = canonicalUrl();
  if (!/jobs\.lever\.co/i.test(window.location.hostname)) return null;

  const role = firstNonEmpty(
    text(document.querySelector(".posting-headline h2")),
    text(document.querySelector(".posting-headline")),
    text(document.querySelector("h2")),
    text(document.querySelector("h1"))
  );

  const company = firstNonEmpty(
    text(document.querySelector(".main-header-text a")),
    text(document.querySelector(".main-header-text")),
    text(document.querySelector('[data-qa="company-name"]')),
    companyFromUrl(window.location.hostname, 0)
  );

  const jsonLd = readJsonLdJobPosting();
  const og = readOpenGraph();
  const titleFallback = parseTitleHeuristic(document.title);

  const isThankYou = /thankyou|confirmation/i.test(url);

  const result: ParsedJob = {
    company: firstNonEmpty(company, jsonLd?.company, og.company, titleFallback.company),
    role: firstNonEmpty(role, jsonLd?.title, og.title, titleFallback.role),
    url,
    stage: detectStage(url, isThankYou),
    parser: "lever",
    notes: buildNotes("lever"),
  };

  logParse("lever", result);
  return result;
}

export function parseAshby(): ParsedJob | null {
  const url = canonicalUrl();
  if (!/jobs\.ashbyhq\.com/i.test(window.location.hostname)) return null;

  const role = firstNonEmpty(
    text(document.querySelector("h1")),
    text(document.querySelector('[class*="JobTitle"]')),
    text(document.querySelector('[class*="jobTitle"]'))
  );

  const company = firstNonEmpty(
    text(document.querySelector('[class*="CompanyName"]')),
    text(document.querySelector('[class*="companyName"]')),
    text(document.querySelector("header a")),
    companyFromUrl(window.location.hostname, 0)
  );

  const jsonLd = readJsonLdJobPosting();
  const og = readOpenGraph();
  const titleFallback = parseTitleHeuristic(document.title);

  const result: ParsedJob = {
    company: firstNonEmpty(company, jsonLd?.company, og.company, titleFallback.company),
    role: firstNonEmpty(role, jsonLd?.title, og.title, titleFallback.role),
    url,
    stage: detectStage(url),
    parser: "ashby",
    notes: buildNotes("ashby"),
  };

  logParse("ashby", result);
  return result;
}

export function parseLinkedInJobs(): ParsedJob | null {
  const url = canonicalUrl();
  if (!/linkedin\.com/i.test(window.location.hostname) || !/\/jobs\//i.test(url)) {
    return null;
  }

  const role = firstNonEmpty(
    text(document.querySelector(".job-details-jobs-unified-top-card__job-title")),
    text(document.querySelector(".jobs-unified-top-card__job-title")),
    text(document.querySelector("h1.t-24")),
    text(document.querySelector("h1"))
  );

  const company = firstNonEmpty(
    text(document.querySelector(".job-details-jobs-unified-top-card__company-name a")),
    text(document.querySelector(".jobs-unified-top-card__company-name a")),
    text(document.querySelector(".job-details-jobs-unified-top-card__company-name")),
    "Unknown Company"
  );

  const jsonLd = readJsonLdJobPosting();
  const og = readOpenGraph();
  const titleFallback = parseTitleHeuristic(document.title);

  const result: ParsedJob = {
    company: firstNonEmpty(company, jsonLd?.company, og.company, titleFallback.company),
    role: firstNonEmpty(role, jsonLd?.title, og.title, titleFallback.role),
    url,
    stage: detectStage(url),
    parser: "linkedin-jobs",
    notes: buildNotes("linkedin-jobs"),
  };

  logParse("linkedin-jobs", result);
  return result;
}

export function parseGeneric(): ParsedJob {
  const url = canonicalUrl();
  const jsonLd = readJsonLdJobPosting();
  const og = readOpenGraph();
  const titleFallback = parseTitleHeuristic(document.title);

  const result: ParsedJob = {
    company: firstNonEmpty(jsonLd?.company, og.company, titleFallback.company),
    role: firstNonEmpty(jsonLd?.title, og.title, titleFallback.role),
    url: firstNonEmpty(jsonLd?.url, url),
    stage: detectStage(url),
    parser: "generic",
    notes: buildNotes("generic"),
  };

  logParse("generic", result);
  return result;
}
