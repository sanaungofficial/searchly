import { POSTED_WITHIN_OPTIONS } from "@/lib/job-posted-filter";
import { jobFunctionPillItems } from "@/components/scout/job-function-dropdown";
import type { RecommendedFilterForm } from "@/components/scout/pipeline-recommended-filters";
import type { AllFiltersSectionId } from "@/components/scout/pipeline-recommended-filters";
import { hirebaseLevelsFromExperienceLabelSet } from "@/lib/search-preferences";

export type FilterChipKind =
  | "jobFunction"
  | "location"
  | "workModel"
  | "jobType"
  | "experience"
  | "industry"
  | "datePosted"
  | "salary"
  | "company"
  | "visa"
  | "companyStage"
  | "skill"
  | "excludedTitle"
  | "excludedIndustry"
  | "excludedSkill"
  | "excludedCompany";

export type FilterChip = {
  id: string;
  kind: FilterChipKind;
  label: string;
  value: string;
};

function splitList(value: string): string[] {
  return value.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
}

function jobTypeLabel(type: string): string {
  return type.replace("Full Time", "Full-time").replace("Part Time", "Part-time");
}

function workModelLabel(type: string): string {
  if (type === "In-Person") return "Onsite";
  if (type === "Remote") return "Remote";
  return type;
}

function locationChipLabel(form: RecommendedFilterForm): string | null {
  if (form.locationAllInCountry && form.locationCountry.trim()) {
    if (form.locationCountry === "United States") return "US";
    if (form.locationCountry === "Canada") return "Canada";
    return form.locationCountry.trim();
  }
  const parts = [form.locationCity, form.locationRegion, form.locationCountry].filter(Boolean);
  if (!parts.length) return null;
  if (parts.length === 1 && parts[0] === "United States") return "US";
  return parts.join(", ");
}

/** Jobright-style drawer title: "Marketing + 2 roles, US". */
export function opportunitiesDrawerTitle(form: RecommendedFilterForm): string {
  const bleed = new Set<string>();
  const jobFns = visibleJobFunctions(form, bleed);
  const parts: string[] = [];

  if (jobFns.length) {
    const first = jobFns[0]!;
    parts.push(jobFns.length > 1 ? `${first} + ${jobFns.length - 1} role${jobFns.length > 1 ? "s" : ""}` : first);
  }

  const loc = locationChipLabel(form);
  if (loc) parts.push(loc);

  return parts.length ? parts.join(", ") : "All Filters";
}

function visibleJobFunctions(form: RecommendedFilterForm, bleed: Set<string>): string[] {
  return jobFunctionPillItems(form).filter((item) => !bleed.has(item.toLowerCase()));
}

/** Applied filter chips for the drawer header — one chip per value, no API label prefixes. */
export function buildOpportunitiesFilterChips(
  form: RecommendedFilterForm,
  options?: { excludeTargetRoleBleed?: string[] },
): FilterChip[] {
  const chips: FilterChip[] = [];
  const bleed = new Set((options?.excludeTargetRoleBleed ?? []).map((s) => s.toLowerCase()));

  for (const fn of visibleJobFunctions(form, bleed)) {
    chips.push({ id: `jobfn:${fn}`, kind: "jobFunction", label: fn, value: fn });
  }

  const loc = locationChipLabel(form);
  if (loc) chips.push({ id: `location:${loc}`, kind: "location", label: loc, value: loc });

  for (const type of form.locationTypes) {
    const label = workModelLabel(type);
    chips.push({ id: `work:${type}`, kind: "workModel", label, value: type });
  }

  for (const type of form.jobTypes) {
    const label = jobTypeLabel(type);
    chips.push({ id: `type:${type}`, kind: "jobType", label, value: type });
  }

  for (const label of form.experienceLevelLabels) {
    chips.push({ id: `exp:${label}`, kind: "experience", label, value: label });
  }

  for (const industry of splitList(form.industries)) {
    chips.push({ id: `industry:${industry}`, kind: "industry", label: industry, value: industry });
  }

  if (form.datePostedWithinDays.trim()) {
    const label =
      POSTED_WITHIN_OPTIONS.find((o) => String(o.days) === form.datePostedWithinDays)?.label ??
      "Date posted";
    chips.push({ id: `date:${form.datePostedWithinDays}`, kind: "datePosted", label, value: form.datePostedWithinDays });
  }

  if (form.salaryFrom.trim() && !form.openToAllSalary) {
    const n = Number(form.salaryFrom);
    const label = Number.isFinite(n) ? `$${n.toLocaleString()}+` : form.salaryFrom;
    chips.push({ id: `salary:${form.salaryFrom}`, kind: "salary", label, value: form.salaryFrom });
  }

  if (form.companyName.trim()) {
    chips.push({
      id: `company:${form.companyName}`,
      kind: "company",
      label: form.companyName.trim(),
      value: form.companyName.trim(),
    });
  }

  if (form.visaSponsored) {
    chips.push({ id: "visa:1", kind: "visa", label: "Visa sponsorship", value: "1" });
  }

  for (const stage of form.companyStages) {
    chips.push({ id: `stage:${stage}`, kind: "companyStage", label: stage, value: stage });
  }

  for (const skill of splitList(form.skills)) {
    chips.push({ id: `skill:${skill}`, kind: "skill", label: skill, value: skill });
  }

  for (const title of splitList(form.excludedJobTitles)) {
    chips.push({ id: `ex-title:${title}`, kind: "excludedTitle", label: `− ${title}`, value: title });
  }

  for (const industry of splitList(form.excludedIndustries)) {
    chips.push({ id: `ex-industry:${industry}`, kind: "excludedIndustry", label: `− ${industry}`, value: industry });
  }

  for (const skill of splitList(form.excludedSkills)) {
    chips.push({ id: `ex-skill:${skill}`, kind: "excludedSkill", label: `− ${skill}`, value: skill });
  }

  for (const company of splitList(form.excludedCompany)) {
    chips.push({ id: `ex-company:${company}`, kind: "excludedCompany", label: `− ${company}`, value: company });
  }

  return chips;
}

