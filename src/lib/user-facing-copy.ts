/** Plain-language copy for errors and empty states — keep at ~7th-grade reading level. */

export const RESUME_MISSING_HEADLINE = "You don't have a master resume yet";

export const RESUME_MISSING_BODY =
  "Upload a resume under Profile → Resumes, or click Create as a resume to build one from your profile data — then come back to tailor for this job.";

export const RESUME_MISSING_SHORT =
  "Upload a resume or create one from your profile under Profile → Resumes, then try again.";

function isMissingResumeError(raw: string): boolean {
  if (!raw) return true;
  if (/^no resume found$/i.test(raw)) return true;
  return /couldn't find.*resume|don't have a resume|no master resume/i.test(raw);
}

export function friendlyResumeError(error: string | null | undefined): {
  headline: string;
  body: string;
  isMissingResume: boolean;
} {
  const raw = (error ?? "").trim();
  if (isMissingResumeError(raw)) {
    return {
      headline: RESUME_MISSING_HEADLINE,
      body: RESUME_MISSING_BODY,
      isMissingResume: true,
    };
  }
  if (/resume not found/i.test(raw)) {
    return {
      headline: "Couldn't load that resume",
      body: "The selected resume may be missing or still processing. Open Profile → Resumes, re-upload or reparse, then try again.",
      isMissingResume: false,
    };
  }
  if (raw === "No job description provided") {
    return {
      headline: "This job is missing a description",
      body: "Paste the job description below so we can compare it to your resume.",
      isMissingResume: false,
    };
  }
  if (/no resume data|reparse/i.test(raw)) {
    return {
      headline: "Resume needs to be parsed first",
      body: raw,
      isMissingResume: false,
    };
  }
  if (/cut off before finishing|failed to parse|truncated|ran out of room/i.test(raw)) {
    return {
      headline: "Generation ran out of room",
      body: raw.includes("Try") ? raw : `${raw} Try Quick edit mode with fewer sections.`,
      isMissingResume: false,
    };
  }
  if (/monthly ai limit|credit balance|quota/i.test(raw)) {
    return {
      headline: "AI limit reached",
      body: raw,
      isMissingResume: false,
    };
  }
  if (/ai not configured|isn't available/i.test(raw)) {
    return {
      headline: "AI isn't available here",
      body: raw,
      isMissingResume: false,
    };
  }
  if (raw) {
    const shortHeadline = raw.length <= 72;
    return {
      headline: shortHeadline ? raw : "Something went wrong",
      body: shortHeadline
        ? "Try again in a moment, or update your resume under Profile."
        : raw,
      isMissingResume: false,
    };
  }
  return {
    headline: "Something went wrong",
    body: "We couldn't finish this step. Try again in a moment, or update your resume under Profile.",
    isMissingResume: false,
  };
}

export function friendlyLinkedInImportError(message: string): { headline: string; body: string } {
  const lower = message.toLowerCase();
  if (
    lower.includes("could not be loaded") ||
    lower.includes("insufficient") ||
    lower.includes("sparse") ||
    lower.includes("not enough")
  ) {
    return {
      headline: "Your LinkedIn doesn't have much on it yet — and that's okay",
      body: "We couldn't pull enough info to build a full profile. Upload a resume, add your experience manually under Profile, or start fresh and we'll walk you through it step by step.",
    };
  }
  if (lower.includes("not configured")) {
    return {
      headline: "LinkedIn import isn't available here",
      body: "You can still upload a resume or fill in your profile by hand under Profile → About.",
    };
  }
  if (lower.includes("valid linkedin")) {
    return {
      headline: "Check your LinkedIn link",
      body: "Paste a link like linkedin.com/in/your-name — it needs to be a public profile URL.",
    };
  }
  return {
    headline: "We couldn't import LinkedIn right now",
    body: "Try again, upload a resume instead, or build your profile manually — we'll help you either way.",
  };
}

export const LINKEDIN_SPARSE_MESSAGE =
  "We imported what we could, but your LinkedIn is pretty empty. Add your experience under Profile, upload a resume, or keep going in onboarding — we'll help you fill in the gaps.";
