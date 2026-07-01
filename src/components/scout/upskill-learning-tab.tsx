"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  findProgramsForSkill,
  skillGoalGapSourceLabel,
  type SkillGoalRecord,
  type UpskillProgram,
  type UpskillProgressMap,
} from "@/lib/upskill-programs";
import { corpusGapsForRole, type RoleCorpusGapsCache } from "@/lib/job-corpus-gaps";
import { SKILLS_GROUP_LABEL, TOOLS_GROUP_LABEL } from "@/lib/skills-tools";
import {
  ScoutBox,
  ScoutDisplayTitle,
  ScoutInsetBox,
  ScoutLabel,
  ScoutPrimaryBtn,
  ScoutSecondaryBtn,
  scoutFieldStyle,
  scoutInsetChipStyle,
  BRUDDLE_CARD_HOVER_CLASS,
} from "@/components/scout/scout-box";
import { ScoreExplainerPopover } from "@/components/scout/score-explainer-popover";
import { bruddleHeadingStyle, color, displayTitleStyle, fontSans, surface, type as T } from "@/lib/typography";

const CUSTOM_LEARNING_KEY = "kimchi_custom_learning";

type SkillGoal = SkillGoalRecord;

interface CustomLearningItem {
  id: string;
  name: string;
  url?: string;
  platform?: string;
  duration?: string;
  status: "none" | "inprogress" | "completed";
  addedAt: string;
}

function formatLastRefreshed(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function UpskillSectionLabel({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: "upskill-recommendations" | "upskill-progress";
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <ScoutLabel>{children}</ScoutLabel>
      <ScoreExplainerPopover variant={variant} />
    </span>
  );
}

function groupSkillGoalsByRole(
  goals: SkillGoal[],
  roleOrder: string[],
): { role: string; goals: SkillGoal[] }[] {
  const map = new Map<string, SkillGoal[]>();
  for (const goal of goals) {
    const role = goal.role.trim() || "General";
    const list = map.get(role) ?? [];
    list.push(goal);
    map.set(role, list);
  }
  const orderedRoles = [
    ...roleOrder.filter((role) => map.has(role)),
    ...[...map.keys()].filter((role) => !roleOrder.includes(role)).sort((a, b) => a.localeCompare(b)),
  ];
  return orderedRoles.map((role) => ({ role, goals: map.get(role)! }));
}

function groupGoalsByKind(goals: SkillGoal[]): { label: string; goals: SkillGoal[] }[] {
  return [
    { label: TOOLS_GROUP_LABEL, goals: goals.filter((g) => g.kind === "technology") },
    { label: SKILLS_GROUP_LABEL, goals: goals.filter((g) => g.kind !== "technology") },
  ].filter((group) => group.goals.length > 0);
}

function kimchiPickChipStyle(): React.CSSProperties {
  return {
    ...scoutInsetChipStyle,
    background: "var(--bruddle-cream)",
    color: color.bruddleInk,
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  };
}

function searchFallbackChipStyle(): React.CSSProperties {
  return {
    ...scoutInsetChipStyle,
    background: surface.inset,
    color: color.muted,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  };
}

function ProgramCard({
  program,
  isMobile,
  onProgress,
  progress,
}: {
  program: UpskillProgram;
  isMobile: boolean;
  progress: "none" | "inprogress" | "completed";
  onProgress: (status: "none" | "inprogress" | "completed") => void;
}) {
  const isKimchiPick = program.kimchiPick === true || program.source === "catalog";
  const statusLabel =
    progress === "completed" ? "Completed" : progress === "inprogress" ? "In progress" : "Not started";

  return (
    <ScoutBox
      padding={isMobile ? "12px 14px" : "14px 16px"}
      flat={!isKimchiPick}
      style={
        isKimchiPick
          ? {
              borderLeft: `4px solid ${color.purple}`,
              background: "var(--scout-cta-subtle)",
            }
          : {
              background: surface.inset,
              borderStyle: "dashed",
            }
      }
    >
      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "stretch" : "flex-start",
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
            <span style={isKimchiPick ? kimchiPickChipStyle() : searchFallbackChipStyle()}>
              {isKimchiPick ? "Kimchi pick" : "Search"}
            </span>
            {program.type === "certification" && (
              <span style={scoutInsetChipStyle}>Certification</span>
            )}
          </div>
          <a
            href={program.url}
            target="_blank"
            rel="noopener noreferrer"
            className={BRUDDLE_CARD_HOVER_CLASS}
            style={{
              display: "block",
              fontFamily: fontSans,
              fontSize: T.body,
              fontWeight: 600,
              color: color.ink,
              textDecoration: "none",
              lineHeight: 1.35,
              marginBottom: 4,
            }}
          >
            {program.name} ↗
          </a>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 4px", lineHeight: 1.5 }}>
            {[program.platform, program.duration, program.credential].filter(Boolean).join(" · ")}
          </p>
          {program.why && isKimchiPick && (
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, margin: 0, lineHeight: 1.55 }}>
              {program.why}
            </p>
          )}
          <p
            style={{
              fontFamily: fontSans,
              fontSize: T.caption,
              color: progress === "completed" ? color.forest : progress === "inprogress" ? "#7A6020" : color.mutedLight,
              margin: "8px 0 0",
              fontWeight: 600,
            }}
          >
            {statusLabel}
          </p>
        </div>
        <div style={{ display: "flex", flexShrink: 0, alignItems: "center" }}>
          {progress === "completed" ? (
            <ScoutSecondaryBtn
              onClick={() => onProgress("inprogress")}
              style={{ minHeight: 44, width: isMobile ? "100%" : undefined, color: color.forest }}
            >
              Review
            </ScoutSecondaryBtn>
          ) : (
            <ScoutPrimaryBtn
              onClick={() => onProgress(progress === "none" ? "inprogress" : "completed")}
              style={{ minHeight: 44, width: isMobile ? "100%" : undefined }}
            >
              {progress === "inprogress" ? "Complete" : "Start"}
            </ScoutPrimaryBtn>
          )}
        </div>
      </div>
    </ScoutBox>
  );
}

