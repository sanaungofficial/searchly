"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  formatCompactProfileLocation,
  parseProfileLocationString,
} from "@/lib/profile-location";
import {
  buildOnboardingProfilePatch,
  type OnboardingMatchingState,
  type RelocationId,
  type VisaNeedId,
  type WorkArrangementId,
} from "@/lib/onboarding-preferences";
import {
  ScoutHeader,
  ScreenWelcome,
  ScreenReadBack,
  ScreenTargetRoles,
  ScreenOnboardingPriorityRole,
  ScreenTargetCompanies,
  ScreenOnboardingLocation,
  ScreenOnboardingWorkArrangement,
  ScreenOnboardingRelocation,
  ScreenOnboardingVisa,
  ScreenOnboardingSalary,
  ScreenOnboardingTimeline,
  ScreenOnboardingAvoidRoles,
  ScreenFinalSummary,
  ScreenSetup,
  DemoNextButton,
  OnboardingProcessingBanner,
  fetchReadbackWithRetry,
  ScreenCareerIntent,
  ScreenOneLiner,
  type CareerIntentId,
  type FinalSummaryProfile,
  type Screen,
  type ReadBackData,
  type ReadBackStatus,
  type SetupStep,
  type SetupStepStatus,
  type OnboardingCompanyPick,
} from "@/components/scout/screens";
import { ONBOARDING_MAX_TARGET_COMPANIES } from "@/lib/company-catalog";
import { linkedInHandleFromUrl, normalizeLinkedInUrl } from "@/lib/linkedin-url";
import { writeOnboardingFinishPayload } from "@/lib/onboarding-finish";
import type { OnelinerAnalysisResponse } from "@/lib/onboarding-oneliner-suggestions";
import {
  extractOnelinerPrefill,
  onelinerPrefillSuccessMessage,
} from "@/lib/onboarding-oneliner-prefill";

function saveLinkedIn(handle: string): Promise<void> {
  const url = normalizeLinkedInUrl(handle);
  if (!url) return Promise.resolve();
  return fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ linkedinUrl: url }),
  }).then(() => {});
}

type LinkedInImportStepResult = "done" | "skipped" | "failed" | "unavailable";

type LinkedInImportOutcome = {
  status: LinkedInImportStepResult;
  headline?: string | null;
  summary?: string | null;
  error?: string;
  sparseMessage?: string;
};

type OnelinerImportBanner = {
  type: "success" | "error" | "info";
  message: string;
};

async function importLinkedInProfile(
  handle: string,
  importAvailable: boolean,
): Promise<LinkedInImportOutcome> {
  const url = normalizeLinkedInUrl(handle);
  if (!url) return { status: "skipped" };
  if (!importAvailable) return { status: "unavailable" };
  try {
    const res = await fetch("/api/profile/linkedin-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkedinUrl: url }),
    });
    if (res.status === 503) return { status: "unavailable" };
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        status: "failed",
        error: typeof data.error === "string" ? data.error : "LinkedIn import failed.",
      };
    }
    return {
      status: "done",
      headline: typeof data.headline === "string" ? data.headline : null,
      summary: typeof data.summary === "string" ? data.summary : null,
      sparseMessage: typeof data.sparseMessage === "string" ? data.sparseMessage : undefined,
    };
  } catch {
    return { status: "failed", error: "LinkedIn import failed. Check your connection and try again." };
  }
}

function saveMatchingPreferences(state: OnboardingMatchingState): Promise<void> {
  return fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildOnboardingProfilePatch(state)),
  }).then(() => {});
}

function savePrioritizedRoles(roles: string[]): Promise<void> {
  if (!roles.length) return Promise.resolve();
  return fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prioritizedRoles: roles }),
  }).then(() => {});
}

function saveTargetRoles(roles: string[]): Promise<void> {
  if (!roles.length) return Promise.resolve();
  return fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetRoles: roles }),
  }).then(() => {});
}

function saveHeadline(headline: string): Promise<void> {
  if (!headline.trim()) return Promise.resolve();
  return fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ headline: headline.trim() }),
  }).then(() => {});
}

function savePrioritizedCategories(categories: string[]): Promise<void> {
  if (!categories.length) return Promise.resolve();
  return fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prioritizedCategories: categories }),
  }).then(() => {});
}

function buildInitialSetupSteps(linkedinImportAvailable: boolean): SetupStep[] {
  return [
    { id: "profile", label: "Saving your answers", status: "pending" },
    {
      id: "linkedin",
      label: linkedinImportAvailable ? "Importing your LinkedIn" : "Saving your LinkedIn URL",
      status: "pending",
    },
    { id: "resume", label: "Setting up your resume", status: "pending" },
    { id: "analysis", label: "Reviewing your resume", status: "pending" },
    { id: "companies", label: "Scanning your target companies", status: "pending" },
  ];
}

