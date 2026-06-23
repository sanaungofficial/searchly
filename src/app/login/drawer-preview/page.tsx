"use client";

import { notFound } from "next/navigation";
import { useState } from "react";
import { JobDrawer } from "@/components/scout/job-drawer";
import type { KanbanCard } from "@/components/scout/workspace-data";
import type { JobMeta } from "@/lib/job-meta";

const MOCK_META: JobMeta = {
  location: "United States",
  salary: "$75/hr – $80/hr",
  jobType: "Full-time",
  remote: true,
  seniority: "Senior Level",
  jobSummary: "Develop and implement strategic host lifecycle marketing programs.",
  companySummary: "Akraya is your trusted partner for Digital Transformation.",
  description: "Full posting text retained for search and match.",
  responsibilities: ["Develop lifecycle marketing programs", "Partner with product on segmentation", "Lead A/B testing roadmap"],
  skills: ["Email Marketing", "CRM Strategy", "Data Analysis", "A/B Testing"],
  requiredQualifications: ["Email Marketing (advanced)", "CRM Strategy (advanced)"],
  preferredQualifications: ["Experience in travel or marketplace industry"],
  benefits: ["W2"],
  tags: ["Consulting", "Staffing Agency"],
};

const MOCK_CARD = {
  id: 1,
  company: "Akraya, Inc.",
  initials: "AI",
  role: "Senior Growth Marketing Manager (Host): 26-01782",
  stage: "saved",
  fit: 98,
  jobRef: null,
  days: 0,
  _dbId: "preview-id",
  _url: "https://example.com/jobs/2601782",
  _meta: MOCK_META,
} as KanbanCard & { _dbId: string; _url: string; _meta: JobMeta };

export default function DevJobDrawerPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const [open, setOpen] = useState(true);
  return (
    <div style={{ minHeight: "100vh", background: "#E8E4DE", padding: 24 }}>
      <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "#5C534A", marginBottom: 12 }}>Dev preview — JobDrawer (JobRight fields)</p>
      {!open && <button type="button" onClick={() => setOpen(true)} style={{ padding: "10px 16px", background: "#1A3A2F", color: "#E8D5A3", border: "none", borderRadius: 8, cursor: "pointer" }}>Open drawer</button>}
      {open && <JobDrawer card={MOCK_CARD} onClose={() => setOpen(false)} moveCard={() => {}} onDelete={() => setOpen(false)} onCardUpdate={() => {}} />}
    </div>
  );
}