export function removeOpportunitiesFilterChip(
  form: RecommendedFilterForm,
  chip: FilterChip,
): RecommendedFilterForm {
  switch (chip.kind) {
    case "jobFunction": {
      const taxonomy = splitList(form.jobCategories);
      const custom = form.customJobFunctions ?? [];
      const lower = chip.value.toLowerCase();
      return {
        ...form,
        jobCategories: taxonomy.filter((t) => t.toLowerCase() !== lower).join(", "),
        customJobFunctions: custom.filter((c) => c.toLowerCase() !== lower),
      };
    }
    case "location":
      return {
        ...form,
        locationCity: "",
        locationRegion: "",
        locationCountry: "",
        locationAllInCountry: false,
        locationRadiusMiles: "",
      };
    case "workModel": {
      const next = new Set(form.locationTypes);
      next.delete(chip.value);
      return { ...form, locationTypes: next };
    }
    case "jobType": {
      const next = new Set(form.jobTypes);
      next.delete(chip.value);
      return { ...form, jobTypes: next };
    }
    case "experience": {
      const nextLabels = new Set(form.experienceLevelLabels);
      nextLabels.delete(chip.value);
      return {
        ...form,
        experienceLevelLabels: nextLabels,
        experienceLevels: new Set(hirebaseLevelsFromExperienceLabelSet(nextLabels)),
      };
    }
    case "industry":
      return {
        ...form,
        industries: splitList(form.industries)
          .filter((i) => i !== chip.value)
          .join(", "),
      };
    case "datePosted":
      return { ...form, datePostedWithinDays: "" };
    case "salary":
      return { ...form, salaryFrom: "", openToAllSalary: true };
    case "company":
      return { ...form, companyName: "" };
    case "visa":
      return { ...form, visaSponsored: false };
    case "companyStage": {
      const next = new Set(form.companyStages);
      next.delete(chip.value);
      return { ...form, companyStages: next };
    }
    case "skill":
      return {
        ...form,
        skills: splitList(form.skills)
          .filter((s) => s !== chip.value)
          .join(", "),
      };
    case "excludedTitle":
      return {
        ...form,
        excludedJobTitles: splitList(form.excludedJobTitles)
          .filter((t) => t !== chip.value)
          .join(", "),
      };
    case "excludedIndustry":
      return {
        ...form,
        excludedIndustries: splitList(form.excludedIndustries)
          .filter((i) => i !== chip.value)
          .join(", "),
      };
    case "excludedSkill":
      return {
        ...form,
        excludedSkills: splitList(form.excludedSkills)
          .filter((s) => s !== chip.value)
          .join(", "),
      };
    case "excludedCompany":
      return {
        ...form,
        excludedCompany: splitList(form.excludedCompany)
          .filter((c) => c !== chip.value)
          .join(", "),
      };
    default:
      return form;
  }
}

export function clearOpportunitiesFilterSection(
  section: AllFiltersSectionId,
  form: RecommendedFilterForm,
): RecommendedFilterForm {
  switch (section) {
    case "basic":
      return {
        ...form,
        jobCategories: "",
        customJobFunctions: [],
        excludedJobTitles: "",
        jobTypes: new Set(),
        locationTypes: new Set(),
        locationCity: "",
        locationRegion: "",
        locationCountry: "",
        locationAllInCountry: false,
        locationRadiusMiles: "",
        experienceLevelLabels: new Set(),
        experienceLevels: new Set(),
        openToAllExperience: false,
        yearsFrom: "",
        yearsTo: "",
        datePostedWithinDays: "",
      };
    case "compensation":
      return {
        ...form,
        salaryFrom: "",
        salaryTo: "",
        openToAllSalary: true,
        visaSponsored: false,
        excludeSecurityClearance: false,
        excludeUsCitizenOnly: false,
      };
    case "interests":
      return {
        ...form,
        industries: "",
        excludedIndustries: "",
        skills: "",
        excludedSkills: "",
      };
    case "company":
      return {
        ...form,
        companyName: "",
        companyStages: new Set(),
        excludeStaffingAgency: false,
        excludedCompany: "",
      };
    default:
      return form;
  }
}

export function resetOpportunitiesFilterForm(
  form: RecommendedFilterForm,
  empty: RecommendedFilterForm,
): RecommendedFilterForm {
  return { ...empty, semanticQuery: form.semanticQuery };
}
