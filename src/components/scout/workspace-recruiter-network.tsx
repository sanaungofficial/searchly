"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import type { JobMeta } from "@/lib/job-meta";
import { findPipelineCardByUrl } from "@/lib/cached-job";
import type { KanbanCard } from "./workspace-data";
import { PipelineNetworkSection } from "./pipeline-network-section";
import { WorkspaceContent, WorkspaceScroll } from "./workspace-content";
import type { NetworkJobListing } from "@/lib/network-job-display";
import { buildNetworkProspectCard } from "@/lib/network-job-display";
import { canViewNetworkJobInternal } from "@/lib/network-job-access";
import {
  NETWORK_ROLES_PATH,
  networkJobUrl,
  parseNetworkRolesLocation,
  pipelineJobUrl,
} from "@/lib/workspace-urls";
import { JobDrawer } from "./job-drawer";

export function WorkspaceRecruiterNetwork() {
  const {
    kanbanCards,
    addJob,
    isAdmin,
    userRole,
    isImpersonating,
    actingUserId,
    withClientScope,
    withClientReviewPath,
  } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const loc = parseNetworkRolesLocation(pathname);
  const go = useCallback(
    (path: string) => router.push(withClientReviewPath(path)),
    [router, withClientReviewPath],
  );

  const [networkProspectJob, setNetworkProspectJob] = useState<NetworkJobListing | null>(null);
  const [networkProspectCard, setNetworkProspectCard] = useState<
    (KanbanCard & { _url?: string; _meta?: JobMeta }) | null
  >(null);
  const [addingNetworkJob, setAddingNetworkJob] = useState(false);

  const loadedNetworkJobRef = useRef<string | null>(null);
  const pendingNetworkNavRef = useRef<string | null>(null);
  const networkInternalView = canViewNetworkJobInternal(userRole, isAdmin, isImpersonating);

  const closeNetworkDrawer = () => {
    pendingNetworkNavRef.current = null;
    if (loc.jobId) loadedNetworkJobRef.current = loc.jobId;
    else loadedNetworkJobRef.current = null;
    setNetworkProspectJob(null);
    setNetworkProspectCard(null);
    setAddingNetworkJob(false);
    go(NETWORK_ROLES_PATH);
  };

  const openNetworkJob = useCallback(
    (job: NetworkJobListing) => {
      pendingNetworkNavRef.current = job.id;
      loadedNetworkJobRef.current = job.id;
      go(networkJobUrl(job.id));
      const drawerId = -Math.abs(Date.now() % 1_000_000);
      setNetworkProspectJob(job);
      setNetworkProspectCard(
        buildNetworkProspectCard(job, drawerId, { internalView: networkInternalView }),
      );
    },
    [go, networkInternalView],
  );

  useEffect(() => {
    if (!loc.jobId) {
      if (pendingNetworkNavRef.current) return;
      loadedNetworkJobRef.current = null;
      setNetworkProspectJob(null);
      setNetworkProspectCard(null);
      return;
    }
    if (loc.jobId === pendingNetworkNavRef.current) {
      pendingNetworkNavRef.current = null;
    }
    if (loadedNetworkJobRef.current === loc.jobId) return;
    loadedNetworkJobRef.current = loc.jobId;
    void (async () => {
      try {
        const res = await fetch(withClientScope(`/api/network-jobs/${encodeURIComponent(loc.jobId!)}`));
        const data = (await res.json().catch(() => ({}))) as { job?: NetworkJobListing };
        if (res.ok && data.job) {
          const drawerId = -Math.abs(Date.now() % 1_000_000);
          setNetworkProspectJob(data.job);
          setNetworkProspectCard(
            buildNetworkProspectCard(data.job, drawerId, { internalView: networkInternalView }),
          );
        }
      } catch {
        // ignore
      }
    })();
  }, [loc.jobId, networkInternalView, withClientScope]);

  const addNetworkJobToPipeline = async (job: NetworkJobListing = networkProspectJob!) => {
    if (!job) return;
    setAddingNetworkJob(true);
    try {
      const card = buildNetworkProspectCard(job, 0, { internalView: networkInternalView });
      const meta = card._meta;
      const created = await addJob(
        job.companyName ?? job.recruiter?.agencyName ?? "Confidential employer",
        job.positionTitle,
        job.topEchelonUrl ?? undefined,
        meta,
      );
      loadedNetworkJobRef.current = null;
      setNetworkProspectJob(null);
      setNetworkProspectCard(null);
      if (created) {
        go(pipelineJobUrl(created.id));
      } else {
        go(NETWORK_ROLES_PATH);
      }
    } finally {
      setAddingNetworkJob(false);
    }
  };

  const existingNetworkPipelineCard = networkProspectJob
    ? findPipelineCardByUrl(kanbanCards, networkProspectJob.topEchelonUrl)
    : null;

  return (
    <div
      className="bruddle"
      style={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--scout-page)",
        animation: "fadeIn 0.3s ease both",
      }}
    >
      <WorkspaceScroll>
        <WorkspaceContent>
          <PipelineNetworkSection
            onOpenJob={openNetworkJob}
            onSaveJob={addNetworkJobToPipeline}
            actingUserId={actingUserId}
          />
        </WorkspaceContent>
      </WorkspaceScroll>

      {networkProspectCard && networkProspectJob && (
        <JobDrawer
          card={networkProspectCard}
          onClose={closeNetworkDrawer}
          moveCard={() => {}}
          onDelete={closeNetworkDrawer}
          onCardUpdate={() => {}}
          prospectMode
          elevated
          onAddToPipeline={
            existingNetworkPipelineCard ? undefined : () => addNetworkJobToPipeline(networkProspectJob)
          }
          addingToPipeline={addingNetworkJob}
          existingPipelineCardId={existingNetworkPipelineCard?.id ?? null}
          onOpenInPipeline={
            existingNetworkPipelineCard
              ? () => {
                  const ext = existingNetworkPipelineCard as KanbanCard & { _dbId?: string };
                  closeNetworkDrawer();
                  if (ext._dbId) go(pipelineJobUrl(ext._dbId));
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
