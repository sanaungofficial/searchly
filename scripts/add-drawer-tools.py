#!/usr/bin/env python3
"""Add AI Tools section + 3 tool views to JobDrawer"""

FILE = "/home/z/my-project/src/components/scout/workspace-opportunities.tsx"

with open(FILE) as f:
    content = f.read()

# The AI Tools section that goes right after the Move-to stage chips </div>
# and before the {job ? ( block
ai_tools_section = '''          {/* AI Tools — 3 buttons */}
          <p
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 9,
              fontWeight: 600,
              color: "#1A3A2F",
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: 8,
              marginTop: 4,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span style={{ color: "#C4A86A" }}>✦</span> AI Tools
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
            <button
              onClick={() => setTool(tool === "resume" ? null : "resume")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                background: tool === "resume" ? "#1A3A2F" : "#FFFFFF",
                color: tool === "resume" ? "#E8D5A3" : "#1A1A1A",
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 7,
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }}>✦</span>
              <span style={{ flex: 1 }}>
                Update resume
                <span style={{ display: "block", fontSize: 10, fontWeight: 300, opacity: 0.7 }}>Maximize your interview chances</span>
              </span>
              <span style={{ fontSize: 12, opacity: 0.5 }}>{tool === "resume" ? "▲" : "›"}</span>
            </button>
            <button
              onClick={() => setTool(tool === "cover" ? null : "cover")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                background: tool === "cover" ? "#1A3A2F" : "#FFFFFF",
                color: tool === "cover" ? "#E8D5A3" : "#1A1A1A",
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 7,
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }}>✉</span>
              <span style={{ flex: 1 }}>
                Create cover letter
                <span style={{ display: "block", fontSize: 10, fontWeight: 300, opacity: 0.7 }}>Make your application stand out</span>
              </span>
              <span style={{ fontSize: 12, opacity: 0.5 }}>{tool === "cover" ? "▲" : "›"}</span>
            </button>
            <button
              onClick={() => setTool(tool === "fit" ? null : "fit")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                background: tool === "fit" ? "#1A3A2F" : "#FFFFFF",
                color: tool === "fit" ? "#E8D5A3" : "#1A1A1A",
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 7,
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }}>👍</span>
              <span style={{ flex: 1 }}>
                Tell me why I&apos;m a good fit
                <span style={{ display: "block", fontSize: 10, fontWeight: 300, opacity: 0.7 }}>Understand your strengths & gaps</span>
              </span>
              <span style={{ fontSize: 12, opacity: 0.5 }}>{tool === "fit" ? "▲" : "›"}</span>
            </button>
          </div>

          {/* Tool views or standard drawer content */}
'''

# The tool view sections that replace the standard content when a tool is active
tool_views = '''          {/* Tool view: Update resume */}
          {tool === "resume" && job && (
            <div style={{ animation: "fadeIn 0.3s ease both" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 600, color: "#1A3A2F", textTransform: "uppercase", letterSpacing: "1px" }}>Updated resume bullets</p>
                <button
                  onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(job.bullets.map(b => "• " + b.tailored).join("\\n\\n")); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }}
                  style={{ padding: "4px 10px", background: copied ? "rgba(74,139,106,0.1)" : "#1A3A2F", color: copied ? "#4A8B6A" : "#E8D5A3", border: "none", borderRadius: 4, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, cursor: "pointer" }}
                >
                  {copied ? "Copied ✓" : "Copy all"}
                </button>
              </div>
              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 300, color: "#52493F", lineHeight: 1.55, marginBottom: 14, textWrap: "pretty" }}>
                Searchly rewrote these bullets to align with what {card.company} screens for. Replace the originals on your resume.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {job.bullets.map((b, i) => (
                  <div key={i} style={{ padding: "12px 14px", background: "#FFFFFF", borderRadius: 7, borderLeft: "3px solid #1A3A2F" }}>
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 400, color: "#1A1A1A", lineHeight: 1.6, marginBottom: 8, textWrap: "pretty" }}>
                      {b.tailored}
                    </p>
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: "#A09890", fontStyle: "italic" }}>
                      Original: {b.original}
                    </p>
                  </div>
                ))}
              </div>
              <div style={{ padding: "14px", background: "rgba(196,168,106,0.08)", borderRadius: 7, borderLeft: "2px solid #C4A86A" }}>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 600, color: "#7A6020", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6 }}>Suggested summary line</p>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 300, color: "#2A2218", lineHeight: 1.6, fontStyle: "italic", textWrap: "pretty" }}>
                  Senior PM with 8 years scaling API-first SaaS products — {card.company}-scale infrastructure experience with measurable revenue impact.
                </p>
              </div>
            </div>
          )}

          {/* Tool view: Create cover letter */}
          {tool === "cover" && job && (
            <div style={{ animation: "fadeIn 0.3s ease both" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 600, color: "#1A3A2F", textTransform: "uppercase", letterSpacing: "1px" }}>Cover letter</p>
                <button
                  onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(job.coverLetter); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }}
                  style={{ padding: "4px 10px", background: copied ? "rgba(74,139,106,0.1)" : "#1A3A2F", color: copied ? "#4A8B6A" : "#E8D5A3", border: "none", borderRadius: 4, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, cursor: "pointer" }}
                >
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 300, color: "#52493F", lineHeight: 1.55, marginBottom: 14, textWrap: "pretty" }}>
                Tailored to {card.company} — references their priorities and your specific background.
              </p>
              <div style={{ padding: "16px", background: "#FFFFFF", borderRadius: 7, borderLeft: "3px solid #1A3A2F" }}>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 300, color: "#1A1A1A", lineHeight: 1.75, whiteSpace: "pre-wrap", textWrap: "pretty" }}>
                  {job.coverLetter}
                </p>
              </div>
            </div>
          )}

          {/* Tool view: Tell me why I'm a good fit */}
          {tool === "fit" && job && (
            <div style={{ animation: "fadeIn 0.3s ease both" }}>
              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 600, color: "#1A3A2F", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>Fit analysis</p>

              {/* Fit score breakdown */}
              <div style={{ padding: "16px", background: "#FFFFFF", borderRadius: 7, marginBottom: 14, display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
                  <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="32" cy="32" r="28" stroke="rgba(0,0,0,0.08)" strokeWidth="6" fill="none" />
                    <circle cx="32" cy="32" r="28" stroke={fitColor} strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 28 * card.fit / 100} ${2 * Math.PI * 28}`} />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 16, fontWeight: 600, color: fitColor }}>{card.fit}%</span>
                  </div>
                </div>
                <div>
                  <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 600, color: "#1A1A1A", marginBottom: 2 }}>{card.fit >= 85 ? "Strong match" : card.fit >= 70 ? "Good fit" : "Fair match"}</p>
                  <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 300, color: "#52493F", lineHeight: 1.5, textWrap: "pretty" }}>{job.fitSummary}</p>
                </div>
              </div>

              {/* Why you fit */}
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 600, color: "#4A8B6A", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>Why you fit</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {job.fitWorks.map((w, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 10px", background: "rgba(74,139,106,0.06)", borderRadius: 5 }}>
                      <span style={{ color: "#4A8B6A", fontSize: 11, flexShrink: 0, marginTop: 1 }}>✓</span>
                      <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 300, color: "#2A2218", lineHeight: 1.5, textWrap: "pretty" }}>{w}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Watch outs */}
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 600, color: "#C4A86A", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>Watch outs</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {job.fitWatches.map((w, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 10px", background: "rgba(196,168,106,0.06)", borderRadius: 5 }}>
                      <span style={{ color: "#C4A86A", fontSize: 11, flexShrink: 0, marginTop: 1 }}>△</span>
                      <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 300, color: "#2A2218", lineHeight: 1.5, textWrap: "pretty" }}>{w}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gaps */}
              <div>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 600, color: "#C4574A", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>Gaps to address</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {job.gaps.map((g, i) => (
                    <div key={i} style={{ padding: "10px 12px", background: "#FFFFFF", borderRadius: 5, borderLeft: "2px solid #C4574A" }}>
                      <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 600, color: "#1A1A1A", marginBottom: 3 }}>{g.title}</p>
                      <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 300, color: "#52493F", lineHeight: 1.5, textWrap: "pretty" }}>{g.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Standard drawer content (no tool active) */}
          {tool === null && job ? (
'''

