import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export const CLICKCONNECTOR_WIDGET_ID = "5efd60-6hvno";
export const CLICKCONNECTOR_PRODUCT_TOUR_ID = "5efd60-7c13e-c95a5";

export const PRODUCT_TOUR_SEEN_KEY = "kimchi_tour_seen";

/** Time to wait after router.push before the tour step highlights DOM. */
const TOUR_NAV_SETTLE_MS = 450;

type ChatWidgetClass = typeof import("@clickconnector/widget-sdk").ChatWidget;

export type TourBeforeShowFn = () => void | Promise<void>;

async function withChatWidget<T>(
  fn: (ChatWidget: ChatWidgetClass) => T | Promise<T>,
): Promise<T | undefined> {
  if (typeof window === "undefined") return undefined;

  const { ChatWidget } = await import("@clickconnector/widget-sdk");

  if (!ChatWidget.isLoaded) {
    await ChatWidget.load(CLICKCONNECTOR_WIDGET_ID);
  }

  await ChatWidget.waitForWidgetReady().catch(() => undefined);
  return fn(ChatWidget);
}

/**
 * ClickConnector tour steps are 1-based. When a step highlights UI on another
 * Kimchi page, map the step number to an App Router path here.
 *
 * Update this record when you edit tour steps in the ClickConnector console.
 * Step 1 anchors on Opportunities; map it here so manual starts from other pages
 * navigate before the spotlight renders.
 *
 * @example
 * ```ts
 * export const TOUR_STEP_ROUTES = {
 *   1: "/opportunities",
 *   3: "/profile",
 *   4: "/coaching",
 * };
 * ```
 */
export const TOUR_STEP_ROUTES: Partial<Record<number, string>> = {
  1: "/opportunities",
};

export function hasSeenProductTour(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(PRODUCT_TOUR_SEEN_KEY) === "1";
}

export function markProductTourSeen(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PRODUCT_TOUR_SEEN_KEY, "1");
}

export function clearProductTourSeen(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PRODUCT_TOUR_SEEN_KEY);
}

function navigateForTour(router: AppRouterInstance, path: string): Promise<void> {
  return new Promise((resolve) => {
    router.push(path);
    window.setTimeout(resolve, TOUR_NAV_SETTLE_MS);
  });
}

/**
 * Registers attachTourBeforeShow hooks for each entry in {@link TOUR_STEP_ROUTES}.
 * Call once from a client component that has access to Next.js `useRouter()`.
 */
export function registerTourStepNavigation(router: AppRouterInstance): void {
  for (const [step, path] of Object.entries(TOUR_STEP_ROUTES)) {
    if (!path) continue;
    attachTourBeforeShow(Number(step), () => navigateForTour(router, path));
  }
}

/**
 * Runs async work before ClickConnector shows a tour step (e.g. route change).
 * The SDK resolves the provided promise before rendering the step spotlight.
 */
export function attachTourBeforeShow(
  stepNumber: number,
  fn: TourBeforeShowFn,
): void {
  void withChatWidget((ChatWidget) => {
    ChatWidget.attachTourBeforeShow(stepNumber, Promise.resolve().then(fn));
  });
}

export type StartProductTourOptions = {
  /** When true, skips starting if the user has already seen the tour. */
  auto?: boolean;
  /** When true, does not persist kimchi_tour_seen (for manual replays from settings). */
  skipMarkSeen?: boolean;
};

export async function startProductTour(
  options: StartProductTourOptions = {},
): Promise<boolean> {
  if (options.auto && hasSeenProductTour()) return false;

  await withChatWidget((ChatWidget) => {
    ChatWidget.startTour(CLICKCONNECTOR_PRODUCT_TOUR_ID);
  });

  if (!options.skipMarkSeen) {
    markProductTourSeen();
  }

  return true;
}

export async function cancelProductTour(): Promise<void> {
  await withChatWidget((ChatWidget) => {
    ChatWidget.cancelTour();
  });
}
