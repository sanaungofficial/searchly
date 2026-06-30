"use client";

import { useState } from "react";
import { CSS } from "@dnd-kit/utilities";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { ChevronDown, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import { fontSans } from "@/lib/typography";
import { RT } from "@/lib/resume-tailor-tokens";
import {
  isSkillsEmphasisSection,
  parseSkillsSectionContent,
  serializeSkillsSectionContent,
  type TailoredResumeSection,
  type TailoredSkillGroup,
} from "@/lib/tailored-resume-sections";

function SortableSkillChip({
  id,
  label,
  onRemove,
}: {
  id: string;
  label: string;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.85 : 1,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px 6px 6px",
        background: "#FFFFFF",
        border: `1px solid ${RT.border}`,
        borderRadius: 999,
        fontSize: 12,
        color: RT.text,
        maxWidth: "100%",
      }}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        style={{
          background: "none",
          border: "none",
          cursor: "grab",
          padding: 2,
          display: "flex",
          color: RT.muted,
          flexShrink: 0,
        }}
        aria-label="Drag to reorder"
      >
        <GripVertical size={12} />
      </button>
      <span style={{ lineHeight: 1.3 }}>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          display: "flex",
          color: RT.muted,
          flexShrink: 0,
        }}
        aria-label={`Remove ${label}`}
      >
        <X size={12} />
      </button>
    </div>
  );
}