function SkillGoalCard({
  goal,
  isMobile,
  isHighlighted,
  progress,
  setProgress,
  onGraduate,
  onDismiss,
  graduating,
  cardRef,
}: {
  goal: SkillGoal;
  isMobile: boolean;
  isHighlighted: boolean;
  progress: UpskillProgressMap;
  setProgress: (p: UpskillProgressMap) => void;
  onGraduate: (skill: string) => Promise<void>;
  onDismiss: (skill: string, role: string) => void;
  graduating: string | null;
  cardRef?: (el: HTMLDivElement | null) => void;
}) {
  const programs = goal.programs.length ? goal.programs : findProgramsForSkill(goal.skill);
  const kimchiPrograms = programs.filter((p) => p.kimchiPick === true || p.source === "catalog");
  const searchPrograms = programs.filter((p) => !p.kimchiPick && p.source === "search");

  const setProgramProgress = (id: string, status: "none" | "inprogress" | "completed") => {
    setProgress({ ...progress, [id]: status });
  };

  const getProgramProgress = (id: string) => progress[id] ?? "none";

  return (
    <ScoutBox
      padding={isMobile ? "14px 16px" : "16px 18px"}
      style={{
        borderColor: isHighlighted ? color.purple : undefined,
        boxShadow: isHighlighted ? "var(--scout-shadow-bruddle)" : undefined,
      }}
    >
      <div ref={cardRef}>
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: kimchiPrograms.length + searchPrograms.length > 0 ? 16 : 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: fontSans, fontSize: T.body, fontWeight: 600, color: color.ink, margin: 0 }}>
              {goal.skill}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              <span style={scoutInsetChipStyle}>
                {goal.kind === "technology" ? TOOLS_GROUP_LABEL : SKILLS_GROUP_LABEL}
              </span>
              {skillGoalGapSourceLabel(goal.gapSource) && (
                <span style={{ ...scoutInsetChipStyle, background: "rgba(26,58,47,0.06)", color: color.forest }}>
                  {skillGoalGapSourceLabel(goal.gapSource)}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <ScoutPrimaryBtn
              onClick={() => onGraduate(goal.skill)}
              disabled={graduating === goal.skill}
              style={{
                minHeight: 44,
                width: isMobile ? "100%" : undefined,
                opacity: graduating === goal.skill ? 0.6 : 1,
                flexShrink: 0,
              }}
            >
              {graduating === goal.skill ? "Saving…" : "Mark acquired"}
            </ScoutPrimaryBtn>
            <button
              type="button"
              onClick={() => onDismiss(goal.skill, goal.role)}
              aria-label={`Remove ${goal.skill}`}
              style={{
                background: "none",
                border: "none",
                color: color.muted,
                cursor: "pointer",
                fontSize: 20,
                lineHeight: 1,
                padding: "8px 10px",
                minHeight: 44,
              }}
            >
              ×
            </button>
          </div>
        </div>

        {kimchiPrograms.length > 0 && (
          <div style={{ marginBottom: searchPrograms.length > 0 ? 14 : 0 }}>
            <p
              style={{
                fontFamily: fontSans,
                fontSize: T.label,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: color.forest,
                margin: "0 0 8px",
              }}
            >
              Kimchi picks
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {kimchiPrograms.map((program) => (
                <ProgramCard
                  key={program.id}
                  program={program}
                  isMobile={isMobile}
                  progress={getProgramProgress(program.id)}
                  onProgress={(status) => setProgramProgress(program.id, status)}
                />
              ))}
            </div>
          </div>
        )}

        {searchPrograms.length > 0 && (
          <div>
            <p
              style={{
                fontFamily: fontSans,
                fontSize: T.label,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: color.muted,
                margin: "0 0 8px",
              }}
            >
              Explore more
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {searchPrograms.map((program) => (
                <ProgramCard
                  key={program.id}
                  program={program}
                  isMobile={isMobile}
                  progress={getProgramProgress(program.id)}
                  onProgress={(status) => setProgramProgress(program.id, status)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </ScoutBox>
  );
}

export function UpskillLearningTab({
  progress,
  setProgress,
  skillGoals,
  dreamList,
  onGraduate,
  onAddSkill,
  onDismissSkill,
  highlightSkill,
  roleCorpusGaps,
  corpusGapsRefreshing,
  onRefreshCorpusGaps,
  onGoToTargetRoles,
}: {
  progress: UpskillProgressMap;
  setProgress: (p: UpskillProgressMap) => void;
  skillGoals: SkillGoal[];
  dreamList: string[];
  onGraduate: (skill: string) => Promise<void>;
  onAddSkill: (skill: string, role: string) => void;
  onDismissSkill: (skill: string, role: string) => void;
  highlightSkill?: string | null;
  roleCorpusGaps: RoleCorpusGapsCache | null;
  corpusGapsRefreshing: boolean;
  onRefreshCorpusGaps: () => void;
  onGoToTargetRoles: () => void;
}) {
  const [graduating, setGraduating] = useState<string | null>(null);
  const skillGoalRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [customItems, setCustomItems] = useState<CustomLearningItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(CUSTOM_LEARNING_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddSkillForm, setShowAddSkillForm] = useState(false);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillRole, setNewSkillRole] = useState("");
  const [customSkillRole, setCustomSkillRole] = useState("");
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newPlatform, setNewPlatform] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const isMobile = useIsMobile();

  const skillGroups = groupSkillGoalsByRole(skillGoals, dreamList);
  const resolvedAddRole =
    newSkillRole === "__custom__" ? customSkillRole.trim() : newSkillRole.trim() || dreamList[0] || "General";

  const unqueuedGapCount = useMemo(() => {
    if (!roleCorpusGaps) return 0;
    const queued = new Set(skillGoals.map((g) => g.skill.toLowerCase()));
    let count = 0;
    for (const role of dreamList) {
      for (const gap of corpusGapsForRole(roleCorpusGaps, role)) {
        if (!queued.has(gap.skill.toLowerCase())) count++;
      }
    }
    return count;
  }, [roleCorpusGaps, dreamList, skillGoals]);

  const learningProgress = useMemo(() => {
    const programIds = new Set<string>();
    for (const goal of skillGoals) {
      const programs = goal.programs.length ? goal.programs : findProgramsForSkill(goal.skill);
      for (const p of programs) programIds.add(p.id);
    }
    let completed = 0;
    let active = 0;
    for (const id of programIds) {
      const status = progress[id];
      if (status === "completed") completed++;
      else if (status === "inprogress") active++;
    }
    for (const item of customItems) {
      if (item.status === "completed") completed++;
      else if (item.status === "inprogress") active++;
    }
    const totalPrograms = programIds.size + customItems.length;
    const skillsWithActivity = skillGoals.filter((g) => {
      const programs = g.programs.length ? g.programs : findProgramsForSkill(g.skill);
      return programs.some((p) => {
        const s = progress[p.id];
        return s === "inprogress" || s === "completed";
      });
    }).length;
    return {
      totalPrograms,
      completed,
      active,
      skillsQueued: skillGoals.length,
      skillsWithActivity,
      pct: totalPrograms > 0 ? Math.round((completed / totalPrograms) * 100) : 0,
    };
  }, [skillGoals, progress, customItems]);

  useEffect(() => {
    if (!highlightSkill) return;
    const key = highlightSkill.toLowerCase();
    skillGoalRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightSkill]);

  const handleGraduate = async (skill: string) => {
    setGraduating(skill);
    await onGraduate(skill);
    setGraduating(null);
  };

  const addSkillToObtain = () => {
    const skill = newSkillName.trim();
    const role = resolvedAddRole || "General";
    if (!skill) return;
    onAddSkill(skill, role);
    setNewSkillName("");
    setNewSkillRole(dreamList[0] ?? "");
    setCustomSkillRole("");
    setShowAddSkillForm(false);
  };

  const saveCustomItems = (items: CustomLearningItem[]) => {
    setCustomItems(items);
    try {
      localStorage.setItem(CUSTOM_LEARNING_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  };

  const addCustomItem = () => {
    if (!newName.trim()) return;
    const item: CustomLearningItem = {
      id: `cl_${Date.now()}`,
      name: newName.trim(),
      url: newUrl.trim() || undefined,
      platform: newPlatform.trim() || undefined,
      duration: newDuration.trim() || undefined,
      status: "none",
      addedAt: new Date().toISOString(),
    };
    saveCustomItems([...customItems, item]);
    setNewName("");
    setNewUrl("");
    setNewPlatform("");
    setNewDuration("");
    setShowAddForm(false);
  };

  const updateCustomStatus = (id: string) => {
    saveCustomItems(
      customItems.map((i) =>
        i.id === id
          ? {
              ...i,
              status:
                i.status === "none" ? "inprogress" : i.status === "inprogress" ? "completed" : "inprogress",
            }
          : i,
      ),
    );
  };

  const removeCustomItem = (id: string) => saveCustomItems(customItems.filter((i) => i.id !== id));

  return (
    <div style={{ width: "100%", paddingBottom: 40 }}>
      {/* Hero */}
      <ScoutBox flat padding={isMobile ? "18px 16px" : "22px 24px"} style={{ marginBottom: 20, background: surface.page }}>
        <ScoutLabel>Upskill</ScoutLabel>
        <ScoutDisplayTitle size={isMobile ? 26 : 32} style={{ marginTop: 8, marginBottom: 8 }}>
          Learn &amp; grow
        </ScoutDisplayTitle>
        <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.muted, margin: 0, lineHeight: 1.6, maxWidth: 560 }}>
          Skills to work on, Kimchi-picked courses, and your own learning — grouped by target role.
        </p>
      </ScoutBox>

      {/* Progress — tied to queued skills, not full catalog */}
      <ScoutBox
        padding={isMobile ? "16px" : "18px 20px"}
        stack
        style={{
          marginBottom: 24,
          background: color.forest,
          border: "var(--scout-border)",
          boxShadow: "var(--scout-shadow-bruddle)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "flex-start" : "center",
            justifyContent: "space-between",
            gap: isMobile ? 16 : 20,
          }}
        >
          <div style={{ flex: 1 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  fontFamily: fontSans,
                  fontSize: T.label,
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "rgba(232,213,163,0.75)",
                }}
              >
                Your learning progress
              </span>
              <ScoreExplainerPopover variant="upskill-progress" light />
            </span>
            <p style={displayTitleStyle(22, { color: color.gold, margin: "8px 0 6px" })}>
              {learningProgress.completed} of {learningProgress.totalPrograms || learningProgress.skillsQueued} complete
            </p>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: "rgba(232,213,163,0.7)", margin: 0, lineHeight: 1.5 }}>
              {learningProgress.skillsQueued} skill{learningProgress.skillsQueued === 1 ? "" : "s"} in queue
              {learningProgress.active > 0 ? ` · ${learningProgress.active} in progress` : ""}
              {learningProgress.skillsWithActivity > 0
                ? ` · ${learningProgress.skillsWithActivity} with active learning`
                : ""}
            </p>
          </div>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: `conic-gradient(var(--bruddle-green) ${learningProgress.pct * 3.6}deg, rgba(152,233,171,0.15) 0)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              border: "2px solid rgba(232,213,163,0.25)",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: color.forest,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontFamily: "var(--font-mono-ui)", fontSize: T.bodySm, fontWeight: 600, color: color.gold }}>
                {learningProgress.pct}%
              </span>
            </div>
          </div>
        </div>
      </ScoutBox>

      {/* Skills to obtain */}
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            <UpskillSectionLabel variant="upskill-recommendations">Skills to obtain</UpskillSectionLabel>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "6px 0 0", lineHeight: 1.5 }}>
              Grouped by target role, then technologies and skills.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {unqueuedGapCount > 0 && (
              <ScoutSecondaryBtn
                onClick={onRefreshCorpusGaps}
                disabled={corpusGapsRefreshing || !dreamList.length}
                style={{ opacity: !dreamList.length ? 0.5 : 1 }}
              >
                {corpusGapsRefreshing ? "Refreshing…" : "Refresh gaps"}
              </ScoutSecondaryBtn>
            )}
            {!showAddSkillForm && (
              <ScoutPrimaryBtn
                onClick={() => {
                  setShowAddSkillForm(true);
                  setNewSkillRole(dreamList[0] ?? "__custom__");
                }}
              >
                + Add skill
              </ScoutPrimaryBtn>
            )}
          </div>
        </div>

        {roleCorpusGaps?.refreshedAt && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 12px", lineHeight: 1.5 }}>
            Market gaps last refreshed {formatLastRefreshed(roleCorpusGaps.refreshedAt)}.
          </p>
        )}

        {showAddSkillForm && (
          <ScoutBox padding={16} style={{ marginBottom: 12 }}>
            <p style={{ ...bruddleHeadingStyle("h6"), marginBottom: 12 }}>Add a skill to obtain</p>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginBottom: 4 }}>
                  Skill *
                </label>
                <input
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  placeholder="e.g. Market analysis"
                  style={scoutFieldStyle}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginBottom: 4 }}>
                  For role
                </label>
                <select
                  value={newSkillRole || dreamList[0] || "__custom__"}
                  onChange={(e) => setNewSkillRole(e.target.value)}
                  style={scoutFieldStyle}
                >
                  {dreamList.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                  <option value="__custom__">Other role…</option>
                  {!dreamList.length && <option value="General">General</option>}
                </select>
              </div>
              {newSkillRole === "__custom__" && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <input
                    value={customSkillRole}
                    onChange={(e) => setCustomSkillRole(e.target.value)}
                    placeholder="Role name"
                    style={scoutFieldStyle}
                  />
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <ScoutPrimaryBtn
                onClick={addSkillToObtain}
                disabled={!newSkillName.trim() || (newSkillRole === "__custom__" && !customSkillRole.trim())}
                style={{ opacity: newSkillName.trim() ? 1 : 0.5 }}
              >
                Add
              </ScoutPrimaryBtn>
              <ScoutSecondaryBtn
                onClick={() => {
                  setShowAddSkillForm(false);
                  setNewSkillName("");
                  setCustomSkillRole("");
                }}
              >
                Cancel
              </ScoutSecondaryBtn>
            </div>
          </ScoutBox>
        )}

        {skillGoals.length === 0 ? (
          <ScoutInsetBox padding={isMobile ? "20px 16px" : "24px 20px"}>
            <p style={{ ...bruddleHeadingStyle("h6"), marginBottom: 8 }}>Nothing queued yet</p>
            <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.muted, margin: "0 0 16px", lineHeight: 1.6 }}>
              {unqueuedGapCount > 0
                ? `We found ${unqueuedGapCount} market gap${unqueuedGapCount === 1 ? "" : "s"} across your target roles. Queue skills from Target Roles or add one here.`
                : "Add a skill above, or on Target Roles choose Add to Upskill on a gap."}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {unqueuedGapCount > 0 && (
                <ScoutPrimaryBtn onClick={onGoToTargetRoles}>Go to Target Roles</ScoutPrimaryBtn>
              )}
              {!showAddSkillForm && (
                <ScoutSecondaryBtn
                  onClick={() => {
                    setShowAddSkillForm(true);
                    setNewSkillRole(dreamList[0] ?? "__custom__");
                  }}
                >
                  + Add skill
                </ScoutSecondaryBtn>
              )}
            </div>
          </ScoutInsetBox>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {skillGroups.map(({ role, goals }) => (
              <div key={role}>
                <ScoutBox flat padding={isMobile ? "12px 14px" : "14px 16px"} style={{ marginBottom: 14, background: "var(--bruddle-cream)" }}>
                  <ScoutDisplayTitle size={18} style={{ margin: 0 }}>
                    {role}
                  </ScoutDisplayTitle>
                </ScoutBox>
                {groupGoalsByKind(goals).map(({ label, goals: kindGoals }) => (
                  <div key={`${role}-${label}`} style={{ marginBottom: 16 }}>
                    <p
                      style={{
                        fontFamily: fontSans,
                        fontSize: T.label,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: color.forest,
                        margin: "0 0 10px",
                      }}
                    >
                      {label}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {kindGoals.map((g) => (
                        <SkillGoalCard
                          key={`${g.skill}-${g.role}`}
                          goal={g}
                          isMobile={isMobile}
                          isHighlighted={highlightSkill?.toLowerCase() === g.skill.toLowerCase()}
                          progress={progress}
                          setProgress={setProgress}
                          onGraduate={handleGraduate}
                          onDismiss={onDismissSkill}
                          graduating={graduating}
                          cardRef={(el) => {
                            skillGoalRefs.current[g.skill.toLowerCase()] = el;
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My learning — custom items */}
      <div>
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            <ScoutLabel>My learning</ScoutLabel>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "6px 0 0", lineHeight: 1.5 }}>
              Courses, certs, or tools you track on your own.
            </p>
          </div>
          {!showAddForm && <ScoutSecondaryBtn onClick={() => setShowAddForm(true)}>+ Add your own</ScoutSecondaryBtn>}
        </div>

        {showAddForm && (
          <ScoutBox padding={16} style={{ marginBottom: 12 }}>
            <p style={{ ...bruddleHeadingStyle("h6"), marginBottom: 12 }}>Track your own learning</p>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginBottom: 4 }}>
                  Course / certification name *
                </label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Google Project Management Certificate"
                  style={scoutFieldStyle}
                />
              </div>
              <div>
                <label style={{ display: "block", fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginBottom: 4 }}>
                  Platform
                </label>
                <input
                  value={newPlatform}
                  onChange={(e) => setNewPlatform(e.target.value)}
                  placeholder="Coursera, Udemy…"
                  style={scoutFieldStyle}
                />
              </div>
              <div>
                <label style={{ display: "block", fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginBottom: 4 }}>
                  Duration
                </label>
                <input
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value)}
                  placeholder="6 weeks"
                  style={scoutFieldStyle}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginBottom: 4 }}>
                  URL (optional)
                </label>
                <input
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://…"
                  style={scoutFieldStyle}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <ScoutPrimaryBtn onClick={addCustomItem} disabled={!newName.trim()} style={{ opacity: newName.trim() ? 1 : 0.5 }}>
                Add
              </ScoutPrimaryBtn>
              <ScoutSecondaryBtn
                onClick={() => {
                  setShowAddForm(false);
                  setNewName("");
                  setNewUrl("");
                  setNewPlatform("");
                  setNewDuration("");
                }}
              >
                Cancel
              </ScoutSecondaryBtn>
            </div>
          </ScoutBox>
        )}

        {customItems.length === 0 && !showAddForm ? (
          <ScoutInsetBox padding={isMobile ? "20px 16px" : "24px 20px"} style={{ textAlign: "center" }}>
            <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.mutedLight, margin: 0, lineHeight: 1.6 }}>
              No custom items yet. Add courses or certs you&apos;re tracking outside Kimchi picks.
            </p>
          </ScoutInsetBox>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {customItems.map((item) => {
              const statusLabel =
                item.status === "completed" ? "Completed" : item.status === "inprogress" ? "In progress" : "Not started";
              const statusColor =
                item.status === "completed" ? color.forest : item.status === "inprogress" ? "#7A6020" : color.muted;
              return (
                <ScoutBox key={item.id} padding={isMobile ? "12px 14px" : "14px 16px"}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: isMobile ? "column" : "row",
                      alignItems: isMobile ? "stretch" : "center",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "var(--scout-radius)",
                        background: "var(--bruddle-cream)",
                        border: "var(--scout-border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        fontFamily: fontSans,
                        fontSize: T.bodySm,
                        fontWeight: 700,
                        color: color.bruddleInk,
                      }}
                    >
                      {(item.platform || item.name).charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontFamily: fontSans,
                            fontSize: T.body,
                            fontWeight: 600,
                            color: color.ink,
                            textDecoration: "none",
                          }}
                        >
                          {item.name} ↗
                        </a>
                      ) : (
                        <p style={{ fontFamily: fontSans, fontSize: T.body, fontWeight: 600, color: color.ink, margin: 0 }}>
                          {item.name}
                        </p>
                      )}
                      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "4px 0 0" }}>
                        {[item.platform, item.duration].filter(Boolean).join(" · ")}
                      </p>
                      <p style={{ fontFamily: fontSans, fontSize: T.caption, color: statusColor, margin: "4px 0 0", fontWeight: 600 }}>
                        {statusLabel}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <ScoutPrimaryBtn
                        onClick={() => updateCustomStatus(item.id)}
                        style={{
                          minHeight: 44,
                          flex: isMobile ? 1 : undefined,
                          ...(item.status === "completed"
                            ? { background: "rgba(26,58,47,0.08)", color: color.forest }
                            : {}),
                        }}
                      >
                        {item.status === "completed" ? "Review" : item.status === "inprogress" ? "Complete" : "Start"}
                      </ScoutPrimaryBtn>
                      <button
                        type="button"
                        onClick={() => removeCustomItem(item.id)}
                        aria-label={`Remove ${item.name}`}
                        style={{
                          background: "none",
                          border: "none",
                          color: color.mutedLight,
                          cursor: "pointer",
                          fontSize: 20,
                          lineHeight: 1,
                          padding: "8px 10px",
                          minHeight: 44,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </ScoutBox>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
