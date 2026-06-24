export const ONBOARDING_FINISH_KEY = "kimchi-onboarding-finish";

export interface OnboardingFinishPayload {
  primaryAssetId?: string;
  jobDescription?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  jobId?: string | null;
  autoRunMatch?: boolean;
}

export function readOnboardingFinishPayload(): OnboardingFinishPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ONBOARDING_FINISH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingFinishPayload;
  } catch {
    return null;
  }
}

export function writeOnboardingFinishPayload(payload: OnboardingFinishPayload) {
  sessionStorage.setItem(ONBOARDING_FINISH_KEY, JSON.stringify(payload));
}

export function clearOnboardingFinishPayload() {
  sessionStorage.removeItem(ONBOARDING_FINISH_KEY);
}