# Also need to close the new conditional properly. The existing block ends with:
#   </div>
#   </>
#   ) : (
#     <div ...>Detailed analysis...</div>
#   )}
# We need to add `tool === null &&` to the else branch too

# Find the exact block to modify
# Old: `{job ? (` ... standard content ... `) : (` ... empty state ... `)}`
# New: `{tool === null && job ? (` ... standard content ... `) : tool === null && !job ? (` ... empty state ... `) : null}`

old_start = "          {job ? (\n            <>\n              {/* Fit summary */}"
new_start = "          {tool === null && job ? (\n            <>\n              {/* Fit summary */}"

if old_start not in content:
    print("ERROR: Could not find old_start marker")
    exit(1)

# Find the closing of the standard content block
# It's: `            </>\n          ) : (\n            <div\n              style={{\n                padding: 24,\n                textAlign: "center",\n                color: "#A09890",\n                fontFamily: "var(--font-dm-sans), system-ui",\n                fontSize: 12,\n              }}\n            >\n              <SparkleIcon /> Detailed analysis available for jobs Searchly has read.\n            </div>\n          )}"
old_end = '''            </>
          ) : (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: "#A09890",
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 12,
              }}
            >
              <SparkleIcon /> Detailed analysis available for jobs Searchly has read.
            </div>
          )}'''

new_end = '''            </>
          ) : tool === null ? (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: "#A09890",
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 12,
              }}
            >
              <SparkleIcon /> Detailed analysis available for jobs Searchly has read.
            </div>
          ) : null}'''

if old_end not in content:
    print("ERROR: Could not find old_end marker")
    exit(1)

# Also find where to insert the AI Tools section (after the Move-to chips </div>)
# The marker is the closing of the Move-to chips div followed by the {job ? ( block
insert_marker = "          </div>\n\n          {tool === null && job ? ("
# But we haven't replaced yet, so the marker is:
insert_marker_old = "          </div>\n\n          {job ? (\n            <>\n              {/* Fit summary */}"

if insert_marker_old not in content:
    print("ERROR: Could not find insert_marker_old")
    exit(1)

# Do the replacements in order:
# 1. Replace old_start with new_start
content = content.replace(old_start, new_start, 1)
# 2. Replace old_end with new_end
content = content.replace(old_end, new_end, 1)
# 3. Insert AI Tools section + tool views before the standard content
# The marker is now: "          </div>\n\n          {tool === null && job ? (\n            <>\n              {/* Fit summary */}"
insert_marker_new = "          </div>\n\n          {tool === null && job ? (\n            <>\n              {/* Fit summary */}"
replacement = "          </div>\n\n" + ai_tools_section + tool_views + "{tool === null && job ? (\n            <>\n              {/* Fit summary */}"
content = content.replace(insert_marker_new, replacement, 1)

with open(FILE, 'w') as f:
    f.write(content)

print("Done. File size:", len(content))
