/** Shared types for coach marketplace directory + profile. */

export type CoachListItem = {
  id: string;
  slug: string | null;
  displayName: string;
  headline: string | null;
  bio: string | null;
  currentRole: string | null;
  currentCompany: string | null;
  location: string | null;
  photoUrl: string | null;
  firms: string[];
  schools: string[];
  specialties: string[];
  industries: string[];
  clientSpecializations: string[];
  hourlyRate: number | null;
  category: string | null;
  featured: boolean;
  isProfessionalCoach: boolean;
  isInternal?: boolean;
  requiresAssignment?: boolean;
  avgRating: number | null;
  reviewCount: number;
  followerCount: number;
  calLink?: string | null;
  nylasSchedulerConfigId?: string | null;
  hasNylasBooking?: boolean;
  linkedinUrl?: string | null;
  createdAt?: string;
  matchScore?: number;
  matchLabel?: string;
  matchReasons?: string[];
  matchedSkills?: string[];
  spotlightBadge?: CoachSpotlightBadge | null;
  isFollowing?: boolean;
  isInternal?: boolean;
};

import type { CoachSharedDocumentView } from "@/lib/coach-shared-documents";
import type { LiveSessionView } from "@/lib/live-session-types";

export type CoachSpotlightBadge = "featured" | "new" | "top-rated" | "rising";

export type CoachMatchFields = {
  matchScore: number;
  matchLabel: string;
  matchReasons: string[];
  matchedSkills: string[];
};

export type CoachReviewItem = {
  id: string;
  authorName: string;
  coachedFor: string | null;
  rating: number;
  knowledge: number;
  value: number;
  responsiveness: number;
  supportiveness: number;
  message: string;
  createdAt: string;
};

export type CoachReviewAggregates = {
  avgRating: number;
  reviewCount: number;
  knowledge: number;
  value: number;
  responsiveness: number;
  supportiveness: number;
};

export type CoachProfileDetail = CoachListItem & {
  linkedinUrl: string | null;
  calLink: string | null;
  nylasSchedulerConfigId: string | null;
  hasNylasBooking: boolean;
  schedulerDurationMinutes?: number;
  experienceLevel: string | null;
  clientTier: string | null;
  industryYears: number | null;
  whyCoach: string | null;
  aboutMe: string | null;
  isFollowing: boolean;
  isMyCoach?: boolean;
  aggregates: CoachReviewAggregates | null;
  reviews: CoachReviewItem[];
  purchasablePackages?: Array<{
    id: string;
    displayTitle: string;
    displayHoursLabel: string;
    displayPriceLabel: string | null;
    displayPriceCents: number | null;
    hoursGranted?: number;
    hours: number;
  }>;
  upcomingLiveSessions?: LiveSessionView[];
  pastRecordings?: LiveSessionView[];
  publicResources?: CoachSharedDocumentView[];
  clientWins?: string[];
};

export type CoachDirectoryFilters = {
  category?: string;
  q?: string;
  firm?: string;
  specialty?: string;
  specialization?: string;
  rateMin?: number;
  rateMax?: number;
  featuredOnly?: boolean;
  professionalOnly?: boolean;
  internalOnly?: boolean;
  sort?: "default" | "price-low" | "price-high" | "rating" | "newest" | "match";
};

export type CoachFeaturedPreset = "popular" | "professional" | "budget";