export default function OnboardingPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      setAuthChecked(true);
    });
  }, [router]);

  const [intentDone, setIntentDone] = useState(false);
  const [showOneLiner, setShowOneLiner] = useState(false);
  const [showFinalSummary, setShowFinalSummary] = useState(false);
  const [onelinerAnalyzing, setOnelinerAnalyzing] = useState(false);
  const [profileOneLiner, setProfileOneLiner] = useState("");
  const [careerMotivation, setCareerMotivation] = useState("");
  const [prioritizedCategories, setPrioritizedCategories] = useState<string[]>([]);
  const [suggestedPrioritizedCategories, setSuggestedPrioritizedCategories] = useState<string[]>([]);
  const [suggestedDeprioritizedCategories, setSuggestedDeprioritizedCategories] = useState<string[]>([]);
  const [onelinerLocationHint, setOnelinerLocationHint] = useState<string | null>(null);

  const [screen, setScreen] = useState<Screen>(0);
  const [resumeFilename, setResumeFilename] = useState<string | null>(null);
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [liInput, setLiInput] = useState("");
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
  const [priorityRole, setPriorityRole] = useState("");
  const [selectedCompanies, setSelectedCompanies] = useState<OnboardingCompanyPick[]>([]);
  const [readbackRoleSuggestions, setReadbackRoleSuggestions] = useState<string[]>([]);
  const [readbackData, setReadbackData] = useState<ReadBackData | null>(null);
  const [readbackStatus, setReadbackStatus] = useState<ReadBackStatus>("idle");
  const readbackStartedRef = useRef(false);
  const locationHintFetchedRef = useRef(false);
  const [targetMarket, setTargetMarket] = useState("");
  const [fullyRemote, setFullyRemote] = useState(false);
  const [workArrangement, setWorkArrangement] = useState<WorkArrangementId>("");
  const [relocation, setRelocation] = useState<RelocationId>("");
  const [visaNeed, setVisaNeed] = useState<VisaNeedId>("");
  const [targetSalary, setTargetSalary] = useState("");
  const [jobTimeline, setJobTimeline] = useState("");
  const [deprioritizedCategories, setDeprioritizedCategories] = useState<string[]>([]);
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState(false);
  const [resumeAssetId, setResumeAssetId] = useState<string | null>(null);
  const [linkedinImportAvailable, setLinkedinImportAvailable] = useState<boolean | null>(null);
  const [linkedinImporting, setLinkedinImporting] = useState(false);
  const [onelinerImportBanner, setOnelinerImportBanner] = useState<OnelinerImportBanner | null>(null);
  const linkedinImportedRef = useRef(false);
  const resumeParsePollRef = useRef<number | null>(null);
  const [setupSteps, setSetupSteps] = useState<SetupStep[]>(() => buildInitialSetupSteps(false));

  const goTo = useCallback((n: Screen) => setScreen(n), []);

  useEffect(() => {
    void fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { linkedinImportAvailable?: boolean } | null) => {
        if (typeof data?.linkedinImportAvailable === "boolean") {
          setLinkedinImportAvailable(data.linkedinImportAvailable);
          setSetupSteps(buildInitialSetupSteps(data.linkedinImportAvailable));
        } else {
          setLinkedinImportAvailable(false);
        }
      })
      .catch(() => setLinkedinImportAvailable(false));
  }, []);

  useEffect(() => {
    if (screen !== 4 || locationHintFetchedRef.current) return;
    locationHintFetchedRef.current = true;
    void fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { parsedData?: { location?: string | null } } | null) => {
        const raw = data?.parsedData?.location?.trim();
        if (!raw) return;
        const compact = formatCompactProfileLocation(parseProfileLocationString(raw)) ?? raw;
        setLocationHint(compact);
      })
      .catch(() => {});
  }, [screen]);

  const setStepStatus = useCallback((id: string, status: SetupStepStatus) => {
    setSetupSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }, []);

  const matchingState: OnboardingMatchingState = useMemo(
    () => ({
      targetMarket,
      fullyRemote,
      workArrangement,
      relocation,
      visaNeed,
      targetSalary,
      jobTimeline,
      deprioritizedCategories,
    }),
    [
      targetMarket,
      fullyRemote,
      workArrangement,
      relocation,
      visaNeed,
      targetSalary,
      jobTimeline,
      deprioritizedCategories,
    ],
  );

  const applyReadbackRoles = useCallback((data: ReadBackData | null) => {
    if (!data?.targetRoles?.length) return;
    const roles = data.targetRoles.map((r) => r.role).filter(Boolean).slice(0, 20);
    setReadbackRoleSuggestions(roles);
    setSelectedTitles((prev) => (prev.length ? prev : roles));
  }, []);

  const startBackgroundReadback = useCallback(() => {
    if (readbackStartedRef.current) return;
    readbackStartedRef.current = true;
    setReadbackStatus("loading");

    void fetchReadbackWithRetry().then((result) => {
      if (result) {
        setReadbackData(result);
        setReadbackStatus("ready");
        applyReadbackRoles(result);
      } else {
        setReadbackStatus("pending");
      }
    });
  }, [applyReadbackRoles]);

  const applyResumeParsePrefill = useCallback(async (assetId: string) => {
    try {
      const res = await fetch(`/api/assets/${assetId}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        parseStatus?: string;
        parseError?: string | null;
        parsedData?: { summary?: string | null };
      };
      if (data.parseStatus === "failed") {
        setOnelinerImportBanner({
          type: "error",
          message:
            data.parseError?.trim() ||
            "We couldn't analyze your resume. Type your one-liner manually.",
        });
        return "failed" as const;
      }
      if (data.parseStatus !== "complete") return "pending" as const;

      const profileRes = await fetch("/api/profile");
      const profile = profileRes.ok
        ? ((await profileRes.json()) as { headline?: string | null; summary?: string | null })
        : null;
      const prefill = extractOnelinerPrefill({
        headline: profile?.headline,
        summary: profile?.summary ?? data.parsedData?.summary,
      });
      if (prefill) {
        setProfileOneLiner(prefill.text);
        setOnelinerImportBanner({
          type: "success",
          message: onelinerPrefillSuccessMessage(prefill.source, "resume"),
        });
      }
      return "complete" as const;
    } catch {
      return "pending" as const;
    }
  }, []);

  const startResumeParsePolling = useCallback(
    (assetId: string) => {
      if (resumeParsePollRef.current != null) {
        window.clearInterval(resumeParsePollRef.current);
        resumeParsePollRef.current = null;
      }

      const poll = async () => {
        const outcome = await applyResumeParsePrefill(assetId);
        if (outcome === "complete" || outcome === "failed") {
          if (resumeParsePollRef.current != null) {
            window.clearInterval(resumeParsePollRef.current);
            resumeParsePollRef.current = null;
          }
        }
      };

      void poll();
      resumeParsePollRef.current = window.setInterval(() => void poll(), 2500);
    },
    [applyResumeParsePrefill],
  );

  useEffect(() => {
    return () => {
      if (resumeParsePollRef.current != null) {
        window.clearInterval(resumeParsePollRef.current);
      }
    };
  }, []);

  const processFile = useCallback(
    (file: File | undefined | null) => {
      if (!file) return;
      setResumeFilename(file.name);
      setResumeUploaded(false);
      setResumeUploading(true);
      setResumeError(false);
      setResumeAssetId(null);
      setProfileOneLiner("");
      setOnelinerImportBanner(null);

      const formData = new FormData();
      formData.append("file", file);

      void fetch("/api/resume", { method: "POST", body: formData })
        .then(async (res) => {
          if (res.ok) {
            const data = (await res.json().catch(() => ({}))) as { asset?: { id?: string } };
            const assetId = data.asset?.id;
            setResumeUploaded(true);
            if (assetId) {
              setResumeAssetId(assetId);
              startResumeParsePolling(assetId);
            }
            if (liInput.trim()) await saveLinkedIn(liInput);
            startBackgroundReadback();
          } else {
            setResumeError(true);
            setResumeFilename(null);
            readbackStartedRef.current = false;
          }
        })
        .catch(() => {
          setResumeError(true);
          setResumeFilename(null);
          readbackStartedRef.current = false;
        })
        .finally(() => {
          setResumeUploading(false);
        });
    },
    [liInput, startBackgroundReadback, startResumeParsePolling],
  );

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) processFile(f);
  };
  const onFileClick = () => {
    const el = document.getElementById("scout-file") as HTMLInputElement | null;
    if (el) el.click();
  };
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const onLIChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.trim();
    if (/linkedin\.com/i.test(value)) {
      value = linkedInHandleFromUrl(value);
    }
    value = value.replace(/^@/, "").replace(/\//g, "");
    setLiInput(value);
  };

  const onWelcomeContinue = useCallback(() => {
    if (!resumeFilename || resumeError) return;
    if (liInput.trim()) void saveLinkedIn(liInput);
    startBackgroundReadback();
    setShowOneLiner(true);
  }, [resumeFilename, resumeError, liInput, startBackgroundReadback]);

  const onLinkedInOnly = useCallback(async () => {
    if (!liInput.trim() || linkedinImporting) return;

    setOnelinerImportBanner(null);
    setProfileOneLiner("");
    await saveLinkedIn(liInput);

    const importAvailable = linkedinImportAvailable === true;
    if (!importAvailable) {
      setReadbackStatus("skipped");
      setOnelinerImportBanner({
        type: "info",
        message: "LinkedIn URL saved. You can import from Profile later.",
      });
      setShowOneLiner(true);
      return;
    }

    setLinkedinImporting(true);
    try {
      const result = await importLinkedInProfile(liInput, true);
      if (result.status === "done") {
        linkedinImportedRef.current = true;
        const prefill = extractOnelinerPrefill({
          headline: result.headline,
          summary: result.summary,
        });
        if (prefill) {
          setProfileOneLiner(prefill.text);
          setOnelinerImportBanner({
            type: "success",
            message: onelinerPrefillSuccessMessage(prefill.source, "linkedin"),
          });
        } else {
          setOnelinerImportBanner({
            type: "success",
            message: result.sparseMessage ?? "LinkedIn imported successfully.",
          });
        }
      } else {
        setOnelinerImportBanner({
          type: "error",
          message:
            result.error ??
            "We couldn't import your LinkedIn profile. Your URL was saved — you can keep going.",
        });
      }
    } finally {
      setLinkedinImporting(false);
    }

    setReadbackStatus("skipped");
    setShowOneLiner(true);
  }, [liInput, linkedinImporting, linkedinImportAvailable]);

  const onLIKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
      if (resumeFilename && !resumeError) onWelcomeContinue();
      else if (liInput.trim()) onLinkedInOnly();
    },
    [resumeFilename, resumeError, liInput, onWelcomeContinue, onLinkedInOnly],
  );

  const onCareerIntentSelect = useCallback((id: CareerIntentId) => {
    setCareerMotivation(id);
    void fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ careerMotivation: id }),
    });
    setIntentDone(true);
  }, []);

  const onSkipProfile = useCallback(() => {
    setShowOneLiner(true);
  }, []);

  const applyOnelinerAnalysis = useCallback(
    (data: OnelinerAnalysisResponse) => {
      const roles = data.targetRoles.map((r) => r.role).filter(Boolean).slice(0, 8);
      setReadbackData({
        picture: data.picture,
        strengths: data.strengths,
        targetRoles: data.targetRoles.map((r) => ({
          role: r.role,
          fit: r.match || "Suggested from your one-liner.",
        })),
        honestNote: "",
      });
      setReadbackStatus("ready");
      setReadbackRoleSuggestions(roles);
      setSuggestedPrioritizedCategories(data.prioritizedCategories);
      setSuggestedDeprioritizedCategories(data.deprioritizedCategories);
      if (data.prioritizedCategories.length) {
        setPrioritizedCategories((prev) => (prev.length ? prev : data.prioritizedCategories.slice(0, 5)));
      }
      if (data.deprioritizedCategories.length) {
        setDeprioritizedCategories((prev) =>
          prev.length ? prev : data.deprioritizedCategories.slice(0, 5),
        );
      }
      if (data.targetMarket) {
        setOnelinerLocationHint(data.targetMarket);
        setTargetMarket((prev) => prev.trim() || data.targetMarket || prev);
      }
      if (data.workArrangement) {
        setWorkArrangement((prev) => prev || data.workArrangement || prev);
        if (data.workArrangement === "remote_only") setFullyRemote(true);
      }
      setSelectedTitles((prev) => (prev.length ? prev : roles.slice(0, 3)));
    },
    [],
  );

  const onOneLinerSubmit = useCallback(
    async (text: string) => {
      setProfileOneLiner(text);
      setOnelinerAnalyzing(true);
      try {
        await saveHeadline(text);
        const res = await fetch("/api/onboarding/analyze-oneliner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oneliner: text }),
        });
        const data: OnelinerAnalysisResponse | null = res.ok ? await res.json() : null;
        if (data?.picture && Array.isArray(data.strengths)) {
          applyOnelinerAnalysis(data);
        } else {
          setReadbackStatus("skipped");
        }
      } catch {
        setReadbackStatus("skipped");
      } finally {
        setOnelinerAnalyzing(false);
        setShowOneLiner(false);
        goTo(2);
      }
    },
    [applyOnelinerAnalysis, goTo],
  );

  const hasResumeTrack = !!(resumeFilename || resumeUploaded || resumeUploading);

  useEffect(() => {
    if (screen !== 1) return;
    if (!hasResumeTrack) {
      setReadbackStatus((s) => (s === "idle" ? "skipped" : s));
    }
  }, [screen, hasResumeTrack]);

  useEffect(() => {
    if (readbackStatus !== "pending" || readbackData) return;

    const poll = () => {
      void fetch("/api/ai/readback", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (d?.picture && Array.isArray(d.strengths)) {
            const payload = d as ReadBackData;
            setReadbackData(payload);
            setReadbackStatus("ready");
            applyReadbackRoles(payload);
          }
        })
        .catch(() => {});
    };

    const id = window.setInterval(poll, 5000);
    return () => window.clearInterval(id);
  }, [readbackStatus, readbackData, applyReadbackRoles]);

  const onAddTargetRole = useCallback((title: string) => {
    setSelectedTitles((prev) => {
      if (prev.includes(title) || prev.length >= 10) return prev;
      return [...prev, title];
    });
  }, []);

  const onAddPrioritizedCategory = useCallback((category: string) => {
    setPrioritizedCategories((prev) =>
      prev.some((c) => c.toLowerCase() === category.toLowerCase()) ? prev : [...prev, category].slice(0, 10),
    );
  }, []);

  const onRemovePrioritizedCategory = useCallback((category: string) => {
    setPrioritizedCategories((prev) => prev.filter((c) => c !== category));
  }, []);

  const onRemoveTargetRole = useCallback((title: string) => {
    setSelectedTitles((prev) => prev.filter((t) => t !== title));
  }, []);

  const onReadBackConfirm = useCallback(
    (data: ReadBackData | null) => {
      applyReadbackRoles(data);
      goTo(2);
    },
    [applyReadbackRoles, goTo],
  );

  const onReadBackSkip = useCallback(() => goTo(2), [goTo]);

  const onReadBackRefine = useCallback(() => {
    readbackStartedRef.current = false;
    setReadbackData(null);
    setReadbackStatus("idle");
    goTo(0);
  }, [goTo]);

  const onRolesContinue = useCallback(async () => {
    await saveTargetRoles(selectedTitles);
    await savePrioritizedCategories(prioritizedCategories);
    if (selectedTitles.length === 1) {
      await savePrioritizedRoles([selectedTitles[0]!]);
      goTo(4);
    } else if (selectedTitles.length >= 2) {
      setPriorityRole((prev) => prev || selectedTitles[0] || "");
      goTo(3);
    } else {
      goTo(4);
    }
  }, [selectedTitles, prioritizedCategories, goTo]);

  const onRolesSkip = useCallback(async () => {
    await saveTargetRoles(selectedTitles);
    await savePrioritizedCategories(prioritizedCategories);
    goTo(4);
  }, [selectedTitles, prioritizedCategories, goTo]);

  const onPriorityContinue = useCallback(async () => {
    if (priorityRole) await savePrioritizedRoles([priorityRole]);
    goTo(4);
  }, [priorityRole, goTo]);

  const onPrioritySkip = useCallback(() => goTo(4), [goTo]);

  const persistMatchingAndGo = useCallback(
    async (next: Screen) => {
      await saveMatchingPreferences(matchingState);
      goTo(next);
    },
    [matchingState, goTo],
  );

  const onLocationContinue = useCallback(async () => {
    await persistMatchingAndGo(5);
  }, [persistMatchingAndGo]);

  const onLocationSkip = useCallback(async () => {
    await persistMatchingAndGo(5);
  }, [persistMatchingAndGo]);

  const onWorkArrangementContinue = useCallback(async () => {
    await persistMatchingAndGo(6);
  }, [persistMatchingAndGo]);

  const onWorkArrangementSkip = useCallback(async () => {
    await persistMatchingAndGo(6);
  }, [persistMatchingAndGo]);

  const onRelocationContinue = useCallback(async () => {
    await persistMatchingAndGo(7);
  }, [persistMatchingAndGo]);

  const onRelocationSkip = useCallback(async () => {
    await persistMatchingAndGo(7);
  }, [persistMatchingAndGo]);

  const onVisaContinue = useCallback(async () => {
    await persistMatchingAndGo(8);
  }, [persistMatchingAndGo]);

  const onVisaSkip = useCallback(async () => {
    await persistMatchingAndGo(8);
  }, [persistMatchingAndGo]);

  const onSalaryContinue = useCallback(async () => {
    await persistMatchingAndGo(9);
  }, [persistMatchingAndGo]);

  const onSalarySkip = useCallback(async () => {
    await persistMatchingAndGo(9);
  }, [persistMatchingAndGo]);

  const onTimelineContinue = useCallback(async () => {
    await persistMatchingAndGo(10);
  }, [persistMatchingAndGo]);

  const onTimelineSkip = useCallback(async () => {
    await persistMatchingAndGo(10);
  }, [persistMatchingAndGo]);

  const onAvoidContinue = useCallback(async () => {
    await persistMatchingAndGo(11);
  }, [persistMatchingAndGo]);

  const onAvoidSkip = useCallback(async () => {
    await persistMatchingAndGo(11);
  }, [persistMatchingAndGo]);

  const onFullyRemoteChange = useCallback((next: boolean) => {
    setFullyRemote(next);
    if (next) {
      setTargetMarket("");
      setWorkArrangement("remote_only");
    }
  }, []);

  const onAddAvoidCategory = useCallback((category: string) => {
    setDeprioritizedCategories((prev) =>
      prev.some((c) => c.toLowerCase() === category.toLowerCase()) ? prev : [...prev, category].slice(0, 10),
    );
  }, []);

  const onRemoveAvoidCategory = useCallback((category: string) => {
    setDeprioritizedCategories((prev) => prev.filter((c) => c !== category));
  }, []);

  const onAddTargetCompany = useCallback((company: OnboardingCompanyPick) => {
    setSelectedCompanies((prev) => {
      if (prev.some((c) => c.catalogSlug === company.catalogSlug) || prev.length >= ONBOARDING_MAX_TARGET_COMPANIES) {
        return prev;
      }
      return [...prev, company];
    });
  }, []);

  const onRemoveTargetCompany = useCallback((catalogSlug: string) => {
    setSelectedCompanies((prev) => prev.filter((c) => c.catalogSlug !== catalogSlug));
  }, []);

  const runFinishSetup = useCallback(async () => {
    const importAvailable = linkedinImportAvailable === true;
    setSetupSteps(buildInitialSetupSteps(importAvailable).map((s) => ({ ...s, status: "pending" as SetupStepStatus })));
    goTo(12);

    let primaryAssetId: string | undefined;
    const companiesSnapshot = selectedCompanies;

    try {
      setStepStatus("profile", "active");
      await saveMatchingPreferences(matchingState);
      await saveTargetRoles(selectedTitles);
      await savePrioritizedCategories(prioritizedCategories);
      if (profileOneLiner.trim()) await saveHeadline(profileOneLiner);
      if (liInput.trim()) await saveLinkedIn(liInput);
      setStepStatus("profile", "done");

      if (liInput.trim() && !linkedinImportedRef.current) {
        setStepStatus("linkedin", "active");
        const importResult = await importLinkedInProfile(liInput, importAvailable);
        if (importResult.status === "done") {
          linkedinImportedRef.current = true;
          setStepStatus("linkedin", "done");
        } else if (importResult.status === "failed") {
          setStepStatus("linkedin", "failed");
        } else {
          setStepStatus("linkedin", "skipped");
        }
      } else if (liInput.trim() && linkedinImportedRef.current) {
        setStepStatus("linkedin", "done");
      } else {
        setStepStatus("linkedin", "skipped");
      }

      setStepStatus("resume", "active");
      const assetsRes = await fetch("/api/assets");
      const assets = await assetsRes.json();
      const primary = Array.isArray(assets)
        ? assets.find((a: { type: string; isPrimary: boolean }) => a.type === "RESUME" && a.isPrimary)
          ?? assets.find((a: { type: string }) => a.type === "RESUME")
        : undefined;
      primaryAssetId = primary?.id;
      setStepStatus("resume", primaryAssetId ? "done" : "skipped");

      if (primaryAssetId) {
        setStepStatus("analysis", "active");
        await fetch(`/api/assets/${primaryAssetId}/analysis`).catch(() => {});
        setStepStatus("analysis", "done");
      } else {
        setStepStatus("analysis", "skipped");
      }

      if (companiesSnapshot.length > 0) {
        setStepStatus("companies", "active");
        for (const pick of companiesSnapshot) {
          const res = await fetch("/api/companies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              catalogSlug: pick.catalogSlug,
              name: pick.name,
              website: pick.website,
              careersUrl: pick.careersUrl,
              type: pick.type,
            }),
          });
          let trackedId: string | null = null;
          if (res.ok) {
            const created = await res.json();
            trackedId = created.id ?? null;
          } else if (res.status === 409) {
            const data = await res.json();
            trackedId = data.existing?.id ?? null;
          }
          if (trackedId) {
            await fetch(`/api/companies/${trackedId}/refresh`, { method: "POST" }).catch(() => {});
          }
        }
        setStepStatus("companies", "done");
      } else {
        setStepStatus("companies", "skipped");
      }

      writeOnboardingFinishPayload({
        primaryAssetId,
        autoRunMatch: false,
      });

      await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete-onboarding" }),
      }).catch(() => {});

      router.push("/dashboard");
    } catch {
      await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete-onboarding" }),
      }).catch(() => {});
      writeOnboardingFinishPayload({ primaryAssetId, autoRunMatch: false });
      router.push("/dashboard");
    }
  }, [
    matchingState,
    goTo,
    liInput,
    selectedTitles,
    prioritizedCategories,
    profileOneLiner,
    selectedCompanies,
    setStepStatus,
    router,
    linkedinImportAvailable,
  ]);

  const onCompaniesContinue = useCallback(() => {
    setShowFinalSummary(true);
  }, []);

  const onCompaniesSkip = useCallback(() => {
    setShowFinalSummary(true);
  }, []);

  const onFinalSummaryConfirm = useCallback(() => {
    void runFinishSetup();
  }, [runFinishSetup]);

  const onFinalSummaryBack = useCallback(() => {
    setShowFinalSummary(false);
    goTo(11);
  }, [goTo]);

  const demoAdvance = () => {
    if (!intentDone) return;
    if (showOneLiner) {
      void onOneLinerSubmit("Strategy & Digital Transformation | Growth Systems Builder | MBA");
      return;
    }
    if (screen === 0) {
      setResumeFilename("Sarah_Chen_Resume.pdf");
      window.setTimeout(() => {
        setResumeUploaded(true);
        startBackgroundReadback();
        setShowOneLiner(true);
      }, 1300);
    } else if (screen < 11) {
      goTo((screen + 1) as Screen);
    } else if (screen === 11) {
      setShowFinalSummary(true);
    }
  };

  if (!authChecked) {
    return (
      <div className="onboarding-loading bruddle" role="status" aria-live="polite">
        <span style={{ fontSize: 40, lineHeight: 1 }} aria-hidden="true">🥬</span>
        <div className="onboarding-loading__spinner" aria-hidden="true" />
        <span>One sec…</span>
      </div>
    );
  }

  const headerScreen = (screen === 12 ? 11 : screen) as Screen;
  const showProcessingBanner = screen === 0 && (resumeUploading || readbackStatus === "loading");

  return (
    <div style={{ background: "var(--scout-page)" }}>
      <input
        id="scout-file"
        type="file"
        accept=".pdf,.doc,.docx"
        style={{ display: "none" }}
        onChange={onFileChange}
      />
      <div className="onboarding-shell bruddle">
        <ScoutHeader screen={headerScreen} />
        <div className="onboarding-content">
          {/* Pre-flow: career intent */}
          {!intentDone && (
            <ScreenCareerIntent onSelect={onCareerIntentSelect} />
          )}
          {/* Pre-flow: start-from-scratch one-liner */}
          {intentDone && showOneLiner && (
            <ScreenOneLiner
              initialValue={profileOneLiner}
              importBanner={onelinerImportBanner}
              onContinue={(text) => void onOneLinerSubmit(text)}
              onBack={() => {
                setShowOneLiner(false);
                setOnelinerImportBanner(null);
              }}
              loading={onelinerAnalyzing}
            />
          )}
          {/* Final summary overlay */}
          {intentDone && !showOneLiner && showFinalSummary && (
            <ScreenFinalSummary
              readbackData={readbackData}
              profile={{
                targetRoles: selectedTitles,
                targetMarket,
                workArrangement,
                targetSalary,
                jobTimeline,
                deprioritizedCategories,
                prioritizedCategories,
                headline: profileOneLiner,
                visaNeed,
              } satisfies FinalSummaryProfile}
              onConfirm={onFinalSummaryConfirm}
              onBack={onFinalSummaryBack}
            />
          )}
          {/* Main onboarding screens */}
          {intentDone && !showOneLiner && !showFinalSummary && showProcessingBanner && (
            <OnboardingProcessingBanner
              resumeUploading={resumeUploading}
              readbackLoading={readbackStatus === "loading"}
            />
          )}
          {intentDone && !showOneLiner && !showFinalSummary && screen === 0 && (
            <ScreenWelcome
              resumeFilename={resumeFilename}
              resumeUploaded={resumeUploaded}
              resumeUploading={resumeUploading}
              resumeError={resumeError}
              isDragging={isDragging}
              liInput={liInput}
              linkedinImportAvailable={linkedinImportAvailable}
              linkedinImporting={linkedinImporting}
              onLIChange={onLIChange}
              onLIKey={onLIKey}
              onContinue={onWelcomeContinue}
              onLinkedInOnly={() => void onLinkedInOnly()}
              onStartFromScratch={onSkipProfile}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onFileClick={onFileClick}
              onFileChange={onFileChange}
            />
          )}
          {intentDone && !showOneLiner && !showFinalSummary && (
            <>
              {screen === 1 && (
                <ScreenReadBack
                  data={readbackData}
                  status={readbackStatus}
                  onConfirm={onReadBackConfirm}
                  onRefine={onReadBackRefine}
                  onSkip={onReadBackSkip}
                />
              )}
              {screen === 2 && (
                <ScreenTargetRoles
                  selectedTitles={selectedTitles}
                  suggestedTitles={readbackRoleSuggestions}
                  suggestionLabel="Suggested for you"
                  prioritizedCategories={prioritizedCategories}
                  suggestedCategories={suggestedPrioritizedCategories}
                  onAddCategory={onAddPrioritizedCategory}
                  onRemoveCategory={onRemovePrioritizedCategory}
                  onAddTitle={onAddTargetRole}
                  onRemoveTitle={onRemoveTargetRole}
                  onContinue={onRolesContinue}
                  onSkip={onRolesSkip}
                />
              )}
              {screen === 3 && selectedTitles.length >= 2 && (
                <ScreenOnboardingPriorityRole
                  targetRoles={selectedTitles}
                  priorityRole={priorityRole}
                  onPriorityRoleChange={setPriorityRole}
                  onContinue={() => void onPriorityContinue()}
                  onSkip={onPrioritySkip}
                  onBack={() => goTo(2)}
                />
              )}
              {screen === 4 && (
                <ScreenOnboardingLocation
                  targetMarket={targetMarket}
                  locationHint={locationHint ?? onelinerLocationHint}
                  onTargetMarketChange={setTargetMarket}
                  onContinue={() => void onLocationContinue()}
                  onBack={() => goTo(selectedTitles.length >= 2 ? 3 : 2)}
                />
              )}
              {screen === 5 && (
                <ScreenOnboardingWorkArrangement
                  workArrangement={workArrangement}
                  onWorkArrangementChange={setWorkArrangement}
                  onContinue={() => void onWorkArrangementContinue()}
                  onSkip={() => void onWorkArrangementSkip()}
                  onBack={() => goTo(4)}
                />
              )}
              {screen === 6 && (
                <ScreenOnboardingRelocation
                  relocation={relocation}
                  onRelocationChange={setRelocation}
                  onContinue={() => void onRelocationContinue()}
                  onSkip={() => void onRelocationSkip()}
                  onBack={() => goTo(5)}
                />
              )}
              {screen === 7 && (
                <ScreenOnboardingVisa
                  visaNeed={visaNeed}
                  onVisaNeedChange={setVisaNeed}
                  onContinue={() => void onVisaContinue()}
                  onSkip={() => void onVisaSkip()}
                  onBack={() => goTo(6)}
                />
              )}
              {screen === 8 && (
                <ScreenOnboardingSalary
                  targetSalary={targetSalary}
                  onTargetSalaryChange={setTargetSalary}
                  onContinue={() => void onSalaryContinue()}
                  onSkip={() => void onSalarySkip()}
                  onBack={() => goTo(7)}
                />
              )}
              {screen === 9 && (
                <ScreenOnboardingTimeline
                  jobTimeline={jobTimeline}
                  onJobTimelineChange={setJobTimeline}
                  onContinue={() => void onTimelineContinue()}
                  onSkip={() => void onTimelineSkip()}
                  onBack={() => goTo(8)}
                />
              )}
              {screen === 10 && (
                <ScreenOnboardingAvoidRoles
                  deprioritizedCategories={deprioritizedCategories}
                  suggestedCategories={suggestedDeprioritizedCategories}
                  onAddAvoidCategory={onAddAvoidCategory}
                  onRemoveAvoidCategory={onRemoveAvoidCategory}
                  onContinue={() => void onAvoidContinue()}
                  onSkip={() => void onAvoidSkip()}
                  onBack={() => goTo(9)}
                />
              )}
              {screen === 11 && (
                <ScreenTargetCompanies
                  selectedCompanies={selectedCompanies}
                  targetRoles={selectedTitles}
                  prioritizedRoles={priorityRole ? [priorityRole] : []}
                  readbackData={readbackData}
                  onAddCompany={onAddTargetCompany}
                  onRemoveCompany={onRemoveTargetCompany}
                  onContinue={onCompaniesContinue}
                  onSkip={onCompaniesSkip}
                />
              )}
              {screen === 12 && <ScreenSetup steps={setupSteps} />}
            </>
          )}
        </div>
      </div>
      {process.env.NODE_ENV === "development" && screen !== 12 && <DemoNextButton onClick={demoAdvance} />}
    </div>
  );
}
