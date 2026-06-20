"use client";

import { useRef, useState } from "react";
import {
  WORK_EXP,
  EDUCATION_LIST,
  SKILLS_LIST,
  SKILLS_SUGGESTED,
  PROFILE_SUGGESTIONS,
  ROLE_ARCHETYPES,
  AVAILABLE_ROLES,
  UPSKILL_CATEGORIES,
  type WorkExp,
} from "./workspace-data";
import { SparkleIcon, UploadIcon } from "./workspace-icons";

type ProfileTab = "dreamrole" | "experience" | "skills" | "learning" | "assets";
type UploadState = "idle" | "parsing" | "preview";

export function WorkspaceProfile() {
  const [tab, setTab] = useState<ProfileTab>("dreamrole");
  const [dreamList, setDreamList] = useState<string[]>(["VP of Product", "Head of Product Operations"]);
  const [dreamSelectedId, setDreamSelectedId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [upskillProgress, setUpskillProgress] = useState<Record<number, "none" | "inprogress" | "completed">>({});

  // Editable profile data (lifted from static imports)
  const [workExp, setWorkExp] = useState<WorkExp[]>(WORK_EXP);
  const [skills, setSkills] = useState<string[]>(SKILLS_LIST);

  // Upload state
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [parsedData, setParsedData] = useState<{ workExp: WorkExp[]; skills: string[] } | null>(null);
  const [selectedExp, setSelectedExp] = useState<Set<number>>(new Set());
  const [selectedSkills, setSelectedSkills] = useState<Set<number>>(new Set());
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [uploadSource, setUploadSource] = useState<"resume" | "linkedin" | null>(null);
  const [hasUploaded, setHasUploaded] = useState(false);
  const [bannerExpanded, setBannerExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tabs: [ProfileTab, string][] = [
    ["dreamrole", "Dream Role"],
    ["experience", "Experience"],
    ["skills", "Skills"],
    ["learning", "Learning Path"],
    ["assets", "Resume Assets"],
  ];

  /* ── Upload handlers ── */
  const startResumeUpload = () => {
    fileInputRef.current?.click();
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadSource("resume");
    setUploadState("parsing");
    if (fileInputRef.current) fileInputRef.current.value = "";
    window.setTimeout(() => {
      const mockParsed = generateMockParsedData();
      setParsedData(mockParsed);
      setSelectedExp(new Set(mockParsed.workExp.map((_, i) => i)));
      setSelectedSkills(new Set(mockParsed.skills.map((_, i) => i)));
      setUploadState("preview");
    }, 2000);
  };

  const startLinkedinImport = () => {
    if (!linkedinUrl.trim()) return;
    setUploadSource("linkedin");
    setUploadState("parsing");
    setLinkedinUrl("");
    window.setTimeout(() => {
      const mockParsed = generateMockParsedData();
      setParsedData(mockParsed);
      setSelectedExp(new Set(mockParsed.workExp.map((_, i) => i)));
      setSelectedSkills(new Set(mockParsed.skills.map((_, i) => i)));
      setUploadState("preview");
    }, 2000);
  };

  const confirmImport = () => {
    if (!parsedData) return;
    const newExp = parsedData.workExp.filter((_, i) => selectedExp.has(i));
    const newSkills = parsedData.skills.filter((_, i) => selectedSkills.has(i));
    setWorkExp(newExp);
    setSkills(newSkills);
    setUploadState("idle");
    setParsedData(null);
    setUploadSource(null);
    setHasUploaded(true);
    setBannerExpanded(false);
  };

  const cancelImport = () => {
    setUploadState("idle");
    setParsedData(null);
    setUploadSource(null);
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#F2EDE3",
        animation: "fadeIn 0.3s ease both",
      }}
    >
      <div style={{ padding: "20px 32px 0", overflowY: "auto", flex: 1 }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <p
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 10,
              fontWeight: 500,
              color: "#A09890",
              letterSpacing: "1.1px",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Sarah Chen · Senior PM · 8 yrs
          </p>
          <h1
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontSize: 32,
              fontWeight: 500,
              fontStyle: "italic",
              color: "#1A1A1A",
              letterSpacing: "-0.3px",
            }}
          >
            Your profile, through Searchly&apos;s eyes.
          </h1>
        </div>

        {/* Upload banner */}
        <UploadBanner
          onUploadResume={startResumeUpload}
          linkedinUrl={linkedinUrl}
          setLinkedinUrl={setLinkedinUrl}
          onImportLinkedin={startLinkedinImport}
          parsing={uploadState === "parsing"}
          uploadSource={uploadSource}
          hasUploaded={hasUploaded}
          expanded={bannerExpanded}
          setExpanded={setBannerExpanded}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          style={{ display: "none" }}
          onChange={onFileSelected}
        />

        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 24,
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            paddingBottom: 0,
          }}
        >
          {tabs.map(([id, label]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "6px 6px 0 0",
                  background: active ? "#1A3A2F" : "transparent",
                  color: active ? "#E8D5A3" : "#52493F",
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {tab === "dreamrole" && (
          <DreamRoleTab
            dreamList={dreamList}
            setDreamList={setDreamList}
            dreamSelectedId={dreamSelectedId}
            setDreamSelectedId={setDreamSelectedId}
            adding={adding}
            setAdding={setAdding}
            skills={skills}
          />
        )}
        {tab === "experience" && <ExperienceTab workExp={workExp} setWorkExp={setWorkExp} />}
        {tab === "skills" && <SkillsTab skills={skills} setSkills={setSkills} dreamList={dreamList} />}
        {tab === "learning" && (
          <LearningTab
            progress={upskillProgress}
            setProgress={setUpskillProgress}
            dreamList={dreamList}
            skills={skills}
          />
        )}
        {tab === "assets" && <AssetsTab />}
      </div>

      {/* Preview modal — shows when upload is in preview state */}
      {uploadState === "preview" && parsedData && (
        <PreviewModal
          parsedData={parsedData}
          selectedExp={selectedExp}
          setSelectedExp={setSelectedExp}
          selectedSkills={selectedSkills}
          setSelectedSkills={setSelectedSkills}
          onConfirm={confirmImport}
          onCancel={cancelImport}
          source={uploadSource}
        />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Upload banner — file upload + LinkedIn URL import
   ────────────────────────────────────────────────────────────── */
function UploadBanner({
  onUploadResume,
  linkedinUrl,
  setLinkedinUrl,
  onImportLinkedin,
  parsing,
  uploadSource,
  hasUploaded,
  expanded,
  setExpanded,
}: {
  onUploadResume: () => void;
  linkedinUrl: string;
  setLinkedinUrl: (s: string) => void;
  onImportLinkedin: () => void;
  parsing: boolean;
  uploadSource: "resume" | "linkedin" | null;
  hasUploaded: boolean;
  expanded: boolean;
  setExpanded: (b: boolean) => void;
}) {
  // Parsing state — always full banner
  if (parsing) {
    return (
      <div
        style={{
          background: "#1A3A2F",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            border: "2px solid rgba(232,213,163,0.2)",
            borderTopColor: "#E8D5A3",
            borderRadius: "50%",
            animation: "spin 0.75s linear infinite",
            flexShrink: 0,
          }}
        />
        <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#E8D5A3" }}>
          Searchly is {uploadSource === "resume" ? "reading your resume" : "importing from LinkedIn"}…
        </p>
      </div>
    );
  }

  // Collapsed state — small button after first upload
  if (hasUploaded && !expanded) {
    return (
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => setExpanded(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 14px",
            background: "transparent",
            color: "#1A3A2F",
            border: "1px solid rgba(26,58,47,0.2)",
            borderRadius: 6,
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 11,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <UploadIcon /> Update profile
        </button>
      </div>
    );
  }

  // Expanded (or first-time) state — full banner

  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 10,
        padding: "16px 20px",
        marginBottom: 20,
        border: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 9,
            fontWeight: 600,
            color: "#A09890",
            textTransform: "uppercase",
            letterSpacing: "1px",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <SparkleIcon /> {hasUploaded ? "Update your profile" : "Auto-fill your profile"}
        </p>
        {hasUploaded && (
          <button
            onClick={() => setExpanded(false)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 16,
              color: "#A09890",
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        {/* Upload resume */}
        <div style={{ flex: "1 1 240px", minWidth: 240 }}>
          <button
            onClick={onUploadResume}
            style={{
              width: "100%",
              padding: "10px 14px",
              background: "#1A3A2F",
              color: "#E8D5A3",
              border: "none",
              borderRadius: 6,
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <UploadIcon /> Upload resume
          </button>
          <p
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 9,
              color: "#A09890",
              marginTop: 4,
              textAlign: "center",
            }}
          >
            PDF or DOCX
          </p>
        </div>

        {/* Divider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 4px",
            height: 36,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 10,
              color: "#A09890",
              fontStyle: "italic",
            }}
          >
            or
          </span>
        </div>

        {/* LinkedIn URL */}
        <div style={{ flex: "1 1 280px", minWidth: 280 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="url"
              placeholder="linkedin.com/in/your-name"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onImportLinkedin()}
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "1px solid rgba(26,58,47,0.2)",
                borderRadius: 6,
                background: "#FFFFFF",
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 12,
                color: "#1A1A1A",
                minWidth: 0,
              }}
            />
            <button
              onClick={onImportLinkedin}
              disabled={!linkedinUrl.trim()}
              style={{
                padding: "8px 14px",
                background: linkedinUrl.trim() ? "#1A3A2F" : "rgba(26,58,47,0.3)",
                color: "#E8D5A3",
                border: "none",
                borderRadius: 6,
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 12,
                fontWeight: 500,
                cursor: linkedinUrl.trim() ? "pointer" : "not-allowed",
                flexShrink: 0,
              }}
            >
              Import
            </button>
          </div>
          <p
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 9,
              color: "#A09890",
              marginTop: 4,
            }}
          >
            Searchly will extract experience + skills
          </p>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Preview modal — shows extracted data, user confirms what to import
   ────────────────────────────────────────────────────────────── */
function PreviewModal({
  parsedData,
  selectedExp,
  setSelectedExp,
  selectedSkills,
  setSelectedSkills,
  onConfirm,
  onCancel,
  source,
}: {
  parsedData: { workExp: WorkExp[]; skills: string[] };
  selectedExp: Set<number>;
  setSelectedExp: (s: Set<number>) => void;
  selectedSkills: Set<number>;
  setSelectedSkills: (s: Set<number>) => void;
  onConfirm: () => void;
  onCancel: () => void;
  source: "resume" | "linkedin" | null;
}) {
  const toggleExp = (i: number) => {
    const next = new Set(selectedExp);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelectedExp(next);
  };
  const toggleSkill = (i: number) => {
    const next = new Set(selectedSkills);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelectedSkills(next);
  };

  return (
    <>
      <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 80 }} />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 560,
          maxWidth: "90vw",
          maxHeight: "85vh",
          background: "#FFFFFF",
          borderRadius: 12,
          boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
          zIndex: 90,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "fadeIn 0.2s ease both",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <p
              style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 9,
                fontWeight: 600,
                color: "#C4A86A",
                textTransform: "uppercase",
                letterSpacing: "1px",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <SparkleIcon /> Searchly extracted
            </p>
            <button
              onClick={onCancel}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#A09890", padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
          </div>
          <h3
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontSize: 22,
              fontWeight: 500,
              fontStyle: "italic",
              color: "#1A1A1A",
            }}
          >
            Review what we found.
          </h3>
          <p
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 11,
              fontWeight: 300,
              color: "#52493F",
              marginTop: 4,
              lineHeight: 1.5,
            }}
          >
            From your {source === "resume" ? "resume" : "LinkedIn profile"}. Uncheck anything you don&apos;t want to import — this will replace your current Experience + Skills.
          </p>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {/* Experience */}
          <p
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 9,
              fontWeight: 600,
              color: "#1A3A2F",
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: 10,
            }}
          >
            Experience ({selectedExp.size}/{parsedData.workExp.length} selected)
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {parsedData.workExp.map((w, i) => {
              const checked = selectedExp.has(i);
              return (
                <button
                  key={i}
                  onClick={() => toggleExp(i)}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "10px 12px",
                    background: checked ? "rgba(26,58,47,0.04)" : "transparent",
                    border: `1px solid ${checked ? "rgba(26,58,47,0.2)" : "rgba(0,0,0,0.08)"}`,
                    borderRadius: 7,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      border: `1.5px solid ${checked ? "#1A3A2F" : "rgba(0,0,0,0.2)"}`,
                      background: checked ? "#1A3A2F" : "transparent",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: 1,
                    }}
                  >
                    {checked && <span style={{ color: "#E8D5A3", fontSize: 10, lineHeight: 1 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 600, color: "#1A1A1A", marginBottom: 1 }}>
                      {w.role}
                    </p>
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#7A7268", marginBottom: 4 }}>
                      {w.company} · {w.period}
                    </p>
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 300, color: "#52493F", lineHeight: 1.4 }}>
                      {w.bullets[0]}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Skills */}
          <p
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 9,
              fontWeight: 600,
              color: "#1A3A2F",
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: 10,
            }}
          >
            Skills ({selectedSkills.size}/{parsedData.skills.length} selected)
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {parsedData.skills.map((s, i) => {
              const checked = selectedSkills.has(i);
              return (
                <button
                  key={i}
                  onClick={() => toggleSkill(i)}
                  style={{
                    padding: "5px 12px",
                    background: checked ? "rgba(26,58,47,0.08)" : "transparent",
                    border: `1px solid ${checked ? "rgba(26,58,47,0.3)" : "rgba(0,0,0,0.12)"}`,
                    borderRadius: 100,
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 11,
                    fontWeight: checked ? 500 : 400,
                    color: checked ? "#1A3A2F" : "#7A7268",
                    cursor: "pointer",
                  }}
                >
                  {checked && "✓ "}{s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid rgba(0,0,0,0.07)",
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: "9px 18px",
              background: "transparent",
              color: "#52493F",
              border: "1px solid rgba(0,0,0,0.15)",
              borderRadius: 6,
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={selectedExp.size === 0 && selectedSkills.size === 0}
            style={{
              padding: "9px 22px",
              background: selectedExp.size === 0 && selectedSkills.size === 0 ? "rgba(26,58,47,0.3)" : "#1A3A2F",
              color: "#E8D5A3",
              border: "none",
              borderRadius: 6,
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 12,
              fontWeight: 600,
              cursor: selectedExp.size === 0 && selectedSkills.size === 0 ? "not-allowed" : "pointer",
            }}
          >
            Import {selectedExp.size + selectedSkills.size} items →
          </button>
        </div>
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────
   Mock parsed data generator — simulates what Searchly would extract
   ────────────────────────────────────────────────────────────── */
function generateMockParsedData(): { workExp: WorkExp[]; skills: string[] } {
  return {
    workExp: [
      {
        company: "TechCorp",
        role: "Senior Product Manager, Revenue Products",
        period: "2021 → Present",
        bullets: [
          "Led cross-functional team of 12 to rebuild revenue reporting infrastructure, reducing time-to-insight by 60%",
          "Drove API-first product decisions resulting in 34% platform reliability improvement",
          "Owned roadmap for 3 core product surfaces serving 40k+ enterprise customers",
          "Launched self-serve analytics dashboard adopted by 200+ internal users in first quarter",
        ],
      },
      {
        company: "DataFlow Inc",
        role: "Product Manager",
        period: "2018 → 2021",
        bullets: [
          "Launched 4 new product features 0→1, each reaching $1M+ ARR within 12 months",
          "Partnered with engineering on API redesign reducing customer integration time by 40%",
          "Conducted user research interviews with 50+ enterprise customers to inform roadmap",
        ],
      },
      {
        company: "StartupXYZ",
        role: "Associate Product Manager",
        period: "2016 → 2018",
        bullets: [
          "Built core analytics dashboard used by 500+ customers across 3 verticals",
          "Managed product backlog and sprint planning for 6-person engineering team",
        ],
      },
    ],
    skills: [
      "Product Strategy",
      "Data Analysis",
      "Cross-functional Leadership",
      "Stakeholder Management",
      "Roadmap Planning",
      "SaaS",
      "UX Research",
      "SQL",
      "Amplitude",
      "A/B Testing",
      "Go-to-Market Strategy",
      "User Research",
      "API Product Management",
      "Enterprise SaaS",
    ],
  };
}

/* ──────────────────────────────────────────────────────────────
   Dream Role tab — bigger cards with readiness ring + skill breakdown
   ────────────────────────────────────────────────────────────── */
function DreamRoleTab({
  dreamList,
  setDreamList,
  dreamSelectedId,
  setDreamSelectedId,
  adding,
  setAdding,
  skills,
}: {
  dreamList: string[];
  setDreamList: (l: string[]) => void;
  dreamSelectedId: number | null;
  setDreamSelectedId: (n: number | null) => void;
  adding: boolean;
  setAdding: (b: boolean) => void;
  skills: string[];
}) {
  const skillsSet = new Set(skills);

  const addRole = (title: string) => {
    if (dreamList.includes(title) || dreamList.length >= 3) {
      setAdding(false);
      return;
    }
    setDreamList([...dreamList, title]);
    setAdding(false);
    setDreamSelectedId(null);
  };
  const removeRole = (idx: number) => {
    setDreamList(dreamList.filter((_, i) => i !== idx));
    setDreamSelectedId(null);
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Selected dream-role detail */}
      {dreamSelectedId !== null && dreamList[dreamSelectedId] && (
        <DreamRoleDetail
          title={dreamList[dreamSelectedId]}
          skillsSet={skillsSet}
          onClose={() => setDreamSelectedId(null)}
        />
      )}

      {/* Dream role cards */}
      {dreamSelectedId === null && (
        <>
          <p
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 11,
              color: "#52493F",
              marginBottom: 20,
              maxWidth: 580,
              lineHeight: 1.6,
            }}
          >
            Pick up to three roles you&apos;re aiming for. Searchly will measure the gap, surface roles that match, and
            build a learning path to bridge what&apos;s missing.
          </p>

          {/* Cards grid */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
            {dreamList.map((title, i) => {
              const arch = ROLE_ARCHETYPES[title];
              if (!arch) return null;
              const matched = arch.requires.filter((r) => skillsSet.has(r));
              const needed = arch.requires.filter((r) => !skillsSet.has(r));
              const readiness = Math.round((matched.length / arch.requires.length) * 100);
              const rc = readiness >= 75 ? "#4A8B6A" : readiness >= 50 ? "#C4A86A" : "#A09890";
              const readinessLabel = readiness >= 75 ? "Strong foundation" : readiness >= 50 ? "Good progress" : "Building toward";
              const timeline = readiness >= 75 ? "~6-12 months" : readiness >= 50 ? "~12-18 months" : "~18-24 months";
              const topGap = needed[0];
              const CIRC = 2 * Math.PI * 26;
              const dashOffset = (CIRC * (1 - readiness / 100)).toFixed(1);

              return (
                <div
                  key={title}
                  style={{
                    width: 280,
                    background: "#FFFFFF",
                    borderRadius: 12,
                    padding: 20,
                    border: `1.5px solid ${arch.color}30`,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                    position: "relative",
                    transition: "box-shadow 0.2s",
                  }}
                >
                  {/* Remove button */}
                  <button
                    onClick={() => removeRole(i)}
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 14,
                      color: "#A09890",
                      padding: 0,
                      lineHeight: 1,
                      zIndex: 1,
                    }}
                  >
                    ×
                  </button>

                  {/* Clickable content */}
                  <button
                    onClick={() => setDreamSelectedId(i)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      textAlign: "left",
                      width: "100%",
                    }}
                  >
                    {/* Readiness ring + title */}
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                      <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
                        <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: "rotate(-90deg)" }}>
                          <circle cx="28" cy="28" r="26" stroke="rgba(0,0,0,0.08)" strokeWidth="4" fill="none" />
                          <circle
                            cx="28"
                            cy="28"
                            r="26"
                            stroke={rc}
                            strokeWidth="4"
                            fill="none"
                            strokeLinecap="round"
                            strokeDasharray={CIRC}
                            strokeDashoffset={dashOffset}
                            style={{ transition: "stroke-dashoffset 0.6s ease" }}
                          />
                        </svg>
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "var(--font-dm-mono), monospace",
                              fontSize: 14,
                              fontWeight: 600,
                              color: rc,
                            }}
                          >
                            {readiness}%
                          </span>
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontFamily: "var(--font-dm-sans), system-ui",
                            fontSize: 14,
                            fontWeight: 600,
                            color: "#1A1A1A",
                            marginBottom: 2,
                          }}
                        >
                          {title}
                        </p>
                        <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: rc, fontWeight: 500 }}>
                          {readinessLabel}
                        </p>
                      </div>
                    </div>

                    {/* Skill breakdown bar */}
                    <div style={{ marginBottom: 12 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-dm-sans), system-ui",
                            fontSize: 9,
                            color: "#7A7268",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          Skills matched
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-dm-mono), monospace",
                            fontSize: 10,
                            color: "#1A1A1A",
                            fontWeight: 500,
                          }}
                        >
                          {matched.length}/{arch.requires.length}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 6,
                          background: "rgba(0,0,0,0.06)",
                          borderRadius: 3,
                          overflow: "hidden",
                          display: "flex",
                        }}
                      >
                        <div style={{ width: `${(matched.length / arch.requires.length) * 100}%`, height: "100%", background: "#4A8B6A", borderRadius: 3, transition: "width 0.6s ease" }} />
                      </div>
                    </div>

                    {/* Top gap */}
                    {topGap && (
                      <div
                        style={{
                          padding: "8px 10px",
                          background: "rgba(196,168,106,0.08)",
                          borderRadius: 6,
                          marginBottom: 10,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span style={{ color: "#C4A86A", fontSize: 11, flexShrink: 0 }}>△</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              fontFamily: "var(--font-dm-sans), system-ui",
                              fontSize: 9,
                              color: "#7A6020",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                            }}
                          >
                            Top gap
                          </p>
                          <p
                            style={{
                              fontFamily: "var(--font-dm-sans), system-ui",
                              fontSize: 11,
                              fontWeight: 500,
                              color: "#2A2218",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {topGap}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Timeline + open roles */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingTop: 8,
                        borderTop: "1px solid rgba(0,0,0,0.05)",
                      }}
                    >
                      <div>
                        <p
                          style={{
                            fontFamily: "var(--font-dm-sans), system-ui",
                            fontSize: 9,
                            color: "#A09890",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          Est. timeline
                        </p>
                        <p
                          style={{
                            fontFamily: "var(--font-dm-sans), system-ui",
                            fontSize: 11,
                            fontWeight: 500,
                            color: "#1A1A1A",
                          }}
                        >
                          {timeline}
                        </p>
                      </div>
                      <span
                        style={{
                          fontFamily: "var(--font-dm-sans), system-ui",
                          fontSize: 10,
                          color: "#1A3A2F",
                          fontWeight: 500,
                        }}
                      >
                        View detail →
                      </span>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Add role */}
          <div>
            {!adding ? (
              dreamList.length < 3 && (
                <button
                  onClick={() => setAdding(true)}
                  style={{
                    padding: "10px 18px",
                    background: "transparent",
                    color: "#1A3A2F",
                    border: "1px solid rgba(26,58,47,0.2)",
                    borderRadius: 5,
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  + Add a role
                </button>
              )
            ) : (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {AVAILABLE_ROLES.filter((r) => !dreamList.includes(r)).map((r) => (
                  <button
                    key={r}
                    onClick={() => addRole(r)}
                    style={{
                      padding: "6px 14px",
                      background: "#FFFFFF",
                      border: "1px solid rgba(0,0,0,0.1)",
                      borderRadius: 5,
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 11,
                      color: "#1A1A1A",
                      cursor: "pointer",
                    }}
                  >
                    {r}
                  </button>
                ))}
                <button
                  onClick={() => setAdding(false)}
                  style={{
                    padding: "6px 12px",
                    background: "transparent",
                    border: "none",
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 11,
                    color: "#A09890",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DreamRoleDetail({
  title,
  skillsSet,
  onClose,
}: {
  title: string;
  skillsSet: Set<string>;
  onClose: () => void;
}) {
  const [analysisState, setAnalysisState] = useState<"idle" | "loading" | "done">("idle");
  const arch = ROLE_ARCHETYPES[title];
  if (!arch) return null;
  const matched = arch.requires.filter((r) => skillsSet.has(r));
  const needed = arch.requires.filter((r) => !skillsSet.has(r));
  const readiness = Math.round((matched.length / arch.requires.length) * 100);
  const rc = readiness >= 75 ? "#4A8B6A" : readiness >= 50 ? "#C4A86A" : "#A09890";
  const timeline = readiness >= 75 ? "~6-12 months" : readiness >= 50 ? "~12-18 months" : "~18-24 months";

  const runAnalysis = () => {
    setAnalysisState("loading");
    window.setTimeout(() => setAnalysisState("done"), 1500);
  };

  // Mock gap analysis result — sequenced plan + bridge roles
  const phases = [
    { phase: "Phase 1 · Months 1–6", focus: `Close foundational gaps: ${needed.slice(0, 2).join(", ")}`, milestone: "Add 2 missing skills to your LinkedIn + resume" },
    { phase: "Phase 2 · Months 6–12", focus: `Build depth in: ${needed.slice(2, 4).join(", ") || "your domain"}`, milestone: "Lead a cross-functional initiative that demonstrates these skills" },
    { phase: "Phase 3 · Months 12–18", focus: "Position for the role", milestone: `Apply to ${title} roles with a tailored narrative` },
  ];
  const bridgeRoles = readiness < 75
    ? ["Senior PM (current)", "Group PM / Lead PM", title]
    : [title];
  return (
    <div style={{ paddingBottom: 40, animation: "fadeIn 0.3s ease both" }}>
      <button
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "var(--font-dm-sans), system-ui",
          fontSize: 11,
          color: "#1A3A2F",
          padding: 0,
          marginBottom: 16,
        }}
      >
        ← Back to roles
      </button>
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 10,
          padding: 28,
          border: `2px solid ${arch.color}`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.07)",
        }}
      >
        {/* Header with readiness ring */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
            <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="32" cy="32" r="30" stroke="rgba(0,0,0,0.08)" strokeWidth="5" fill="none" />
              <circle cx="32" cy="32" r="30" stroke={rc} strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray={2 * Math.PI * 30} strokeDashoffset={(2 * Math.PI * 30 * (1 - readiness / 100)).toFixed(1)} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 16, fontWeight: 600, color: rc }}>{readiness}%</span>
            </div>
          </div>
          <div>
            <h2
              style={{
                fontFamily: "var(--font-cormorant), Georgia, serif",
                fontSize: 28,
                fontWeight: 500,
                color: "#1A1A1A",
                fontStyle: "italic",
              }}
            >
              {title}
            </h2>
            <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#7A7268", marginTop: 2 }}>
              {arch.openRolesLabel} · Est. {timeline}
            </p>
          </div>
        </div>
        <p
          style={{
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 13,
            fontWeight: 300,
            color: "#52493F",
            lineHeight: 1.65,
            marginBottom: 22,
            textWrap: "pretty",
          }}
        >
          {arch.description}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div>
            <p
              style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 9,
                fontWeight: 600,
                color: "#4A8B6A",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: 10,
              }}
            >
              You have ({matched.length})
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {matched.map((s) => (
                <span
                  key={s}
                  style={{
                    padding: "5px 11px",
                    background: "rgba(74,139,106,0.08)",
                    borderRadius: 100,
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 11,
                    color: "#2D6B4A",
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p
              style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 9,
                fontWeight: 600,
                color: "#C4A86A",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: 10,
              }}
            >
              You&apos;ll need ({needed.length})
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {needed.map((s) => (
                <span
                  key={s}
                  style={{
                    padding: "5px 11px",
                    background: "rgba(196,168,106,0.1)",
                    borderRadius: 100,
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 11,
                    color: "#7A6020",
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        <button
          style={{
            padding: "12px 22px",
            background: "#1A3A2F",
            color: "#E8D5A3",
            border: "none",
            borderRadius: 6,
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 12,
            fontWeight: 600,
            cursor: analysisState === "loading" ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            opacity: analysisState === "loading" ? 0.6 : 1,
          }}
          onClick={analysisState === "idle" ? runAnalysis : undefined}
        >
          {analysisState === "loading" ? (
            <>
              <span style={{ width: 12, height: 12, border: "2px solid rgba(232,213,163,0.3)", borderTopColor: "#E8D5A3", borderRadius: "50%", animation: "spin 0.75s linear infinite", display: "inline-block" }} />
              Analyzing…
            </>
          ) : analysisState === "done" ? (
            <>
              <SparkleIcon /> Analysis complete — see below ↓
            </>
          ) : (
            <>
              <SparkleIcon /> Run Searchly gap analysis →
            </>
          )}
        </button>

        {/* Gap analysis results */}
        {analysisState === "done" && (
          <div style={{ marginTop: 20, animation: "fadeIn 0.3s ease both" }}>
            {/* Timeline */}
            <div
              style={{
                padding: "14px 16px",
                background: "rgba(26,58,47,0.04)",
                borderRadius: 8,
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 600, color: "#1A3A2F", textTransform: "uppercase", letterSpacing: "1px" }}>
                Timeline
              </span>
              <span style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontSize: 15, fontWeight: 500, fontStyle: "italic", color: "#1A1A1A" }}>
                {timeline}
              </span>
            </div>

            {/* Sequenced phases */}
            <p
              style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 9,
                fontWeight: 600,
                color: "#A09890",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: 10,
              }}
            >
              Sequenced plan
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {phases.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: "12px 14px",
                    background: "#FFFFFF",
                    borderRadius: 7,
                    border: "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  {/* Phase number circle */}
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: "#1A3A2F",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 11, fontWeight: 600, color: "#E8D5A3" }}>{i + 1}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 600, color: "#1A3A2F", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>
                      {p.phase}
                    </p>
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 500, color: "#1A1A1A", marginBottom: 4, textWrap: "pretty" }}>
                      {p.focus}
                    </p>
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 300, color: "#52493F", fontStyle: "italic", textWrap: "pretty" }}>
                      → {p.milestone}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Bridge roles */}
            {bridgeRoles.length > 1 && (
              <div>
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 9,
                    fontWeight: 600,
                    color: "#C4A86A",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    marginBottom: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <SparkleIcon /> Bridge roles
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {bridgeRoles.map((role, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          padding: "5px 12px",
                          background: i === bridgeRoles.length - 1 ? arch.color : "rgba(0,0,0,0.05)",
                          color: i === bridgeRoles.length - 1 ? "#FFFFFF" : "#52493F",
                          borderRadius: 100,
                          fontFamily: "var(--font-dm-sans), system-ui",
                          fontSize: 11,
                          fontWeight: i === bridgeRoles.length - 1 ? 600 : 400,
                        }}
                      >
                        {role}
                      </span>
                      {i < bridgeRoles.length - 1 && <span style={{ color: "#A09890", fontSize: 12 }}>→</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Experience tab — editable with inline click-to-edit
   ────────────────────────────────────────────────────────────── */
function ExperienceTab({
  workExp,
  setWorkExp,
}: {
  workExp: WorkExp[];
  setWorkExp: (w: WorkExp[]) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (field: string, currentValue: string) => {
    setEditing(field);
    setEditValue(currentValue);
  };

  const saveEdit = (field: string) => {
    const parts = field.split("-");
    const expIdx = parseInt(parts[1]);
    const fieldKey = parts[2];
    const newExp = [...workExp];
    if (fieldKey === "role") newExp[expIdx].role = editValue;
    else if (fieldKey === "company") newExp[expIdx].company = editValue;
    else if (fieldKey === "period") newExp[expIdx].period = editValue;
    else if (fieldKey === "bullet") {
      const bulletIdx = parseInt(parts[3]);
      newExp[expIdx].bullets[bulletIdx] = editValue;
    }
    setWorkExp(newExp);
    setEditing(null);
  };

  const addBullet = (expIdx: number) => {
    const newExp = [...workExp];
    newExp[expIdx].bullets = [...newExp[expIdx].bullets, "New achievement — click to edit"];
    setWorkExp(newExp);
    setEditing(`exp-${expIdx}-bullet-${newExp[expIdx].bullets.length - 1}`);
    setEditValue("New achievement — click to edit");
  };

  const removeBullet = (expIdx: number, bulletIdx: number) => {
    const newExp = [...workExp];
    newExp[expIdx].bullets = newExp[expIdx].bullets.filter((_, j) => j !== bulletIdx);
    setWorkExp(newExp);
  };

  const addExperience = () => {
    const newEntry: WorkExp = {
      company: "New Company",
      role: "New Role",
      period: "2024 → Present",
      bullets: ["Describe your key achievement here"],
    };
    setWorkExp([...workExp, newEntry]);
  };

  const removeExperience = (expIdx: number) => {
    setWorkExp(workExp.filter((_, i) => i !== expIdx));
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 8px",
    border: "1px solid rgba(26,58,47,0.3)",
    borderRadius: 4,
    background: "#FFFFFF",
    fontFamily: "var(--font-dm-sans), system-ui",
    fontSize: 12,
    color: "#1A1A1A",
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      {workExp.map((w, i) => (
        <div
          key={i}
          style={{
            background: "#FFFFFF",
            borderRadius: 10,
            padding: "20px 24px",
            marginBottom: 12,
            border: "1px solid rgba(0,0,0,0.06)",
            position: "relative",
          }}
        >
          {/* Remove entry */}
          <button
            onClick={() => removeExperience(i)}
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              color: "#A09890",
              padding: 0,
              lineHeight: 1,
            }}
            title="Remove this entry"
          >
            ×
          </button>

          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4, gap: 12 }}>
            {/* Role — editable */}
            {editing === `exp-${i}-role` ? (
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveEdit(`exp-${i}-role`); if (e.key === "Escape") setEditing(null); }}
                  autoFocus
                  style={{ ...inputStyle, fontSize: 14, fontWeight: 600 }}
                />
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  <button onClick={() => saveEdit(`exp-${i}-role`)} style={{ padding: "3px 10px", background: "#1A3A2F", color: "#E8D5A3", border: "none", borderRadius: 3, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, cursor: "pointer" }}>Save</button>
                  <button onClick={() => setEditing(null)} style={{ padding: "3px 10px", background: "transparent", color: "#A09890", border: "none", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            ) : (
              <p
                onClick={() => startEdit(`exp-${i}-role`, w.role)}
                style={{
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#1A1A1A",
                  cursor: "text",
                  flex: 1,
                }}
              >
                {w.role}
              </p>
            )}

            {/* Period — editable */}
            {editing === `exp-${i}-period` ? (
              <div>
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveEdit(`exp-${i}-period`); if (e.key === "Escape") setEditing(null); }}
                  autoFocus
                  style={{ ...inputStyle, fontSize: 11, width: 120 }}
                />
              </div>
            ) : (
              <span
                onClick={() => startEdit(`exp-${i}-period`, w.period)}
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  fontSize: 11,
                  color: "#A09890",
                  cursor: "text",
                }}
              >
                {w.period}
              </span>
            )}
          </div>

          {/* Company — editable */}
          {editing === `exp-${i}-company` ? (
            <div style={{ marginBottom: 12 }}>
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveEdit(`exp-${i}-company`); if (e.key === "Escape") setEditing(null); }}
                autoFocus
                style={inputStyle}
              />
            </div>
          ) : (
            <p
              onClick={() => startEdit(`exp-${i}-company`, w.company)}
              style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 12,
                color: "#1A3A2F",
                fontWeight: 500,
                marginBottom: 12,
                cursor: "text",
              }}
            >
              {w.company}
            </p>
          )}

          {/* Bullets — each editable */}
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {w.bullets.map((b, j) => (
              <li key={j} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
                <span style={{ color: "#1A3A2F", flexShrink: 0, marginTop: 1 }}>•</span>
                {editing === `exp-${i}-bullet-${j}` ? (
                  <div style={{ flex: 1 }}>
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(`exp-${i}-bullet-${j}`); } if (e.key === "Escape") setEditing(null); }}
                      autoFocus
                      rows={2}
                      style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
                    />
                    <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                      <button onClick={() => saveEdit(`exp-${i}-bullet-${j}`)} style={{ padding: "3px 10px", background: "#1A3A2F", color: "#E8D5A3", border: "none", borderRadius: 3, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, cursor: "pointer" }}>Save</button>
                      <button onClick={() => setEditing(null)} style={{ padding: "3px 10px", background: "transparent", color: "#A09890", border: "none", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, cursor: "pointer" }}>Cancel</button>
                      <button onClick={() => removeBullet(i, j)} style={{ padding: "3px 10px", background: "transparent", color: "#C4574A", border: "none", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, cursor: "pointer", marginLeft: "auto" }}>Remove</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ flex: 1, display: "flex", gap: 4, alignItems: "flex-start" }}>
                    <span
                      onClick={() => startEdit(`exp-${i}-bullet-${j}`, b)}
                      style={{
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 12,
                        fontWeight: 300,
                        color: "#2A2218",
                        lineHeight: 1.55,
                        cursor: "text",
                        flex: 1,
                      }}
                    >
                      {b}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {/* Add bullet */}
          <button
            onClick={() => addBullet(i)}
            style={{
              marginTop: 8,
              padding: "4px 10px",
              background: "transparent",
              color: "#1A3A2F",
              border: "1px dashed rgba(26,58,47,0.3)",
              borderRadius: 4,
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 10,
              cursor: "pointer",
            }}
          >
            + Add bullet
          </button>
        </div>
      ))}

      {/* Add experience */}
      <button
        onClick={addExperience}
        style={{
          width: "100%",
          padding: "12px",
          background: "transparent",
          color: "#1A3A2F",
          border: "1px dashed rgba(26,58,47,0.3)",
          borderRadius: 10,
          fontFamily: "var(--font-dm-sans), system-ui",
          fontSize: 12,
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        + Add experience
      </button>

      {/* Education (static) */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 10,
          padding: "20px 24px",
          marginTop: 12,
          border: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 9,
            fontWeight: 600,
            color: "#A09890",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: 12,
          }}
        >
          Education
        </p>
        {EDUCATION_LIST.map((e, i) => (
          <div key={i} style={{ marginBottom: i < EDUCATION_LIST.length - 1 ? 10 : 0 }}>
            <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 500, color: "#1A1A1A" }}>
              {e.school}
            </p>
            <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#7A7268" }}>
              {e.degree} · {e.period}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Skills tab — editable chips with add/remove
   ────────────────────────────────────────────────────────────── */
function SkillsTab({
  skills,
  setSkills,
  dreamList,
}: {
  skills: string[];
  setSkills: (s: string[]) => void;
  dreamList: string[];
}) {
  const [newSkill, setNewSkill] = useState("");

  // Compute dynamic suggestions: skills required by the user's dream roles
  // that they don't have yet (plus the static SKILLS_SUGGESTED as fallback)
  const skillsSet = new Set(skills);
  const gapSkills: string[] = [];
  const seen = new Set<string>();
  for (const title of dreamList) {
    const arch = ROLE_ARCHETYPES[title];
    if (!arch) continue;
    arch.requires.forEach((r) => {
      if (!skillsSet.has(r) && !seen.has(r)) {
        gapSkills.push(r);
        seen.add(r);
      }
    });
  }
  // Merge with static suggestions (deduped, excluding skills they already have)
  const staticSuggestions = SKILLS_SUGGESTED.filter((s) => !skillsSet.has(s) && !seen.has(s));
  staticSuggestions.forEach((s) => { gapSkills.push(s); seen.add(s); });
  // Count how many dream roles each gap skill appears in (for the "X of Y roles" label)
  const dreamRoleCount = dreamList.length;
  const skillRoleCount: Record<string, number> = {};
  for (const title of dreamList) {
    const arch = ROLE_ARCHETYPES[title];
    if (!arch) continue;
    arch.requires.forEach((r) => {
      skillRoleCount[r] = (skillRoleCount[r] || 0) + 1;
    });
  }

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (!trimmed || skills.includes(trimmed)) return;
    setSkills([...skills, trimmed]);
    setNewSkill("");
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Your skills — editable */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 10,
          padding: "20px 24px",
          marginBottom: 12,
          border: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 9,
            fontWeight: 600,
            color: "#A09890",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: 12,
          }}
        >
          Your skills ({skills.length})
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {skills.map((s) => (
            <span
              key={s}
              style={{
                padding: "5px 8px 5px 14px",
                background: "rgba(26,58,47,0.07)",
                borderRadius: 100,
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 12,
                color: "#1A3A2F",
                fontWeight: 500,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {s}
              <button
                onClick={() => removeSkill(s)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                  color: "rgba(26,58,47,0.4)",
                  padding: 0,
                  lineHeight: 1,
                  display: "flex",
                  alignItems: "center",
                }}
                title="Remove skill"
              >
                ×
              </button>
            </span>
          ))}
        </div>

        {/* Add skill input */}
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="text"
            placeholder="Add a skill…"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addSkill(newSkill); }}
            style={{
              flex: 1,
              padding: "7px 12px",
              border: "1px solid rgba(26,58,47,0.2)",
              borderRadius: 5,
              background: "#FFFFFF",
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 12,
              color: "#1A1A1A",
              minWidth: 0,
            }}
          />
          <button
            onClick={() => addSkill(newSkill)}
            disabled={!newSkill.trim()}
            style={{
              padding: "7px 16px",
              background: newSkill.trim() ? "#1A3A2F" : "rgba(26,58,47,0.3)",
              color: "#E8D5A3",
              border: "none",
              borderRadius: 5,
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 12,
              fontWeight: 500,
              cursor: newSkill.trim() ? "pointer" : "not-allowed",
              flexShrink: 0,
            }}
          >
            Add
          </button>
        </div>
      </div>

      {/* Suggested skills */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 10,
          padding: "20px 24px",
          border: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 9,
            fontWeight: 600,
            color: "#C4A86A",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: 6,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <SparkleIcon /> Searchly suggests adding
        </p>
        <p
          style={{
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 11,
            color: "#7A7268",
            marginBottom: 12,
            lineHeight: 1.5,
          }}
        >
          {gapSkills.length === 0
            ? "You have all the skills your dream roles require. Nice work."
            : dreamRoleCount > 0
            ? `${gapSkills.length} skill${gapSkills.length === 1 ? "" : "s"} missing across your ${dreamRoleCount} dream role${dreamRoleCount === 1 ? "" : "s"}. Add the ones that fit.`
            : "Pick a dream role in the Dream Role tab to get personalized suggestions."}
        </p>
        {gapSkills.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {gapSkills.map((s) => {
              const roleCount = skillRoleCount[s] || 0;
              const isFromDreamRole = roleCount > 0;
              return (
                <button
                  key={s}
                  onClick={() => addSkill(s)}
                  style={{
                    padding: "6px 14px",
                    background: isFromDreamRole ? "rgba(196,168,106,0.1)" : "rgba(0,0,0,0.03)",
                    border: `1px dashed ${isFromDreamRole ? "rgba(196,168,106,0.5)" : "rgba(0,0,0,0.15)"}`,
                    borderRadius: 100,
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 12,
                    color: isFromDreamRole ? "#7A6020" : "#52493F",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                  title={isFromDreamRole ? `Required by ${roleCount} of your ${dreamRoleCount} dream role${dreamRoleCount === 1 ? "" : "s"}` : "Suggested skill"}
                >
                  + {s}
                  {isFromDreamRole && dreamRoleCount > 1 && (
                    <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 9, color: "#7A6020", opacity: 0.7 }}>
                      ({roleCount}/{dreamRoleCount})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Learning Path tab ── */
function LearningTab({
  progress,
  setProgress,
  dreamList,
  skills,
}: {
  progress: Record<number, "none" | "inprogress" | "completed">;
  setProgress: (p: Record<number, "none" | "inprogress" | "completed">) => void;
  dreamList: string[];
  skills: string[];
}) {
  const doneCount = Object.values(progress).filter((v) => v === "completed").length;
  const total = UPSKILL_CATEGORIES.reduce((a, c) => a + c.items.length, 0);

  // Compute the user's actual gaps across all their dream roles
  const skillsSet = new Set(skills);
  const userGaps = new Set<string>();
  for (const title of dreamList) {
    const arch = ROLE_ARCHETYPES[title];
    if (!arch) continue;
    arch.requires.forEach((r) => {
      if (!skillsSet.has(r)) userGaps.add(r);
    });
  }
  const gapCount = userGaps.size;

  return (
    <div style={{ paddingBottom: 40 }}>
      <div
        style={{
          background: "#1A3A2F",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <p
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 9,
              fontWeight: 600,
              color: "rgba(232,213,163,0.5)",
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: 4,
            }}
          >
            Your learning progress
          </p>
          <p
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontSize: 18,
              fontWeight: 500,
              color: "#E8D5A3",
            }}
          >
            {doneCount} of {total} complete
          </p>
          {gapCount > 0 && (
            <p
              style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 10,
                fontWeight: 300,
                color: "rgba(232,213,163,0.6)",
                marginTop: 4,
              }}
            >
              Closing {gapCount} skill {gapCount === 1 ? "gap" : "gaps"} across your dream roles
            </p>
          )}
        </div>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: `conic-gradient(#E8D5A3 ${(doneCount / total) * 360}deg, rgba(232,213,163,0.15) 0)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              background: "#1A3A2F",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: 14,
                fontWeight: 500,
                color: "#E8D5A3",
              }}
            >
              {Math.round((doneCount / total) * 100)}%
            </span>
          </div>
        </div>
      </div>

      {UPSKILL_CATEGORIES.map((cat) => (
        <div key={cat.title} style={{ marginBottom: 20 }}>
          <p
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 12,
              fontWeight: 600,
              color: "#1A1A1A",
              marginBottom: 4,
            }}
          >
            {cat.title}
          </p>
          <p
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 10,
              color: "#7A7268",
              marginBottom: 10,
            }}
          >
            {cat.subtitle}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {cat.items.map((item) => {
              const prog = progress[item.id] || "none";
              const statusLabel =
                prog === "completed" ? "Completed ✓" : prog === "inprogress" ? "In progress" : "Not started";
              const statusColor = prog === "completed" ? "#4A8B6A" : prog === "inprogress" ? "#C4A86A" : "#A09890";
              return (
                <div
                  key={item.id}
                  style={{
                    background: "#FFFFFF",
                    borderRadius: 8,
                    padding: "14px 16px",
                    border: "1px solid rgba(0,0,0,0.06)",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 7,
                      background: item.platformColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#FFFFFF",
                      }}
                    >
                      {item.platformInitial}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <p
                        style={{
                          fontFamily: "var(--font-dm-sans), system-ui",
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#1A1A1A",
                        }}
                      >
                        {item.name}
                      </p>
                      {item.scoutPick && (
                        <span
                          style={{
                            padding: "1px 7px",
                            background: "rgba(196,168,106,0.15)",
                            borderRadius: 100,
                            fontFamily: "var(--font-dm-sans), system-ui",
                            fontSize: 9,
                            color: "#7A6020",
                            fontWeight: 600,
                          }}
                        >
                          Searchly pick
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 10,
                        color: "#7A7268",
                        marginBottom: 3,
                      }}
                    >
                      {item.platform} · {item.duration} · {item.credential}
                    </p>
                    {item.closesGap && userGaps.has(item.closesGap) && (
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "2px 8px",
                          background: "rgba(196,87,74,0.08)",
                          borderRadius: 100,
                          marginTop: 4,
                          marginBottom: 3,
                        }}
                      >
                        <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 600, color: "#C4574A", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Closes your gap
                        </span>
                        <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 500, color: "#2A2218" }}>
                          {item.closesGap}
                        </span>
                      </div>
                    )}
                    <p
                      style={{
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 10,
                        color: statusColor,
                      }}
                    >
                      {statusLabel}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setProgress({
                        ...progress,
                        [item.id]:
                          prog === "none" ? "inprogress" : prog === "inprogress" ? "completed" : "inprogress",
                      })
                    }
                    style={{
                      padding: "7px 14px",
                      background: prog === "completed" ? "rgba(74,139,106,0.1)" : "#1A3A2F",
                      color: prog === "completed" ? "#4A8B6A" : "#E8D5A3",
                      border: "none",
                      borderRadius: 5,
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 11,
                      fontWeight: 500,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    {prog === "completed" ? "Review →" : prog === "inprogress" ? "Complete →" : "Start →"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Resume Assets tab ── */
function AssetsTab() {
  const suggestions = PROFILE_SUGGESTIONS;
  return (
    <div style={{ paddingBottom: 40 }}>
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 10,
          padding: "20px 24px",
          marginBottom: 12,
          border: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 9,
            fontWeight: 600,
            color: "#A09890",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: 12,
          }}
        >
          Resume versions
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              padding: "12px 14px",
              background: "rgba(26,58,47,0.03)",
              borderRadius: 6,
              borderLeft: "2px solid #1A3A2F",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 12,
                fontWeight: 600,
                color: "#1A1A1A",
              }}
            >
              📄 Original Resume
            </p>
            <p
              style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 10,
                color: "#7A7268",
                marginTop: 2,
              }}
            >
              Uploaded Jun 19, 2026
            </p>
          </div>
        </div>
      </div>

      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 10,
          padding: "20px 24px",
          border: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 9,
            fontWeight: 600,
            color: "#C4A86A",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <SparkleIcon /> Searchly&apos;s suggestions
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {suggestions.map((s) => {
            const pColor = s.priority === "high" ? "#C4574A" : s.priority === "medium" ? "#C4A86A" : "#A09890";
            const pBg =
              s.priority === "high"
                ? "rgba(196,87,74,0.08)"
                : s.priority === "medium"
                ? "rgba(196,168,106,0.1)"
                : "rgba(0,0,0,0.05)";
            return (
              <div
                key={s.id}
                style={{
                  padding: "12px 14px",
                  background: pBg,
                  borderRadius: 6,
                  borderLeft: `2px solid ${pColor}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 9,
                      fontWeight: 600,
                      color: pColor,
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    {s.priority} · {s.category}
                  </span>
                </div>
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#1A1A1A",
                    marginBottom: 4,
                  }}
                >
                  {s.title}
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 11,
                    fontWeight: 300,
                    color: "#52493F",
                    lineHeight: 1.55,
                    marginBottom: 4,
                  }}
                >
                  {s.detail}
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 10,
                    color: "#4A8B6A",
                    fontStyle: "italic",
                  }}
                >
                  → {s.impact}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