function SkillGroupEditor({
  group,
  onChange,
  onRemoveGroup,
}: {
  group: TailoredSkillGroup;
  onChange: (next: TailoredSkillGroup) => void;
  onRemoveGroup: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newSkill, setNewSkill] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const skillIds = group.skills.map((_, i) => `${group.id}-skill-${i}`);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = skillIds.indexOf(String(active.id));
    const newIndex = skillIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onChange({ ...group, skills: arrayMove(group.skills, oldIndex, newIndex) });
  }

  function addSkill() {
    const val = newSkill.trim();
    if (!val) return;
    onChange({ ...group, skills: [...group.skills, val] });
    setNewSkill("");
    setAdding(false);
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <input
          value={group.label}
          onChange={(e) => onChange({ ...group, label: e.target.value })}
          placeholder="Group label (e.g. CRM & Marketing Automation)"
          style={{
            flex: 1,
            padding: "6px 8px",
            border: `1px solid ${RT.border}`,
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            fontFamily: fontSans,
            color: RT.text,
            background: "#FAFAFA",
          }}
        />
        <button
          type="button"
          onClick={onRemoveGroup}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: RT.muted }}
          aria-label="Remove group"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={skillIds} strategy={rectSortingStrategy}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {group.skills.map((skill, i) => (
              <SortableSkillChip
                key={skillIds[i]}
                id={skillIds[i]!}
                label={skill}
                onRemove={() =>
                  onChange({ ...group, skills: group.skills.filter((_, idx) => idx !== i) })
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {adding ? (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input
            autoFocus
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addSkill();
              if (e.key === "Escape") {
                setAdding(false);
                setNewSkill("");
              }
            }}
            placeholder="Skill name"
            style={{
              flex: 1,
              padding: "6px 10px",
              border: `1px solid ${RT.border}`,
              borderRadius: 6,
              fontSize: 12,
              fontFamily: fontSans,
            }}
          />
          <button
            type="button"
            onClick={addSkill}
            style={{
              padding: "6px 12px",
              background: RT.green,
              border: "none",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Add
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{
            marginTop: 8,
            padding: "6px 12px",
            background: "transparent",
            border: `1px dashed ${RT.border}`,
            borderRadius: 6,
            fontSize: 12,
            color: RT.muted,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Plus size={12} /> Add
        </button>
      )}
    </div>
  );
}

export function TailoredResumeEditorPanel({
  sections,
  onChange,
  onEditBaseResume,
  sectionOrderNote = "Section order is saved globally across all your tailored resumes.",
}: {
  sections: TailoredResumeSection[];
  onChange: (sections: TailoredResumeSection[]) => void;
  onEditBaseResume?: () => void;
  sectionOrderNote?: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(
    sections.find((s) => s.type !== "header" && s.type !== "meta")?.id ?? null,
  );
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState("");

  function updateSection(id: string, patch: Partial<TailoredResumeSection>) {
    onChange(sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function deleteSection(id: string) {
    onChange(sections.filter((s) => s.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function updateSkillsSection(id: string, groups: TailoredSkillGroup[]) {
    updateSection(id, { content: serializeSkillsSectionContent(groups) });
  }

  return (
    <div style={{ fontFamily: fontSans }}>
      <p
        style={{
          fontSize: 12,
          color: RT.text,
          background: "rgba(0, 240, 160, 0.12)",
          border: `1px solid rgba(0, 240, 160, 0.25)`,
          padding: "10px 12px",
          borderRadius: 8,
          lineHeight: 1.5,
          margin: "0 0 12px",
        }}
      >
        {sectionOrderNote}
      </p>

      {onEditBaseResume && (
        <button
          type="button"
          onClick={onEditBaseResume}
          style={{
            width: "100%",
            padding: "8px 12px",
            marginBottom: 14,
            background: "#FFFFFF",
            border: `1px solid ${RT.border}`,
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            color: RT.text,
            cursor: "pointer",
            textAlign: "left",
            textDecoration: "underline",
            textUnderlineOffset: 2,
          }}
        >
          Edit Base Resume
        </button>
      )}

      {sections
        .filter((s) => s.type !== "meta")
        .map((section) => {
          const expanded = expandedId === section.id;
          const isHeader = section.type === "header";
          const isSkills = isSkillsEmphasisSection(section);

          return (
            <div
              key={section.id}
              style={{
                borderBottom: `1px solid ${RT.border}`,
                background: expanded ? "#FAFAFA" : "transparent",
              }}
            >
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : section.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 4px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                    color: RT.text,
                  }}
                >
                  {isHeader ? "Personal Info" : section.title}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {!isHeader && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSkills) return;
                          if (editingTextId === section.id) {
                            setEditingTextId(null);
                          } else {
                            setEditingTextId(section.id);
                            setTextDraft(section.content);
                          }
                          setExpandedId(section.id);
                        }}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: RT.muted }}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSection(section.id);
                        }}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: RT.muted }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                  <ChevronDown
                    size={14}
                    color={RT.muted}
                    style={{
                      transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.15s ease",
                    }}
                  />
                </div>
              </button>

              {expanded && (
                <div style={{ padding: "0 4px 14px" }}>
                  {isHeader ? (
                    <textarea
                      value={section.content}
                      onChange={(e) => updateSection(section.id, { content: e.target.value })}
                      rows={4}
                      placeholder={"YOUR NAME, MBA\nCity, ST | phone | email | linkedin"}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        border: `1px solid ${RT.border}`,
                        borderRadius: 6,
                        fontSize: 13,
                        fontFamily: fontSans,
                        resize: "vertical",
                        boxSizing: "border-box",
                        lineHeight: 1.5,
                      }}
                    />
                  ) : isSkills ? (
                    <>
                      {parseSkillsSectionContent(section.content).map((group) => (
                        <SkillGroupEditor
                          key={group.id}
                          group={group}
                          onChange={(next) => {
                            const groups = parseSkillsSectionContent(section.content).map((g) =>
                              g.id === group.id ? next : g,
                            );
                            updateSkillsSection(section.id, groups);
                          }}
                          onRemoveGroup={() => {
                            const groups = parseSkillsSectionContent(section.content).filter(
                              (g) => g.id !== group.id,
                            );
                            updateSkillsSection(
                              section.id,
                              groups.length ? groups : [{ id: "sg_0", label: "Skills", skills: [] }],
                            );
                          }}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const groups = parseSkillsSectionContent(section.content);
                          updateSkillsSection(section.id, [
                            ...groups,
                            { id: `sg_${Date.now()}`, label: "New Group", skills: [] },
                          ]);
                        }}
                        style={{
                          width: "100%",
                          padding: "8px",
                          background: "transparent",
                          border: `1px dashed ${RT.border}`,
                          borderRadius: 6,
                          fontSize: 12,
                          color: RT.muted,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                        }}
                      >
                        <Plus size={12} /> Add group
                      </button>
                    </>
                  ) : (
                    <textarea
                      value={editingTextId === section.id ? textDraft : section.content}
                      onChange={(e) => {
                        setTextDraft(e.target.value);
                        updateSection(section.id, { content: e.target.value });
                      }}
                      onFocus={() => {
                        setEditingTextId(section.id);
                        setTextDraft(section.content);
                      }}
                      rows={section.type === "bullets" ? 8 : 5}
                      placeholder={
                        section.type === "bullets" ? "One bullet or job block per line…" : "Section content…"
                      }
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        border: `1px solid ${RT.border}`,
                        borderRadius: 6,
                        fontSize: 13,
                        fontFamily: fontSans,
                        resize: "vertical",
                        boxSizing: "border-box",
                        lineHeight: 1.5,
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}

      <button
        type="button"
        onClick={() => {
          const newSec: TailoredResumeSection = {
            id: `s-${Date.now()}`,
            title: "New Section",
            type: "text",
            content: "",
          };
          onChange([...sections, newSec]);
          setExpandedId(newSec.id);
        }}
        style={{
          width: "100%",
          marginTop: 12,
          padding: "10px",
          background: "transparent",
          border: `1px dashed ${RT.border}`,
          borderRadius: 8,
          fontSize: 13,
          color: RT.muted,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <Plus size={13} /> Add section
      </button>
    </div>
  );
}
