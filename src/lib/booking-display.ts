import type { CoachBookingStatus } from "@prisma/client";

export type BookingRow = {
  id: string;
  coachProfileId?: string;
  coachName: string;
  coachSlug: string | null;
  coachPhotoUrl?: string | null;
  coachEmail?: string | null;
  guestName: string | null;
  guestEmail: string | null;
  title: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  status: CoachBookingStatus | string;
  nylasBookingRef?: string | null;
  configurationId?: string | null;
};

export function formatBookingWhen(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const date = s.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = `${s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – ${e.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  return { date, time };
}

export function bookingStatusLabel(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "Confirmed";
    case "PENDING":
      return "Pending";
    case "CANCELLED":
      return "Cancelled";
    case "RESCHEDULED":
      return "Rescheduled";
    default:
      return status;
  }
}

export function bookingStatusColor(status: string): { bg: string; color: string } {
  switch (status) {
    case "CONFIRMED":
      return { bg: "rgba(45,122,80,0.1)", color: "#2d7a50" };
    case "PENDING":
      return { bg: "rgba(217,119,6,0.1)", color: "#b45309" };
    case "CANCELLED":
      return { bg: "rgba(220,38,38,0.08)", color: "#dc2626" };
    case "RESCHEDULED":
      return { bg: "rgba(37,99,235,0.1)", color: "#2563eb" };
    default:
      return { bg: "rgba(160,152,144,0.12)", color: "#78716c" };
  }
}
