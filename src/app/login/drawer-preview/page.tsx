"use client";

import { notFound } from "next/navigation";
import { useState } from "react";
import { JobDrawer } from "@/components/scout/job-drawer";
import type { KanbanCard } from "@/components/scout/workspace-data";

const MOCK_CARD = {
  id: 1,
  company: "The Motley Fool",
  initials: "TM",
  role: "Senior Lifecycle Marketing Manager",
  stage: "saved",
  fit: 89,
  jobRef: null,
  days: 7,
  _dbId: "preview-id",
  _url: "https://boards.greenhouse.io/themotleyfool/jobs/123",
  _meta: {
    location: "United States",
    salary: "$120k/yr – $160k/yr",
    jobType: "Full-time",
    remote: true,
    seniority: "Senior Level",
    description:
      "The Motley Fool is seeking a Senior Lifecycle Marketing Manager to own email and lifecycle programs across our member base.\n\n• Design and execute lifecycle campaigns across onboarding, engagement, and retention\n• Partner with product and analytics to define segmentation strategy\n• Manage HubSpot workflows and SQL-based reporting\n• Lead A/B testing roadmap for email and in-app channels",
    requirements: ["Lifecycle marketing", "HubSpot", "SQL", "Email automation", "A/B testing"],
    tags: ["Consulting", "Finance", "Marketing"],
  },
} as KanbanCard & { _dbId: string; _url: string; _meta: NonNullable<unknown> };

/** Dev-only: preview JobDrawer without auth at /login/drawer-preview */
export default function DevJobDrawerPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const [open, setOpen] = useState(true);

  return (
    <div style={{ minHeight: "100vh", background: "#E8E4DE", padding: 24 }}>
      <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "#5C534A", marginBottom: 12 }}>
        Dev preview — JobDrawer (JobRight-style layout)
      </p>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{ padding: "10px 16px", background: "#1A3A2F", color: "#E8D5A3", border: "none", borderRadius: 8, cursor: "pointer" }}
        >
          Open drawer
        </button>
      )}
      {open && (
        <JobDrawer
          card={MOCK_CARD}
          onClose={() => setOpen(false)}
          moveCard={() => {}}
          onDelete={() => setOpen(false)}
          onCardUpdate={() => {}}
        />
      )}
    </div>
  );
}
