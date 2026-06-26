import type {
  ExecThreadJobExportBundle,
  ExecThreadListingRaw,
  ExecThreadMemberJobResponse,
  ExecThreadRedeemResponse,
} from "@/lib/execthread/types";

const SUBSTANTIVE_DETAIL_KEYS = [
  "jobDescription",
  "companyDescription",
  "title",
  "funcs",
  "functions",
  "recruiters",
  "contacts",
  "notificationRecipients",
  "listingLinkUrl",
  "redirectUrl",
  "travelPercent",
  "industry",
  "compType",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pickRicherString(a: string | null | undefined, b: string | null | undefined): string | null {
  const left = a?.trim() ?? "";
  const right = b?.trim() ?? "";
  if (!left) return right || null;
  if (!right) return left;
  return right.length > left.length ? right : left;
}

/** Unauthenticated getListingById often returns only `{ _id, jobType }` — do not let it clobber search rows. */
export function isSparseExecThreadListingDetail(detail: ExecThreadListingRaw | null | undefined): boolean {
  if (!detail || !detail._id) return true;
  return !SUBSTANTIVE_DETAIL_KEYS.some((key) => {
    const value = detail[key];
    if (value == null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (isRecord(value)) return Object.keys(value).length > 0;
    return true;
  });
}

function mergeObjects(
  base: Record<string, unknown> | null | undefined,
  extra: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!base && !extra) return null;
  return { ...(base ?? {}), ...(extra ?? {}) };
}

function listingFromMemberJob(response: ExecThreadMemberJobResponse | null | undefined): ExecThreadListingRaw | null {
  if (!response || response.unAuthorized) return null;
  return response.listing ?? response.listingPreview ?? null;
}

function listingFromRedeem(response: ExecThreadRedeemResponse | null | undefined): ExecThreadListingRaw | null {
  if (!response || response.error) return null;
  if (response.listing && isRecord(response.listing)) return response.listing;
  if (response.listingPreview && isRecord(response.listingPreview)) return response.listingPreview;
  if (isRecord(response) && response._id) return response as ExecThreadListingRaw;
  return null;
}

function mergeTextFields(target: ExecThreadListingRaw, source: ExecThreadListingRaw): void {
  target.jobDescription = pickRicherString(target.jobDescription, source.jobDescription) ?? undefined;
  target.jobDescriptionSafeHTML =
    pickRicherString(target.jobDescriptionSafeHTML, source.jobDescriptionSafeHTML) ?? undefined;
  target.companyDescription =
    pickRicherString(target.companyDescription, source.companyDescription) ?? undefined;
  target.companyDescriptionSafeHTML =
    pickRicherString(target.companyDescriptionSafeHTML, source.companyDescriptionSafeHTML) ?? undefined;
  target.longCompanyDescription =
    pickRicherString(target.longCompanyDescription ?? undefined, source.longCompanyDescription ?? undefined) ??
    undefined;
  target.summary = pickRicherString(target.summary, source.summary) ?? undefined;
}

function mergeArrayField<T>(target: T[] | undefined, source: T[] | undefined): T[] | undefined {
  if (!source?.length) return target;
  if (!target?.length) return source;
  return target.length >= source.length ? target : source;
}

/** Merge search, public preview, authenticated detail, member job, and redeem payloads. */
export function mergeExecThreadJobExport(bundle: ExecThreadJobExportBundle): ExecThreadListingRaw {
  const merged: ExecThreadListingRaw = { ...bundle.searchRow, _id: bundle.searchRow._id };

  const layers: ExecThreadListingRaw[] = [];
  if (bundle.publicPreview) layers.push(bundle.publicPreview);
  if (bundle.listingDetail && !isSparseExecThreadListingDetail(bundle.listingDetail)) {
    layers.push(bundle.listingDetail);
  }
  const memberListing = listingFromMemberJob(bundle.memberJob);
  if (memberListing) layers.push(memberListing);
  const redeemListing = listingFromRedeem(bundle.redeem);
  if (redeemListing) layers.push(redeemListing);

  for (const layer of layers) {
    mergeTextFields(merged, layer);
    const preservedText = {
      jobDescription: merged.jobDescription,
      jobDescriptionSafeHTML: merged.jobDescriptionSafeHTML,
      companyDescription: merged.companyDescription,
      companyDescriptionSafeHTML: merged.companyDescriptionSafeHTML,
      longCompanyDescription: merged.longCompanyDescription,
      summary: merged.summary,
    };
    Object.assign(merged, layer, { _id: merged._id });
    Object.assign(merged, preservedText);

    merged.funcs = merged.funcs ?? layer.funcs;
    merged.functions = mergeArrayField(
      Array.isArray(merged.functions) ? merged.functions : undefined,
      Array.isArray(layer.functions) ? layer.functions : undefined,
    );
    merged.recruiters = mergeArrayField(merged.recruiters, layer.recruiters);
    merged.contacts = mergeArrayField(merged.contacts, layer.contacts);
    merged.notificationRecipients = mergeArrayField(
      merged.notificationRecipients,
      layer.notificationRecipients,
    );
    merged.hiringManagers = mergeArrayField(merged.hiringManagers, layer.hiringManagers);
    if (layer.hiringManager && isRecord(layer.hiringManager)) {
      merged.hiringManagers = mergeArrayField(merged.hiringManagers, [
        layer.hiringManager as NonNullable<ExecThreadListingRaw["hiringManagers"]>[number],
      ]);
    }

    if (layer.company && isRecord(layer.company)) {
      merged.company = mergeObjects(
        isRecord(merged.company) ? (merged.company as Record<string, unknown>) : null,
        layer.company as Record<string, unknown>,
      ) as ExecThreadListingRaw["company"];
    }

    if (layer.listingLinkUrl && isRecord(layer.listingLinkUrl)) {
      const existing = isRecord(merged.listingLinkUrl) ? merged.listingLinkUrl : {};
      merged.listingLinkUrl = { ...existing, ...layer.listingLinkUrl };
    }

    if (layer.travelPercent != null || layer.travelPercent === null) {
      merged.travelPercent = layer.travelPercent;
    }

    merged.industry = merged.industry ?? layer.industry;
    merged.compType = merged.compType ?? layer.compType;
    merged.recruitingFirm = merged.recruitingFirm ?? layer.recruitingFirm;
    merged.redirectUrl = merged.redirectUrl ?? layer.redirectUrl;
    merged.isRedirectListing = merged.isRedirectListing ?? layer.isRedirectListing;
    merged.companyContact = merged.companyContact ?? layer.companyContact;
    merged.hasRecruiterContactInfo = merged.hasRecruiterContactInfo ?? layer.hasRecruiterContactInfo;
    merged.hasRecruiters = merged.hasRecruiters ?? layer.hasRecruiters;
    merged.recruiterCount = merged.recruiterCount ?? layer.recruiterCount;
  }

  merged._kimchiExport = {
    fetchedAt: new Date().toISOString(),
    searchRow: bundle.searchRow,
    publicPreview: bundle.publicPreview,
    listingDetail: bundle.listingDetail,
    memberJob: bundle.memberJob,
    redeem: bundle.redeem,
  };

  return merged;
}

export function execThreadJobNeedsRedeem(job: ExecThreadListingRaw): boolean {
  const link = job.listingLinkUrl;
  const needsApply =
    Boolean(link?.hasApply) && !(typeof link?.url === "string" && link.url.trim());
  const needsContacts =
    Boolean(job.hasRecruiterContactInfo || job.hasRecruiters || (job.recruiterCount ?? 0) > 0) &&
    !job.recruiters?.length &&
    !job.contacts?.length &&
    !job.notificationRecipients?.length &&
    !job.companyContact?.email;
  return needsApply || needsContacts;
}
