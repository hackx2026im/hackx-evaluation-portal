"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileText,
  ExternalLink,
  CheckCircle2,
  Loader2,
  Edit,
  Save,
  Video,
  Lock,
} from "lucide-react";
import { timeAgo } from "@/lib/utils";
import type { Proposal, RubricSection, Evaluation, PdfAnnotation, VideoComment } from "@/lib/types/database";
import { PdfAnnotationPanel } from "@/components/pdf-annotation-panel";
import { VideoPanel } from "@/components/video-panel";
import { EvaluationLockedDialog } from "@/components/evaluation-locked-dialog";

interface Props {
  proposal: Proposal;
  sections: RubricSection[];
  existingEvaluations: Evaluation[];
  currentUserId: string;
  serverNow?: string;
  annotations?: PdfAnnotation[];
  videoComments?: VideoComment[];
  evaluatorName?: string;
  initialOverallNotes?: string;
  evaluationsLocked?: boolean;
  isAdmin?: boolean;
}

const getBandColor = (text: string) => {
  const lower = text.toLowerCase();
  if (lower.includes("excellent") || lower.includes("outstanding") || lower.includes("high")) return "positive";
  if (lower.includes("good") || lower.includes("proficient") || lower.includes("above average")) return "accent";
  if (lower.includes("average") || lower.includes("fair") || lower.includes("adequate") || lower.includes("developing")) return "warning";
  if (lower.includes("poor") || lower.includes("weak") || lower.includes("below") || lower.includes("fail")) return "negative";
  return "secondary";
};

