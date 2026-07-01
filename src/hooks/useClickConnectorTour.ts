"use client";

import { useCallback } from "react";
import {
  attachTourBeforeShow,
  cancelProductTour,
  startProductTour,
  type StartProductTourOptions,
  type TourBeforeShowFn,
} from "@/lib/clickconnector-tour";

export function useClickConnectorTour() {
  const start = useCallback(
    (options?: StartProductTourOptions) => startProductTour(options),
    [],
  );
  const cancel = useCallback(() => cancelProductTour(), []);
  const attachBeforeShow = useCallback(
    (stepNumber: number, fn: TourBeforeShowFn) =>
      attachTourBeforeShow(stepNumber, fn),
    [],
  );

  return {
    startProductTour: start,
    cancelProductTour: cancel,
    attachTourBeforeShow: attachBeforeShow,
  };
}
