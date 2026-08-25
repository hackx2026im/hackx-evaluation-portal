"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  BookOpen,
  CheckCircle2,
  Loader2,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type Criterion = {
  id: string;
  section_id: string;
  name: string;
  description: string;
  max_score: number;
  grading_bands: string[];
  order_index: number;
};

type Section = {
  id: string;
  name: string;
  total_marks: number;
  order_index: number;
  rubric_criteria: Criterion[];
};

type DeleteTarget =
  | { type: "section"; sectionId: string; label: string }
  | { type: "criterion"; sectionId: string; criterionId: string; label: string };

// ─── Component ──────────────────────────────────────────────────────────────

export function RubricEditorClient({
  initialSections,
}: {
  initialSections: Section[];
}) {
  const [sections, setSections] = useState<Section[]>(initialSections);
  const [sectionExpanded, setSectionExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(initialSections.map((s) => [s.id, true]))
  );
  const [criterionExpanded, setCriterionExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(
      initialSections.flatMap((s) => s.rubric_criteria.map((c) => [c.id, false]))
    )
  );
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [addingCriterionFor, setAddingCriterionFor] = useState<string | null>(null);
  const [newBandText, setNewBandText] = useState<Record<string, string>>({});

  const supabase = createClient();

  // ─── Saving state helpers ────────────────────────────────────────────────

  const markSaving = (id: string) =>
    setSaving((prev) => new Set(prev).add(id));

  const unmarkSaving = (id: string) =>
    setSaving((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  // ─── Section CRUD ────────────────────────────────────────────────────────

  const updateSection = async (
    sectionId: string,
    field: "name" | "total_marks",
    value: string | number
  ) => {
    markSaving(sectionId);
    const { error } = await supabase
      .from("rubric_sections")
      .update({ [field]: value })
      .eq("id", sectionId);
    unmarkSaving(sectionId);

    if (error) {
      toast.error(`Save failed: ${error.message}`);
      return false;
    }
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, [field]: value } : s))
    );
    return true;
  };

  const addSection = async () => {
    setIsAddingSection(true);
    const maxOrder = sections.reduce((m, s) => Math.max(m, s.order_index), 0);
    const { data, error } = await supabase
      .from("rubric_sections")
      .insert({ name: "New Section", total_marks: 0, order_index: maxOrder + 1 })
      .select()
      .single();
    setIsAddingSection(false);

    if (error) {
      toast.error(`Failed to add section: ${error.message}`);
      return;
    }
    const newSection: Section = { ...data, rubric_criteria: [] };
    setSections((prev) => [...prev, newSection]);
    setSectionExpanded((prev) => ({ ...prev, [data.id]: true }));
    toast.success("Section added");
  };

  const confirmDeleteSection = async () => {
    if (!deleteTarget || deleteTarget.type !== "section") return;
    setIsDeleting(true);
    const { error } = await supabase
      .from("rubric_sections")
      .delete()
      .eq("id", deleteTarget.sectionId);
    setIsDeleting(false);

    if (error) {
      toast.error(`Delete failed: ${error.message}`);
    } else {
      setSections((prev) =>
        prev.filter((s) => s.id !== deleteTarget.sectionId)
      );
      toast.success("Section deleted");
    }
    setDeleteTarget(null);
  };

  // ─── Criterion CRUD ──────────────────────────────────────────────────────

  const updateCriterion = async (
    sectionId: string,
    criterionId: string,
    field: keyof Criterion,
    value: any
  ) => {
    markSaving(criterionId);
    const { error } = await supabase
      .from("rubric_criteria")
      .update({ [field]: value })
      .eq("id", criterionId);
    unmarkSaving(criterionId);

    if (error) {
      toast.error(`Save failed: ${error.message}`);
      return false;
    }
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              rubric_criteria: s.rubric_criteria.map((c) =>
                c.id === criterionId ? { ...c, [field]: value } : c
              ),
            }
          : s
      )
    );
    return true;
  };

  const addCriterion = async (sectionId: string) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    const maxOrder = section.rubric_criteria.reduce(
      (m, c) => Math.max(m, c.order_index),
      0
    );
    setAddingCriterionFor(sectionId);
    const { data, error } = await supabase
      .from("rubric_criteria")
      .insert({
        section_id: sectionId,
        name: "New Criterion",
        description: "Describe what this criterion evaluates.",
        max_score: 5,
        grading_bands: [],
        order_index: maxOrder + 1,
      })
      .select()
      .single();
    setAddingCriterionFor(null);

    if (error) {
      toast.error(`Failed to add criterion: ${error.message}`);
      return;
    }
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, rubric_criteria: [...s.rubric_criteria, data] }
          : s
      )
    );
    setCriterionExpanded((prev) => ({ ...prev, [data.id]: true }));
    toast.success("Criterion added");
  };

  const confirmDeleteCriterion = async () => {
    if (!deleteTarget || deleteTarget.type !== "criterion") return;
    setIsDeleting(true);
    const { error } = await supabase
      .from("rubric_criteria")
      .delete()
      .eq("id", deleteTarget.criterionId);
    setIsDeleting(false);

    if (error) {
      toast.error(`Delete failed: ${error.message}`);
    } else {
      setSections((prev) =>
        prev.map((s) =>
          s.id === deleteTarget.sectionId
            ? {
                ...s,
                rubric_criteria: s.rubric_criteria.filter(
                  (c) => c.id !== deleteTarget.criterionId
                ),
              }
            : s
        )
      );
      toast.success("Criterion deleted");
    }
    setDeleteTarget(null);
  };

  // ─── Grading bands ───────────────────────────────────────────────────────

  const addBand = async (sectionId: string, criterion: Criterion) => {
    const text = (newBandText[criterion.id] ?? "").trim();
    if (!text) return;
    const bands = [...criterion.grading_bands, text];
    const ok = await updateCriterion(sectionId, criterion.id, "grading_bands", bands);
    if (ok) setNewBandText((prev) => ({ ...prev, [criterion.id]: "" }));
  };

  const removeBand = async (
    sectionId: string,
    criterion: Criterion,
    index: number
  ) => {
    const bands = criterion.grading_bands.filter((_, i) => i !== index);
    await updateCriterion(sectionId, criterion.id, "grading_bands", bands);
  };

  // ─── Validation helpers ──────────────────────────────────────────────────

  const criteriaSum = (section: Section) =>
    section.rubric_criteria.reduce((sum, c) => sum + Number(c.max_score), 0);

  const grandTotalSections = sections.reduce(
    (sum, s) => sum + Number(s.total_marks),
    0
  );
  const grandTotalCriteria = sections.reduce(
    (sum, s) => sum + criteriaSum(s),
    0
  );
  const globalMismatch = grandTotalSections !== grandTotalCriteria;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-6)" }}>

      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--bw-space-4)",
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: "var(--bw-font-heading)",
              fontSize: "var(--bw-fs-h1-fluid)",
              fontWeight: "var(--bw-fw-bold)" as any,
              lineHeight: "var(--bw-lh-tight)",
            }}
          >
            Rubric Editor
          </h2>
          <p
            style={{
              marginTop: "var(--bw-space-1)",
              fontSize: "var(--bw-fs-sm)",
              color: "var(--bw-content-secondary)",
            }}
          >
            Manage marking sections and criteria. All changes save automatically on blur.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--bw-space-3)",
            flexWrap: "wrap",
          }}
        >
          {/* Grand total summary */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--bw-space-2)",
              padding: "6px 12px",
              borderRadius: "var(--bw-radius-md)",
              border: "1px solid var(--bw-border)",
              fontSize: "var(--bw-fs-sm)",
              background: "var(--bw-bg-primary)",
            }}
          >
            {globalMismatch ? (
              <AlertTriangle size={14} style={{ color: "var(--bw-warning)", flexShrink: 0 }} />
            ) : (
              <CheckCircle2 size={14} style={{ color: "var(--bw-positive)", flexShrink: 0 }} />
            )}
            <span style={{ color: "var(--bw-content-secondary)" }}>Grand total:</span>
            <strong
              style={{ color: globalMismatch ? "var(--bw-warning)" : "var(--bw-content-primary)" }}
            >
              {grandTotalCriteria} / {grandTotalSections} pts
            </strong>
          </div>

          <Button onClick={addSection} disabled={isAddingSection} id="add-section-btn">
            {isAddingSection ? (
              <Loader2 size={14} style={{ marginRight: 6, animation: "spin 1s linear infinite" }} />
            ) : (
              <Plus size={14} style={{ marginRight: 6 }} />
            )}
            Add Section
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {sections.length === 0 && (
        <Card>
          <CardContent
            style={{
              padding: "var(--bw-space-12)",
              textAlign: "center",
              color: "var(--bw-content-tertiary)",
            }}
          >
            <BookOpen
              size={36}
              style={{ margin: "0 auto var(--bw-space-3)", opacity: 0.4 }}
            />
            <p style={{ fontSize: "var(--bw-fs-sm)" }}>
              No rubric sections yet. Click <strong>Add Section</strong> to get started.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sections */}
      {sections.map((section) => {
        const sum = criteriaSum(section);
        const mismatch = sum !== Number(section.total_marks);
        const expanded = sectionExpanded[section.id] ?? true;

        return (
          <Card key={section.id} style={{ overflow: "hidden" }}>
            {/* Section header row */}
            <CardHeader
              style={{
                padding: "var(--bw-space-4) var(--bw-space-5)",
                borderBottom: expanded ? "1px solid var(--bw-border)" : "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--bw-space-3)",
                  flexWrap: "wrap",
                }}
              >
                {/* Expand / collapse */}
                <button
                  id={`section-toggle-${section.id}`}
                  onClick={() =>
                    setSectionExpanded((prev) => ({
                      ...prev,
                      [section.id]: !expanded,
                    }))
                  }
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--bw-content-tertiary)",
                    padding: 0,
                    display: "flex",
                    flexShrink: 0,
                  }}
                  aria-label={expanded ? "Collapse section" : "Expand section"}
                >
                  {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {/* Section name — auto-saves on blur */}
                <Input
                  id={`section-name-${section.id}`}
                  key={`name-${section.id}`}
                  defaultValue={section.name}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== section.name)
                      updateSection(section.id, "name", v);
                  }}
                  placeholder="Section name"
                  style={{
                    fontWeight: 600,
                    fontSize: "var(--bw-fs-base)",
                    border: "1px solid transparent",
                    background: "transparent",
                    padding: "4px 6px",
                    flexGrow: 1,
                    minWidth: 160,
                    maxWidth: 400,
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "var(--bw-border)")
                  }
                  onBlurCapture={(e) =>
                    (e.currentTarget.style.borderColor = "transparent")
                  }
                />

                {/* Right side controls */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--bw-space-2)",
                    marginLeft: "auto",
                    flexWrap: "wrap",
                  }}
                >
                  {/* Criteria-sum vs total_marks badge */}
                  {section.rubric_criteria.length > 0 && (
                    <Badge
                      variant="outline"
                      style={{
                        gap: 4,
                        color: mismatch ? "var(--bw-warning)" : "var(--bw-positive)",
                        borderColor: mismatch ? "var(--bw-warning)" : "var(--bw-positive)",
                        fontSize: "var(--bw-fs-xs)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {mismatch ? (
                        <AlertTriangle size={11} />
                      ) : (
                        <CheckCircle2 size={11} />
                      )}
                      Criteria sum: {sum} pts
                    </Badge>
                  )}

                  {/* Saving indicator */}
                  {saving.has(section.id) && (
                    <Loader2
                      size={14}
                      style={{
                        color: "var(--bw-content-tertiary)",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                  )}

                  {/* Total marks */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--bw-space-2)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "var(--bw-fs-sm)",
                        color: "var(--bw-content-secondary)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Section total:
                    </span>
                    <Input
                      id={`section-total-${section.id}`}
                      key={`total-${section.id}`}
                      type="number"
                      defaultValue={section.total_marks}
                      min={0}
                      onBlur={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v >= 0 && v !== section.total_marks)
                          updateSection(section.id, "total_marks", v);
                      }}
                      style={{ width: 72, textAlign: "center", fontSize: "var(--bw-fs-sm)" }}
                    />
                    <span
                      style={{
                        fontSize: "var(--bw-fs-sm)",
                        color: "var(--bw-content-secondary)",
                      }}
                    >
                      pts
                    </span>
                  </div>

                  {/* Delete section */}
                  <Button
                    id={`delete-section-${section.id}`}
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setDeleteTarget({
                        type: "section",
                        sectionId: section.id,
                        label: section.name,
                      })
                    }
                    style={{
                      color: "var(--bw-negative)",
                      padding: "4px 8px",
                    }}
                    title="Delete section"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {/* Criteria list */}
            {expanded && (
              <CardContent style={{ padding: 0 }}>
                {section.rubric_criteria.length === 0 && (
                  <div
                    style={{
                      padding: "var(--bw-space-5)",
                      textAlign: "center",
                      color: "var(--bw-content-disabled)",
                      fontSize: "var(--bw-fs-sm)",
                    }}
                  >
                    No criteria yet — add one below.
                  </div>
                )}

                {section.rubric_criteria.map((criterion, idx) => {
                  const cExpanded = criterionExpanded[criterion.id] ?? false;
                  const isSavingC = saving.has(criterion.id);

                  return (
                    <div
                      key={criterion.id}
                      style={{
                        borderBottom:
                          idx < section.rubric_criteria.length - 1
                            ? "1px solid var(--bw-border)"
                            : "none",
                      }}
                    >
                      {/* Criterion row header */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--bw-space-3)",
                          padding: "10px var(--bw-space-5)",
                          background: cExpanded
                            ? "var(--bw-bg-secondary)"
                            : "transparent",
                          flexWrap: "wrap",
                          transition: "background 0.15s",
                        }}
                      >
                        {/* Expand criterion */}
                        <button
                          id={`criterion-toggle-${criterion.id}`}
                          onClick={() =>
                            setCriterionExpanded((prev) => ({
                              ...prev,
                              [criterion.id]: !cExpanded,
                            }))
                          }
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--bw-content-disabled)",
                            padding: 0,
                            display: "flex",
                            flexShrink: 0,
                          }}
                          aria-label={
                            cExpanded ? "Collapse criterion" : "Expand criterion"
                          }
                        >
                          {cExpanded ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                        </button>

                        {/* Criterion name */}
                        <Input
                          id={`criterion-name-${criterion.id}`}
                          key={`cname-${criterion.id}`}
                          defaultValue={criterion.name}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== criterion.name)
                              updateCriterion(
                                section.id,
                                criterion.id,
                                "name",
                                v
                              );
                          }}
                          placeholder="Criterion name"
                          style={{
                            fontSize: "var(--bw-fs-sm)",
                            fontWeight: 500,
                            border: "1px solid transparent",
                            background: "transparent",
                            padding: "3px 6px",
                            flexGrow: 1,
                            minWidth: 140,
                            transition: "border-color 0.15s",
                          }}
                          onFocus={(e) =>
                            (e.currentTarget.style.borderColor = "var(--bw-border)")
                          }
                          onBlurCapture={(e) =>
                            (e.currentTarget.style.borderColor = "transparent")
                          }
                        />

                        {/* Right side: max score + saving + delete */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--bw-space-2)",
                            marginLeft: "auto",
                          }}
                        >
                          {isSavingC && (
                            <Loader2
                              size={13}
                              style={{
                                color: "var(--bw-content-disabled)",
                                animation: "spin 1s linear infinite",
                              }}
                            />
                          )}
                          <span
                            style={{
                              fontSize: "var(--bw-fs-xs)",
                              color: "var(--bw-content-tertiary)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Max:
                          </span>
                          <Input
                            id={`criterion-max-${criterion.id}`}
                            key={`cmax-${criterion.id}`}
                            type="number"
                            defaultValue={criterion.max_score}
                            min={1}
                            onBlur={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (!isNaN(v) && v > 0 && v !== criterion.max_score)
                                updateCriterion(
                                  section.id,
                                  criterion.id,
                                  "max_score",
                                  v
                                );
                            }}
                            style={{
                              width: 60,
                              textAlign: "center",
                              fontSize: "var(--bw-fs-sm)",
                            }}
                          />
                          <span
                            style={{
                              fontSize: "var(--bw-fs-xs)",
                              color: "var(--bw-content-tertiary)",
                            }}
                          >
                            pts
                          </span>

                          <Button
                            id={`delete-criterion-${criterion.id}`}
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteTarget({
                                type: "criterion",
                                sectionId: section.id,
                                criterionId: criterion.id,
                                label: criterion.name,
                              })
                            }
                            style={{ color: "var(--bw-negative)", padding: "4px 6px" }}
                            title="Delete criterion"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>

                      {/* Criterion expanded detail */}
                      {cExpanded && (
                        <div
                          style={{
                            padding:
                              "var(--bw-space-4) var(--bw-space-5) var(--bw-space-5)",
                            paddingLeft: "calc(var(--bw-space-5) + 26px)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "var(--bw-space-4)",
                            background: "var(--bw-bg-primary)",
                            borderTop: "1px solid var(--bw-border)",
                          }}
                        >
                          {/* Description */}
                          <div>
                            <label
                              htmlFor={`criterion-desc-${criterion.id}`}
                              style={{
                                display: "block",
                                fontSize: "var(--bw-fs-xs)",
                                fontWeight: 600,
                                color: "var(--bw-content-tertiary)",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                marginBottom: "var(--bw-space-2)",
                              }}
                            >
                              Description
                            </label>
                            <Textarea
                              id={`criterion-desc-${criterion.id}`}
                              key={`cdesc-${criterion.id}`}
                              defaultValue={criterion.description}
                              onBlur={(e) => {
                                const v = e.target.value;
                                if (v !== criterion.description)
                                  updateCriterion(
                                    section.id,
                                    criterion.id,
                                    "description",
                                    v
                                  );
                              }}
                              rows={2}
                              placeholder="Describe what this criterion evaluates..."
                              style={{ fontSize: "var(--bw-fs-sm)", resize: "vertical" }}
                            />
                          </div>

                          {/* Grading bands */}
                          <div>
                            <label
                              style={{
                                display: "block",
                                fontSize: "var(--bw-fs-xs)",
                                fontWeight: 600,
                                color: "var(--bw-content-tertiary)",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                marginBottom: "var(--bw-space-2)",
                              }}
                            >
                              Grading Bands
                            </label>

                            {/* Existing band chips */}
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "var(--bw-space-2)",
                                marginBottom: "var(--bw-space-3)",
                                minHeight: 28,
                              }}
                            >
                              {criterion.grading_bands.length === 0 && (
                                <span
                                  style={{
                                    fontSize: "var(--bw-fs-xs)",
                                    color: "var(--bw-content-disabled)",
                                    alignSelf: "center",
                                  }}
                                >
                                  No bands yet
                                </span>
                              )}
                              {criterion.grading_bands.map((band, bandIdx) => (
                                <Badge
                                  key={bandIdx}
                                  variant="secondary"
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    paddingRight: 4,
                                    fontSize: "var(--bw-fs-xs)",
                                    fontWeight: 400,
                                  }}
                                >
                                  <span>{band}</span>
                                  <button
                                    id={`remove-band-${criterion.id}-${bandIdx}`}
                                    onClick={() =>
                                      removeBand(section.id, criterion, bandIdx)
                                    }
                                    style={{
                                      background: "none",
                                      border: "none",
                                      cursor: "pointer",
                                      color: "inherit",
                                      padding: 0,
                                      display: "flex",
                                      alignItems: "center",
                                      opacity: 0.6,
                                    }}
                                    title="Remove band"
                                    aria-label={`Remove grading band "${band}"`}
                                  >
                                    <X size={10} />
                                  </button>
                                </Badge>
                              ))}
                            </div>

                            {/* Add new band */}
                            <div
                              style={{
                                display: "flex",
                                gap: "var(--bw-space-2)",
                                maxWidth: 440,
                              }}
                            >
                              <Input
                                id={`new-band-${criterion.id}`}
                                value={newBandText[criterion.id] ?? ""}
                                onChange={(e) =>
                                  setNewBandText((prev) => ({
                                    ...prev,
                                    [criterion.id]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addBand(section.id, criterion);
                                  }
                                }}
                                placeholder='e.g. "Excellent · 12–15"'
                                style={{ fontSize: "var(--bw-fs-sm)" }}
                              />
                              <Button
                                id={`add-band-${criterion.id}`}
                                variant="secondary"
                                size="sm"
                                onClick={() => addBand(section.id, criterion)}
                                disabled={!(newBandText[criterion.id] ?? "").trim()}
                                style={{ whiteSpace: "nowrap" }}
                              >
                                <Plus size={13} style={{ marginRight: 4 }} />
                                Add Band
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add criterion button */}
                <div
                  style={{
                    padding: "var(--bw-space-3) var(--bw-space-5)",
                    borderTop:
                      section.rubric_criteria.length > 0
                        ? "1px solid var(--bw-border)"
                        : "none",
                  }}
                >
                  <Button
                    id={`add-criterion-${section.id}`}
                    variant="ghost"
                    size="sm"
                    onClick={() => addCriterion(section.id)}
                    disabled={addingCriterionFor === section.id}
                    style={{
                      fontSize: "var(--bw-fs-sm)",
                      color: "var(--bw-content-secondary)",
                    }}
                  >
                    {addingCriterionFor === section.id ? (
                      <Loader2
                        size={13}
                        style={{
                          marginRight: 6,
                          animation: "spin 1s linear infinite",
                        }}
                      />
                    ) : (
                      <Plus size={13} style={{ marginRight: 6 }} />
                    )}
                    Add Criterion
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteTarget?.type === "section"
                ? "Delete Section"
                : "Delete Criterion"}
            </DialogTitle>
            <p style={{ padding: "0 var(--bw-space-6) var(--bw-space-2)", fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-secondary)", lineHeight: "1.5" }}>
              {deleteTarget?.type === "section"
                ? `Delete the section "${deleteTarget.label}"? All criteria inside it will also be permanently deleted. Any existing evaluations for those criteria will be removed (CASCADE). This cannot be undone.`
                : `Delete the criterion "${deleteTarget?.label}"? Any existing evaluations scored against this criterion will also be deleted (CASCADE). This cannot be undone.`}
            </p>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              id="confirm-delete-btn"
              variant="destructive"
              onClick={
                deleteTarget?.type === "section"
                  ? confirmDeleteSection
                  : confirmDeleteCriterion
              }
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2
                  size={14}
                  style={{ marginRight: 6, animation: "spin 1s linear infinite" }}
                />
              ) : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