export function EvaluationViewClient({
  proposal,
  sections,
  existingEvaluations,
  currentUserId,
  serverNow = new Date().toISOString(),
  annotations = [],
  videoComments = [],
  evaluatorName = "",
  initialOverallNotes = "",
  evaluationsLocked = false,
  isAdmin = false,
}: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [globalNotes, setGlobalNotes] = useState(initialOverallNotes);

  const isAlreadyGraded = existingEvaluations.length > 0;
  const [isEditing, setIsEditing] = useState(!isAlreadyGraded);

  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [pulseEdit, setPulseEdit] = useState(false);
  const [showLockedDialog, setShowLockedDialog] = useState(false);

  // Effective lock: locked for evaluators, but admins always bypass
  const effectivelyLocked = evaluationsLocked && !isAdmin;

  const handleLockedInteraction = () => {
    if (!isEditing && isAlreadyGraded) {
      if (effectivelyLocked) {
        setShowLockedDialog(true);
      } else {
        toast.info("Click 'Edit Grading' below to unlock scoring");
        setPulseEdit(true);
        setTimeout(() => setPulseEdit(false), 2000);
      }
    }
  };

  const [activeTab, setActiveTab] = useState<string>("rubric");

  useEffect(() => {
    if (existingEvaluations.length > 0) {
      const initialScores: Record<string, number> = {};
      const initialNotes: Record<string, string> = {};

      existingEvaluations.forEach((ev) => {
        initialScores[ev.rubric_criterion_id] = ev.score;
        if (ev.notes) initialNotes[ev.rubric_criterion_id] = ev.notes;
      });

      setScores(initialScores);

      // ── Bleed-through detection ───────────────────────────────────────
      // The old bug stored globalNotes into every criterion that had no
      // individual note. Signature: the same non-empty text appears on
      // more than one criterion. Migrate it to globalNotes and strip it
      // from per-criterion notes so the UI shows it in the right place.
      const noteFrequency: Record<string, number> = {};
      Object.values(initialNotes).forEach((note) => {
        if (note.trim()) noteFrequency[note] = (noteFrequency[note] ?? 0) + 1;
      });

      const bleedThroughText = Object.entries(noteFrequency)
        .find(([, count]) => count > 1)?.[0];

      if (bleedThroughText) {
        setGlobalNotes(bleedThroughText);
        // Keep only notes that are genuinely unique to one criterion
        const cleanNotes: Record<string, string> = {};
        Object.entries(initialNotes).forEach(([id, note]) => {
          if (note !== bleedThroughText) cleanNotes[id] = note;
        });
        setNotes(cleanNotes);
      } else {
        setNotes(initialNotes);
      }
    }
  }, [existingEvaluations]);

  const handleScoreChange = useCallback(
    (criterionId: string, value: string, maxScore: number) => {
      // Empty field → treat as "not yet entered" so the validation
      // gate catches it rather than silently storing 0.
      if (value === "") {
        setScores((prev) => {
          const next = { ...prev };
          delete next[criterionId];
          return next;
        });
        return;
      }

      const numValue = Number(value);

      // Reject non-numeric input (letters, symbols, etc.) without
      // overwriting the previously stored value.
      if (isNaN(numValue)) return;

      // Floor to integer (handles "7." mid-entry gracefully) then clamp.
      const clamped = Math.min(Math.max(0, Math.floor(numValue)), maxScore);
      setScores((prev) => ({ ...prev, [criterionId]: clamped }));
    },
    []
  );

  const handleNotesChange = useCallback(
    (criterionId: string, value: string) => {
      setNotes((prev) => ({ ...prev, [criterionId]: value }));
    },
    []
  );

  const totalScore = Object.values(scores).reduce(
    (sum, score) => sum + score,
    0
  );
  const maxPossibleScore = sections.reduce((sum, s) => sum + s.total_marks, 0);

  const handleSubmit = async () => {
    const allCriteria = sections.flatMap((s) => s.criteria ?? []);
    const missingScores = allCriteria.filter(
      (c) => scores[c.id] === undefined || scores[c.id] === null
    );

    if (missingScores.length > 0) {
      toast.error(
        `Please score all criteria. Missing: ${missingScores.map((c) => c.name).join(", ")}`
      );
      return;
    }

    setLoading(true);

    // Fire-and-forget snapshot helper — calls the server-side API route which
    // uses the service role key. Never throws; grading is never blocked by this.
    const fireSnapshot = (data: any) => {
      fetch("/api/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId: proposal.id,
          teamName: proposal.team_name,
          evaluatorName,
          evaluatorId: currentUserId,
          evaluationData: data,
        }),
      }).catch((err) => {
        console.error("[snapshot] fetch failed (non-fatal):", err);
      });
    };

    try {
      const evaluationRows = allCriteria.map((criterion) => ({
        rubric_criterion_id: criterion.id,
        score: scores[criterion.id] ?? 0,
        notes: notes[criterion.id] || "",
      }));

      const { error: rpcError } = await supabase.rpc("submit_evaluation", {
        p_proposal_id: proposal.id,
        p_evaluations: evaluationRows,
      });

      if (rpcError) throw rpcError;

      // Persist overall comment — non-blocking, never prevents submit
      supabase
        .from("evaluation_overall_notes")
        .upsert(
          { proposal_id: proposal.id, notes: globalNotes, updated_at: new Date().toISOString() },
          { onConflict: "proposal_id,evaluator_id" }
        )
        .then(({ error }) => {
          if (error) console.warn("[overall_notes] upsert failed (non-fatal):", error.message);
        });

      // Kick off snapshot in background — does NOT await, never blocks the user
      fireSnapshot(evaluationRows);

      toast.success("Evaluation saved successfully!");
      setIsEditing(false);
      router.push("/evaluator");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save evaluation"
      );
    } finally {
      setLoading(false);
    }
  };

  const hasPdf = !!proposal.proposal_url;
  const hasVideo = !!proposal.video_url;
  const hasMedia = hasPdf || hasVideo;

  // ── Extracted as a stable inner component so each layout copy (desktop /
  // mobile) owns its own DOM tree with unique ids, and React can reconcile
  // them independently without key or id collisions.
  const RubricFormContent = useCallback(() => (
    <div onClickCapture={handleLockedInteraction} style={{ position: "relative", display: "flex", flexDirection: "column", gap: "var(--bw-space-4)" }}>
      {/* Sticky total marks bar — offset accounts for navbar height (~64px) */}
      <div style={{ position: "sticky", top: 72, zIndex: 20, background: "var(--bw-bg-primary)", padding: "10px 20px", borderRadius: "var(--bw-radius-md)", border: "1px solid var(--bw-border)", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "var(--bw-shadow-100)" }}>
        <span style={{ fontSize: "var(--bw-fs-sm)", fontWeight: "var(--bw-fw-medium)" as any, color: "var(--bw-content-secondary)" }}>Total Marks</span>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--bw-space-4)" }}>
          <Progress value={maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0} style={{ width: 120, height: 6 }} />
          <span style={{ fontSize: "var(--bw-fs-h4)", fontWeight: "var(--bw-fw-bold)" as any }}>{totalScore}<span style={{ fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-tertiary)", fontWeight: "var(--bw-fw-normal)" as any }}>/{maxPossibleScore}</span></span>
        </div>
      </div>
      {sections.map((section) => (
        <div key={section.id} style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-4)", marginTop: "var(--bw-space-4)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "var(--bw-space-2)", borderBottom: "2px solid var(--bw-border-strong)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <h3 style={{ fontSize: "var(--bw-fs-h3)", fontWeight: "var(--bw-fw-bold)", margin: 0 }}>{section.name}</h3>
              <p style={{ fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-secondary)", margin: 0 }}>
                {section.total_marks} marks total
              </p>
            </div>
            <Badge variant="secondary" style={{ fontSize: "var(--bw-fs-sm)", padding: "var(--bw-space-1) var(--bw-space-3)" }}>
              {(section.criteria ?? []).reduce(
                (sum, c) => sum + (scores[c.id] ?? 0),
                0
              )}{" "}
              / {section.total_marks}
            </Badge>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-4)" }}>
            {(section.criteria ?? []).map((criterion) => (
              <Card key={criterion.id} variant="flat" style={{ opacity: !isEditing ? 0.9 : 1, background: "var(--bw-bg-primary)" }}>
                <CardContent style={{ padding: "var(--bw-space-5) var(--bw-space-6)", display: "flex", flexDirection: "column", gap: "var(--bw-space-3)" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--bw-space-3)" }}>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--bw-space-1)" }}>
                      <h4 style={{ fontSize: "var(--bw-fs-sm)", fontWeight: "var(--bw-fw-medium)" as any, margin: 0 }}>{criterion.name}</h4>
                      <p style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-secondary)", lineHeight: "var(--bw-lh-relaxed)", margin: 0 }}>
                        {criterion.description}
                      </p>
                    </div>
                    {/* Score input — fixed size, 44px min height per DESIGN.md touch targets */}
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--bw-space-2)", flexShrink: 0, paddingTop: 2 }}>
                      <Input
                        id={`score-${criterion.id}`}
                        type="number"
                        min={0}
                        max={criterion.max_score}
                        value={
                          scores[criterion.id] !== undefined
                            ? String(scores[criterion.id])
                            : ""
                        }
                        onChange={(e) =>
                          handleScoreChange(
                            criterion.id,
                            e.target.value,
                            criterion.max_score
                          )
                        }
                        style={{ 
                          width: 64, 
                          textAlign: "center", 
                          fontWeight: "var(--bw-fw-bold)" as any, 
                          height: 44, 
                          fontSize: "16px", /* prevent iOS zoom */
                          border: "1.5px solid rgba(255, 255, 255, 0.8)",
                          backgroundColor: "rgba(255, 255, 255, 0.05)"
                        }}
                        disabled={!isEditing}
                      />
                      <span style={{ fontSize: "var(--bw-fs-xs)", fontWeight: "var(--bw-fw-medium)" as any, color: "var(--bw-content-secondary)", whiteSpace: "nowrap" }}>
                        / {criterion.max_score}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {criterion.grading_bands.map((band, idx) => (
                      <Badge
                        key={idx}
                        variant={getBandColor(band) as any}
                        style={{ fontWeight: "var(--bw-fw-normal)" as any }}
                      >
                        {band}
                      </Badge>
                    ))}
                  </div>

                  <Textarea
                    id={`notes-${criterion.id}`}
                    placeholder={`Comments for ${criterion.name}...`}
                    value={notes[criterion.id] ?? ""}
                    onChange={(e) => handleNotesChange(criterion.id, e.target.value)}
                    style={{ minHeight: 60, fontSize: "var(--bw-fs-sm)" }}
                    disabled={!isEditing}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      <Card variant="flat" style={{ opacity: !isEditing ? 0.9 : 1, background: "var(--bw-bg-primary)" }}>
        <CardHeader style={{ padding: "var(--bw-space-6) var(--bw-space-6) var(--bw-space-4)", borderBottom: "1px solid var(--bw-border)" }}>
          <CardTitle style={{ fontSize: "var(--bw-fs-h4)" }}>Overall Comments</CardTitle>
        </CardHeader>
        <CardContent style={{ padding: "var(--bw-space-6)" }}>
          <Textarea
            id="global-notes"
            placeholder="Final feedback for the team..."
            value={globalNotes}
            onChange={(e) => setGlobalNotes(e.target.value)}
            style={{ minHeight: 100, fontSize: "var(--bw-fs-sm)" }}
            disabled={!isEditing}
          />
        </CardContent>
      </Card>
    </div>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [scores, notes, globalNotes, isEditing, sections, handleScoreChange, handleNotesChange, handleLockedInteraction, maxPossibleScore, totalScore]);

  const RubricForm = RubricFormContent();

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-4)", maxWidth: hasMedia ? 1600 : 1024, margin: "0 auto", paddingBottom: "calc(96px + env(safe-area-inset-bottom))", position: "relative" }}>
        {/* Header */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "var(--bw-space-4)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-1)" }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/evaluator")}
              style={{ color: "var(--bw-content-secondary)", marginLeft: "-8px", marginBottom: "var(--bw-space-2)", alignSelf: "flex-start" }}
            >
              <ArrowLeft size={16} style={{ marginRight: 8 }} />
              Back to Dashboard
            </Button>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--bw-space-3)" }}>
              <h2
                style={{ fontFamily: "var(--bw-font-heading)", fontSize: "var(--bw-fs-h2-fluid)", fontWeight: "var(--bw-fw-bold)" as any, lineHeight: "var(--bw-lh-tight)" }}
              >
                {proposal.team_name}
              </h2>
              {!isEditing && <Badge variant="secondary">Read Only</Badge>}
              {effectivelyLocked && (
                <Badge variant="warning" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Lock size={10} />
                  Locked
                </Badge>
              )}
              {isAdmin && evaluationsLocked && (
                <Badge variant="positive" style={{ fontSize: "var(--bw-fs-xs)" }}>Admin Override</Badge>
              )}
            </div>
            {proposal.description && (
              <p style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-secondary)", marginTop: "var(--bw-space-2)", maxWidth: 672, lineHeight: "var(--bw-lh-relaxed)" }}>
                {proposal.description}
              </p>
            )}
          </div>
        </div>

        {hasMedia ? (
          <>
            {/* Desktop layout */}
            <div className="hidden xl:grid xl:grid-cols-[3fr_2fr] xl:gap-6 items-start">
              <div style={{ border: "1px solid var(--bw-border-strong)", borderRadius: "var(--bw-radius-md)", overflow: "hidden", background: "var(--bw-bg-primary)", display: "flex", flexDirection: "column", height: "calc(100vh - 180px)", position: "sticky", top: 90 }}>
                <Tabs defaultValue={hasPdf ? "document" : "video"} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                  <TabsList variant="line" style={{ padding: "0 var(--bw-space-3)", flexShrink: 0 }}>
                    {hasPdf && (
                      <TabsTrigger value="document">
                        <FileText size={14} style={{ marginRight: 6 }} />
                        Document
                      </TabsTrigger>
                    )}
                    {hasVideo && (
                      <TabsTrigger value="video">
                        <Video size={14} style={{ marginRight: 6 }} />
                        Video
                      </TabsTrigger>
                    )}
                  </TabsList>
                  {hasPdf && (
                    <TabsContent value="document" style={{ flex: 1, overflow: "hidden" }}>
                      <PdfAnnotationPanel
                        proposalUrl={proposal.proposal_url}
                        proposalId={proposal.id}
                        evaluatorId={currentUserId}
                        evaluatorName={evaluatorName}
                        annotations={annotations}
                        isEditing={isEditing}
                      />
                    </TabsContent>
                  )}
                  {hasVideo && (
                    <TabsContent value="video" style={{ flex: 1, overflow: "hidden" }}>
                      <VideoPanel
                        videoUrl={proposal.video_url}
                        proposalId={proposal.id}
                        evaluatorId={currentUserId}
                        evaluatorName={evaluatorName}
                        comments={videoComments}
                        isEditing={isEditing}
                      />
                    </TabsContent>
                  )}
                </Tabs>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-4)" }}>
                {RubricForm}
              </div>
            </div>

            {/* Mobile/Tablet layout */}
            <div className="xl:hidden">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList variant="line" style={{ width: "100%", marginBottom: "var(--bw-space-4)" }}>
                  <TabsTrigger value="rubric" style={{ flex: 1 }}>
                    Rubric
                  </TabsTrigger>
                  {hasPdf && (
                    <TabsTrigger value="document" style={{ flex: 1 }}>
                      <FileText size={14} style={{ marginRight: 6 }} />
                      Document
                    </TabsTrigger>
                  )}
                  {hasVideo && (
                    <TabsTrigger value="video" style={{ flex: 1 }}>
                      <Video size={14} style={{ marginRight: 6 }} />
                      Video
                    </TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="rubric">
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-4)" }}>{RubricForm}</div>
                </TabsContent>

                {hasPdf && (
                  <TabsContent value="document">
                    <div style={{ border: "1px solid var(--bw-border-strong)", borderRadius: "var(--bw-radius-md)", overflow: "hidden", background: "var(--bw-bg-primary)", minHeight: "60vh" }}>
                      <PdfAnnotationPanel
                        proposalUrl={proposal.proposal_url}
                        proposalId={proposal.id}
                        evaluatorId={currentUserId}
                        evaluatorName={evaluatorName}
                        annotations={annotations}
                        isEditing={isEditing}
                      />
                    </div>
                  </TabsContent>
                )}

                {hasVideo && (
                  <TabsContent value="video">
                    <div style={{ border: "1px solid var(--bw-border-strong)", borderRadius: "var(--bw-radius-md)", overflow: "hidden", background: "var(--bw-bg-primary)" }}>
                      <VideoPanel
                        videoUrl={proposal.video_url}
                        proposalId={proposal.id}
                        evaluatorId={currentUserId}
                        evaluatorName={evaluatorName}
                        comments={videoComments}
                        isEditing={isEditing}
                      />
                    </div>
                  </TabsContent>
                )}
              </Tabs>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-4)", maxWidth: 1024 }}>{RubricForm}</div>
        )}

        {/* Action Buttons (Fixed Bottom Banner) */}
        <div style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          /* Safe area: clears Android gesture nav bar */
          paddingBottom: "max(16px, calc(12px + env(safe-area-inset-bottom)))",
          paddingTop: 16,
          paddingLeft: "var(--bw-space-6)",
          paddingRight: "var(--bw-space-6)",
          background: "var(--bw-bg-primary)",
          borderTop: "1px solid var(--bw-border)",
          zIndex: 50,
          display: "flex",
          justifyContent: "flex-end",
        }}>
          <div style={{ maxWidth: hasMedia ? 1600 : 1024, margin: "0 auto", width: "100%", display: "flex", justifyContent: "flex-end", gap: "var(--bw-space-3)" }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push("/evaluator")}
            >
              Cancel
            </Button>

            {!isEditing ? (
              <>
                {effectivelyLocked ? (
                  // Evaluations are locked — show locked button that opens popup
                  <Button
                    variant="secondary"
                    size="sm"
                    style={{ minWidth: 160, opacity: 0.7 }}
                    onClick={() => setShowLockedDialog(true)}
                  >
                    <Lock size={14} style={{ marginRight: 8 }} />
                    Results Locked
                  </Button>
                ) : (
                  // Not locked — show Edit Grading as normal
                  <Button
                    variant="primary"
                    size="sm"
                    style={{ minWidth: 160, transition: "all 0.2s ease", transform: pulseEdit ? "scale(1.05)" : "scale(1)", boxShadow: pulseEdit ? "0 0 0 4px var(--bw-primary-light, rgba(0,0,0,0.1))" : "none" }}
                    onClick={() => setShowEditConfirm(true)}
                  >
                    <Edit size={14} style={{ marginRight: 8 }} />
                    Edit Grading
                  </Button>
                )}
                <AlertDialog open={showEditConfirm} onOpenChange={setShowEditConfirm}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Edit this evaluation?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This proposal has already been graded. Are you sure you want to enter edit mode and modify the scores?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => {
                        setShowEditConfirm(false);
                        setIsEditing(true);
                      }}>
                        Yes, Edit Grading
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <>
                {!effectivelyLocked && (
                  <Button
                    variant="primary"
                    size="sm"
                    style={{ minWidth: 160 }}
                    disabled={loading}
                    onClick={() => setShowSubmitConfirm(true)}
                  >
                    {loading ? (
                      <Loader2 size={14} style={{ marginRight: 8, animation: "spin 1s linear infinite" }} />
                    ) : isAlreadyGraded ? (
                      <Save size={14} style={{ marginRight: 8 }} />
                    ) : (
                      <CheckCircle2 size={14} style={{ marginRight: 8 }} />
                    )}
                    {loading ? "Saving..." : isAlreadyGraded ? "Save Changes" : "Submit Evaluation"}
                  </Button>
                )}
                <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Submit evaluation?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to {isAlreadyGraded ? "save these changes" : "submit this evaluation"}? Please double-check the scores before proceeding.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Review Again</AlertDialogCancel>
                      <AlertDialogAction onClick={() => {
                        setShowSubmitConfirm(false);
                        handleSubmit();
                      }}>
                        Yes, Submit
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>
      </div>
      <EvaluationLockedDialog open={showLockedDialog} onClose={() => setShowLockedDialog(false)} />
    </>
  );
}
