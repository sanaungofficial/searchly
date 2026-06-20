"use client";

import { useState, useEffect, useRef } from "react";
import {
  SKILLS_LIST,
  SKILLS_SUGGESTED,
  PROFILE_SUGGESTIONS,
  ROLE_ARCHETYPES,
  AVAILABLE_ROLES,
  UPSKILL_CATEGORIES,
} from "./workspace-data";
import { SparkleIcon } from "./workspace-icons";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EducationEntry {
  id: string;
  school: string;
  degree: string;
  field?: string | null;
  from?: string | null;
  to?: string | null;
}

interface WorkEntry {
  id: string;
  company: string;
  title: string;
  description?: string | null;
  from?: string | null;
  to?: string | null;
  bullets: string[];
}

interface ParsedData {
  name?: string | null;
  phone?: string | null;
  location?: string | null;
  website?: string | null;
  education: EducationEntry[];
  workExperience: WorkEntry[];
  skills: string[];
}

interface UserProfile {
  name: string;
  email: string | null;
  resumeUrl: string | null;
  linkedinUrl: string | null;
  headline: string | null;
  targetRoles: string[];
  parsedData: ParsedData | null;
}

type ProfileTab = "dreamrole" | "personal" | "education" | "experience" | "skills" | "learning" | "assets";

