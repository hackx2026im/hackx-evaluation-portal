"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ClipboardCheck,
  ExternalLink,
  FileText,
  Search,
  Trophy,
  Edit,
  BarChart,
  Loader2,
  CalendarDays,
  Hourglass,
  ClipboardList,
  ChevronDown,
} from "lucide-react";
import { OnboardingModal } from "@/components/onboarding-modal";
import { FeedbackModal } from "@/components/feedback-modal";
import { EvaluationLockedDialog } from "@/components/evaluation-locked-dialog";
import type { Proposal, Profile, ProposalAssignment, EvaluatorFeedback } from "@/lib/types/database";
import Link from "next/link";
import { toast } from "sonner";

interface Props {
  proposals: Proposal[];
  currentUserId: string;
  gradedProposalIds: string[];
  profiles: Pick<Profile, "id" | "full_name">[];
  breakdownData?: Record<string, any[]>;
  scoresByProposal?: Record<string, Record<string, { name: string; total: number }>>;
  assignments: ProposalAssignment[];
  serverNow?: string;
  daysLeft?: string;
  hasSeenOnboarding?: boolean;
  myOverallNotes?: Record<string, string>;
  feedbackRecord?: EvaluatorFeedback | null;
  hasSeenFeedbackPrompt?: boolean;
  evaluationsLocked?: boolean;
  maxPossibleScore?: number;
  globalBreakdownData?: Record<string, any[]>;
  evaluatorByProposal?: Record<string, string[]>;
  globalOverallNotes?: Record<string, Record<string, string>>;
}

export function EvaluatorDashboardClient({
  proposals,
  currentUserId,
  gradedProposalIds,
  profiles,
  breakdownData,
  scoresByProposal = {},
  assignments = [],
  daysLeft = "14",
  hasSeenOnboarding = true,
  myOverallNotes = {},
  feedbackRecord = null,
  hasSeenFeedbackPrompt = false,
  evaluationsLocked = false,
  maxPossibleScore = 100,
  globalBreakdownData = {},
  evaluatorByProposal = {},
  globalOverallNotes = {},
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(!hasSeenOnboarding);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState<EvaluatorFeedback | null>(feedbackRecord);
  const [showLockedDialog, setShowLockedDialog] = useState(false);

  // (Feedback auto-show logic moved below myAssignments)



  useEffect(() => {
    const error = searchParams.get("error");
    if (error === "not_assigned") {
      toast.error("You are not assigned to evaluate that proposal.");
      router.replace("/evaluator");
    } else if (error === "locked") {
      toast.error("Evaluations are locked. The deadline has passed.");
      router.replace("/evaluator");
    }
  }, [searchParams, router]);

  const handleEvaluate = (proposalId: string) => {
    if (evaluationsLocked) {
      setShowLockedDialog(true);
      return;
    }
    setNavigatingTo(proposalId);
    router.push(`/evaluator/evaluate/${proposalId}`);
  };

  const evaluatorMap = useMemo(() => {
    return new Map(profiles.map((p) => [p.id, p.full_name]));
  }, [profiles]);

  const assigneesByProposal = useMemo(() => {
    const map: Record<string, string[]> = {};
    assignments.forEach(a => {
      if (!map[a.proposal_id]) map[a.proposal_id] = [];
      map[a.proposal_id].push(a.evaluator_id);
    });
    return map;
  }, [assignments]);

  const myAssignments = useMemo(
    () => proposals.filter((p) => assigneesByProposal[p.id]?.includes(currentUserId)),
    [proposals, assigneesByProposal, currentUserId]
  );

  const isAllGraded = useMemo(() => {
    return myAssignments.length > 0 && myAssignments.every((p) => gradedProposalIds.includes(p.id));
  }, [myAssignments, gradedProposalIds]);

  // Auto-show feedback popup when all assignments are graded and feedback not yet seen
  useEffect(() => {
    if (isOnboardingOpen) return; // wait for onboarding to complete if it's open
    if (isAllGraded && !hasSeenFeedbackPrompt) {
      const timer = setTimeout(() => setIsFeedbackOpen(true), 400);
      return () => clearTimeout(timer);
    }
  }, [isAllGraded, isOnboardingOpen, hasSeenFeedbackPrompt]);

  const filteredAssignments = useMemo(() => {
    let result = myAssignments;
    if (showOnlyPending) result = result.filter((p) => !gradedProposalIds.includes(p.id));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.team_name.toLowerCase().includes(q) ||
          p.product_name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }
    return result;
  }, [myAssignments, searchQuery, showOnlyPending, gradedProposalIds]);



  const renderBreakdownDialog = (
    proposal: Proposal,
    triggerContent: React.ReactNode,
    isButton?: boolean
  ) => {
    const isGradedByMe = gradedProposalIds.includes(proposal.id);
    // Other evaluators' scores (privacy: only show total, never rubric)
    const otherEvalScores = Object.entries(scoresByProposal[proposal.id] ?? {})
      .filter(([evalId]) => evalId !== currentUserId);
    const myScore = scoresByProposal[proposal.id]?.[currentUserId];

    return (
      <Dialog>
        <DialogTrigger asChild>
          {isButton ? (
            <Button variant="secondary" size="sm">
              {triggerContent}
            </Button>
          ) : (
            <button
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--bw-content-tertiary)",
                padding: 4,
                borderRadius: "var(--bw-radius-circle)",
                display: "flex",
              }}
            >
              {triggerContent}
            </button>
          )}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
          <DialogTitle style={{ fontSize: "var(--bw-fs-h4)" }}>{proposal.team_name}</DialogTitle>
          </DialogHeader>
          <div style={{ padding: "0 var(--bw-space-6) var(--bw-space-6)", display: "flex", flexDirection: "column", gap: "var(--bw-space-4)" }}>
            {/* Evaluators Status */}
            {(assigneesByProposal[proposal.id] || []).length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-2)" }}>
                <div style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-tertiary)", fontWeight: "var(--bw-fw-medium)" as any }}>Evaluators Status</div>
                {/* My status row */}
                {(assigneesByProposal[proposal.id] || []).includes(currentUserId) && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--bw-space-2) var(--bw-space-3)", borderRadius: "var(--bw-radius-sm)", background: "var(--bw-hover-light)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--bw-space-2)" }}>
                      <span style={{ fontSize: "var(--bw-fs-sm)", fontWeight: "var(--bw-fw-medium)" as any }}>You</span>
                    </div>
                    {isGradedByMe && myScore ? (
                      <Badge variant="positive">Graded ({myScore.total}/{maxPossibleScore})</Badge>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                  </div>
                )}
                {/* Other evaluators — status only */}
                {(assigneesByProposal[proposal.id] || []).filter(id => id !== currentUserId).map((evalId) => {
                  const name = evaluatorMap.get(evalId) || "Unknown";
                  const hasGraded = !!scoresByProposal[proposal.id]?.[evalId];
                  return (
                    <div key={evalId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--bw-space-2) var(--bw-space-3)", borderRadius: "var(--bw-radius-sm)", border: "1px solid var(--bw-border)" }}>
                      <span style={{ fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-secondary)" }}>{name}</span>
                      <Badge variant={hasGraded ? "positive" : "secondary"}>
                        {hasGraded ? "Graded" : "Pending"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}

            {isGradedByMe && breakdownData?.[proposal.id] && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-2)", borderTop: "1px solid var(--bw-border)", paddingTop: "var(--bw-space-4)" }}>
                <div style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-tertiary)", marginBottom: "var(--bw-space-1)" }}>Your Rubric Breakdown</div>
                {(() => {
                  // Guard legacy bleed-through: same note on >1 criterion is globalNotes that bled through
                  const noteFreq: Record<string, number> = {};
                  breakdownData[proposal.id].forEach(c => {
                    if (c.notes?.trim()) noteFreq[c.notes] = (noteFreq[c.notes] ?? 0) + 1;
                  });
                  const bleedText = Object.entries(noteFreq).find(([txt, cnt]) => cnt > 1 && txt.trim().length > 10)?.[0];

                  // Overall comment: prefer dedicated table, fall back to bleed-through rescue
                  const overallComment = myOverallNotes[proposal.id] || bleedText || "";

                  return (
                    <>
                      {breakdownData[proposal.id].map((criterion, i) => (
                        <div key={i} style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-1)", padding: "var(--bw-space-2) 0", borderBottom: i < breakdownData![proposal.id].length - 1 ? "1px dashed var(--bw-border)" : "none" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "var(--bw-fs-sm)" }}>
                            <span style={{ color: "var(--bw-content-secondary)", paddingRight: 16 }}>{criterion.name}</span>
                            <span style={{ fontWeight: "var(--bw-fw-medium)" as any }}>{criterion.score}/{criterion.max_score}</span>
                          </div>
                          {criterion.notes && criterion.notes !== bleedText && (
                            <p style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-tertiary)", fontStyle: "italic", margin: 0, paddingLeft: 4, borderLeft: "2px solid var(--bw-border)" }}>
                              {criterion.notes}
                            </p>
                          )}
                        </div>
                      ))}
                      {overallComment && (
                        <div style={{ marginTop: "var(--bw-space-2)", padding: "var(--bw-space-3)", background: "var(--bw-chip)", borderRadius: "var(--bw-radius-md)" }}>
                          <div style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Overall Comment</div>
                          <p style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-primary)", margin: 0, fontStyle: "italic" }}>{overallComment}</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}


            <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-2)", borderTop: "1px solid var(--bw-border)", paddingTop: "var(--bw-space-4)" }}>
              {proposal.proposal_url && (
                <a href={proposal.proposal_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" size="sm" style={{ width: "100%", justifyContent: "flex-start" }}>
                    <FileText size={14} style={{ marginRight: 8 }} /> View Proposal PDF
                  </Button>
                </a>
              )}
              {proposal.video_url && (
                <a href={proposal.video_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" size="sm" style={{ width: "100%", justifyContent: "flex-start" }}>
                    <ExternalLink size={14} style={{ marginRight: 8 }} /> Watch Pitch Video
                  </Button>
                </a>
              )}
              {isGradedByMe && !evaluationsLocked && (
                <Link href={`/evaluator/evaluate/${proposal.id}`}>
                  <Button size="sm" style={{ width: "100%", justifyContent: "flex-start", marginTop: "var(--bw-space-2)" }}>
                    <Edit size={14} style={{ marginRight: 8 }} /> Edit Grading
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <TooltipProvider>
      <div className="bw-container" style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-6)" }}>
        <div>
          <h2 style={{ fontFamily: "var(--bw-font-heading)", fontSize: "var(--bw-fs-h1-fluid)", fontWeight: "var(--bw-fw-bold)" as any, lineHeight: "var(--bw-lh-tight)" }}>Evaluator Dashboard</h2>
          <p style={{ marginTop: "var(--bw-space-2)", fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-secondary)" }}>
            Review and evaluate hackX 11.0 proposals
          </p>
        </div>

        {/* Main Grid: Cards + Assignments */}
        <div className="flex flex-col gap-6">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-6)", minWidth: 0 }}>
            {/* Quick Stats — Modern Icon Cards */}
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-3">
          {/* My Assignments */}
          <Card variant="flat" style={{ overflow: "hidden", position: "relative" }}>
            <CardContent style={{ padding: "var(--bw-space-5)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: "var(--bw-fs-xs)", fontWeight: "var(--bw-fw-medium)" as any, color: "var(--bw-content-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--bw-space-2)" }}>My Assignments</p>
                  <p style={{ fontSize: 32, fontWeight: "var(--bw-fw-bold)" as any, lineHeight: 1, letterSpacing: "-0.02em" }}>{myAssignments.length}</p>
                  <p style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-tertiary)", marginTop: "var(--bw-space-1)" }}>proposals to review</p>
                </div>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--bw-chip)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <ClipboardCheck size={18} style={{ color: "var(--bw-content-primary)" }} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Remaining */}
          <Card variant="flat" style={{ overflow: "hidden", position: "relative" }}>
            <CardContent style={{ padding: "var(--bw-space-5)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: "var(--bw-fs-xs)", fontWeight: "var(--bw-fw-medium)" as any, color: "var(--bw-content-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--bw-space-2)" }}>Remaining</p>
                  <p style={{ fontSize: 32, fontWeight: "var(--bw-fw-bold)" as any, lineHeight: 1, letterSpacing: "-0.02em", color: myAssignments.filter(p => !gradedProposalIds.includes(p.id)).length > 0 ? "var(--bw-warning)" : "var(--bw-content-primary)" }}>
                    {myAssignments.filter((p) => !gradedProposalIds.includes(p.id)).length}
                  </p>
                  <p style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-tertiary)", marginTop: "var(--bw-space-1)" }}>yet to grade</p>
                </div>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--bw-chip)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Hourglass size={18} style={{ color: "var(--bw-content-primary)" }} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Days Left */}
          {(() => {
            const days = parseInt(daysLeft) || 0;
            const isUrgent = days <= 3;
            return (
              <Card variant="flat" style={{ overflow: "hidden", position: "relative" }}>
                <CardContent style={{ padding: "var(--bw-space-5)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ fontSize: "var(--bw-fs-xs)", fontWeight: "var(--bw-fw-medium)" as any, color: "var(--bw-content-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--bw-space-2)" }}>Days Left</p>
                      <p style={{ fontSize: 32, fontWeight: "var(--bw-fw-bold)" as any, lineHeight: 1, letterSpacing: "-0.02em", color: isUrgent ? "var(--bw-negative)" : "var(--bw-content-primary)" }}>{daysLeft}</p>
                      <p style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-tertiary)", marginTop: "var(--bw-space-1)" }}>until deadline</p>
                    </div>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--bw-chip)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <CalendarDays size={18} style={{ color: "var(--bw-content-primary)" }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </div>

{/* Table 1: My Assignments */}
          <Card variant="flat" style={{ display: "flex", flexDirection: "column" }}>
              <CardHeader style={{ padding: "var(--bw-space-6)" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "var(--bw-space-4)" }}>
                  <CardTitle style={{ fontSize: "var(--bw-fs-h4)" }}>My Assignments</CardTitle>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--bw-space-4)", width: "100%", maxWidth: 400 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--bw-space-2)", marginLeft: "auto" }}>
                      <label htmlFor="pending-toggle" style={{ fontSize: "var(--bw-fs-xs)", fontWeight: "var(--bw-fw-medium)" as any, cursor: "pointer", userSelect: "none", color: "var(--bw-content-secondary)" }}>
                        Show Pending
                      </label>
                      <button
                        id="pending-toggle"
                        type="button"
                        role="switch"
                        aria-checked={showOnlyPending}
                        onClick={() => setShowOnlyPending(!showOnlyPending)}
                        style={{
                          width: 32,
                          height: 18,
                          borderRadius: 20,
                          background: showOnlyPending ? "var(--bw-bg-inverse)" : "var(--bw-chip)",
                          border: "none",
                          position: "relative",
                          cursor: "pointer",
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            top: 2,
                            left: showOnlyPending ? 16 : 2,
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            background: showOnlyPending ? "var(--bw-content-inverse)" : "var(--bw-content-tertiary)",
                            transition: "left 0.2s ease",
                          }}
                        />
                      </button>
                    </div>
                    <div style={{ position: "relative", flex: 1, minWidth: 150 }}>
                      <Search size={16} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--bw-content-disabled)" }} />
                      <Input
                        type="search"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ paddingLeft: 34 }}
                        pill
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent style={{ padding: "0 var(--bw-space-6) var(--bw-space-6)" }}>
                <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "60vh", margin: "0 calc(var(--bw-space-6) * -1)" }}>
                <Table style={{ minWidth: 700 }}>
                  <TableHeader>
                    <TableRow>
                      <TableHead style={{ paddingLeft: "var(--bw-space-6)" }}>Team &amp; Product</TableHead>
                      <TableHead>Links</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead style={{ textAlign: "right", paddingRight: "var(--bw-space-6)" }}>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssignments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} style={{ height: 96, textAlign: "center", color: "var(--bw-content-disabled)" }}>
                          {myAssignments.length === 0
                            ? "No proposals have been assigned to you yet."
                            : "No matching proposals."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAssignments.map((proposal) => {
                        const isGradedByMe = gradedProposalIds.includes(proposal.id);

                        return (
                          <TableRow key={proposal.id}>
                            <TableCell>
                              <div style={{ fontWeight: "var(--bw-fw-medium)" as any }}>{proposal.team_name}</div>
                              <div style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-tertiary)" }}>
                                {proposal.product_name}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div style={{ display: "flex", gap: "var(--bw-space-2)" }}>
                                {proposal.proposal_url && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <a
                                        href={proposal.proposal_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ display: "inline-flex", padding: 6, borderRadius: "var(--bw-radius-circle)", border: "1px solid var(--bw-border)", color: "var(--bw-content-secondary)", textDecoration: "none" }}
                                      >
                                        <FileText size={14} />
                                      </a>
                                    </TooltipTrigger>
                                    <TooltipContent>View Proposal PDF</TooltipContent>
                                  </Tooltip>
                                )}
                                {proposal.video_url && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <a
                                        href={proposal.video_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ display: "inline-flex", padding: 6, borderRadius: "var(--bw-radius-circle)", border: "1px solid var(--bw-border)", color: "var(--bw-content-secondary)", textDecoration: "none" }}
                                      >
                                        <ExternalLink size={14} />
                                      </a>
                                    </TooltipTrigger>
                                    <TooltipContent>Watch Pitch Video</TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {isGradedByMe ? (
                                <Badge variant="positive">Completed</Badge>
                              ) : navigatingTo === proposal.id ? (
                                <Badge variant="secondary" style={{ animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}>
                                  Entering...
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Available</Badge>
                              )}
                            </TableCell>
                            <TableCell style={{ textAlign: "right", paddingRight: "var(--bw-space-6)" }}>
                              {isGradedByMe ? (
                                renderBreakdownDialog(proposal, "Details", true)
                              ) : evaluationsLocked ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setShowLockedDialog(true)}
                                  style={{ opacity: 0.7 }}
                                >
                                  🔒 Locked
                                </Button>
                              ) : (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  disabled={navigatingTo === proposal.id}
                                  onClick={() => handleEvaluate(proposal.id)}
                                >
                                  {navigatingTo === proposal.id ? (
                                    <Loader2 size={14} style={{ marginRight: 6, animation: "spin 1s linear infinite" }} />
                                  ) : (
                                    <ClipboardCheck size={14} style={{ marginRight: 6 }} />
                                  )}
                                  {navigatingTo === proposal.id ? "Loading..." : "Evaluate"}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>

{/* Rankings — All Teams Sorted by Score */}
            <Card variant="flat" style={{ display: "flex", flexDirection: "column" }}>
              <CardHeader style={{ padding: "var(--bw-space-6)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--bw-space-3)" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bw-chip)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Trophy size={18} style={{ color: "var(--bw-content-primary)" }} />
                  </div>
                  <CardTitle style={{ fontSize: "var(--bw-fs-h4)" }}>Rankings</CardTitle>
                </div>
              </CardHeader>
              <CardContent style={{ padding: "0 var(--bw-space-6) var(--bw-space-6)" }}>
                <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "70vh", margin: "0 calc(var(--bw-space-6) * -1)" }}>
                  <Table style={{ minWidth: 500 }}>
                    <TableHeader>
                      <TableRow>
                        <TableHead style={{ paddingLeft: "var(--bw-space-6)", width: 50 }}>#</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead style={{ textAlign: "right" }}>Score</TableHead>
                        <TableHead style={{ textAlign: "right", paddingRight: "var(--bw-space-6)", width: 90 }}>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const rankedProposals = [...proposals]
                          .filter((p) => p.is_graded)
                          .sort((a, b) => b.total_score - a.total_score);

                        if (rankedProposals.length === 0) {
                          return (
                            <TableRow>
                              <TableCell colSpan={4} style={{ height: 96, textAlign: "center", color: "var(--bw-content-disabled)" }}>
                                No evaluated proposals yet.
                              </TableCell>
                            </TableRow>
                          );
                        }

                        return rankedProposals.map((proposal, index) => {
                          const evalNames = evaluatorByProposal[proposal.id] ?? [];
                          const criteriaData = (globalBreakdownData[proposal.id] || []) as {
                            name: string;
                            max_score: number;
                            scores: Record<string, number>;
                            notes: Record<string, string>;
                          }[];
                          const proposalEvalScores = scoresByProposal[proposal.id] ?? {};

                          return (
                            <TableRow key={proposal.id}>
                              <TableCell style={{ paddingLeft: "var(--bw-space-6)" }}>
                                <span style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  width: 28,
                                  height: 28,
                                  borderRadius: "50%",
                                  fontSize: "var(--bw-fs-xs)",
                                  fontWeight: "var(--bw-fw-bold)" as any,
                                  background: index < 3 ? "var(--bw-bg-inverse)" : "var(--bw-chip)",
                                  color: index < 3 ? "var(--bw-content-inverse)" : "var(--bw-content-secondary)",
                                }}>
                                  {index + 1}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div style={{ fontWeight: "var(--bw-fw-medium)" as any }}>{proposal.team_name}</div>
                                {evalNames.length > 0 && (
                                  <div style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-tertiary)", marginTop: 2 }}>
                                    Evaluated by {evalNames.join(", ")}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell style={{ textAlign: "right" }}>
                                <span style={{ fontWeight: "var(--bw-fw-bold)" as any, fontSize: "var(--bw-fs-base)" }}>
                                  {proposal.total_score}
                                </span>
                                <span style={{ color: "var(--bw-content-tertiary)", fontSize: "var(--bw-fs-xs)" }}>/{maxPossibleScore}</span>
                              </TableCell>
                              <TableCell style={{ textAlign: "right", paddingRight: "var(--bw-space-6)" }}>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="secondary" size="sm">
                                      <BarChart size={14} style={{ marginRight: 4 }} />
                                      View
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle style={{ fontSize: "var(--bw-fs-h4)" }}>{proposal.team_name}</DialogTitle>
                                    </DialogHeader>
                                    <div style={{ padding: "0 var(--bw-space-6) var(--bw-space-6)", display: "flex", flexDirection: "column", gap: "var(--bw-space-4)" }}>
                                      {/* Total score */}
                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <span style={{ fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-secondary)" }}>Total Score</span>
                                        <Badge variant="positive" style={{ fontSize: "var(--bw-fs-base)", padding: "4px 12px" }}>
                                          {proposal.total_score}/{maxPossibleScore}
                                        </Badge>
                                      </div>

                                      {/* Evaluator scores summary */}
                                      {Object.entries(proposalEvalScores).length > 0 && (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-2)" }}>
                                          <div style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-tertiary)", fontWeight: "var(--bw-fw-medium)" as any }}>Evaluators</div>
                                          {Object.entries(proposalEvalScores).map(([evalId, { name, total }]) => (
                                            <div key={evalId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--bw-space-2) var(--bw-space-3)", borderRadius: "var(--bw-radius-sm)", border: "1px solid var(--bw-border)" }}>
                                              <span style={{ fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-secondary)" }}>{evalId === currentUserId ? "You" : name}</span>
                                              <Badge variant="positive">{total}/{maxPossibleScore}</Badge>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {/* Per-criterion breakdown with per-evaluator scores */}
                                      {criteriaData.length > 0 && (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-2)", borderTop: "1px solid var(--bw-border)", paddingTop: "var(--bw-space-4)" }}>
                                          <div style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-tertiary)", marginBottom: "var(--bw-space-1)" }}>Rubric Breakdown</div>
                                          {criteriaData.map((criterion, i) => {
                                            const evalEntries = Object.entries(criterion.scores);
                                            return (
                                              <div key={i} style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-1)", padding: "var(--bw-space-2) 0", borderBottom: i < criteriaData.length - 1 ? "1px dashed var(--bw-border)" : "none" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "var(--bw-fs-sm)" }}>
                                                  <span style={{ color: "var(--bw-content-secondary)", paddingRight: 16 }}>{criterion.name}</span>
                                                  <span style={{ color: "var(--bw-content-tertiary)", fontSize: "var(--bw-fs-xs)" }}>max {criterion.max_score}</span>
                                                </div>
                                                {evalEntries.map(([evalId, score]) => {
                                                  const evalName = profiles.find(p => p.id === evalId)?.full_name ?? "Unknown";
                                                  return (
                                                    <div key={evalId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: 12, fontSize: "var(--bw-fs-xs)" }}>
                                                      <span style={{ color: "var(--bw-content-tertiary)" }}>{evalId === currentUserId ? "You" : evalName}</span>
                                                      <span style={{ fontWeight: "var(--bw-fw-medium)" as any }}>{score}/{criterion.max_score}</span>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}

                                      {/* Links */}
                                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-2)", borderTop: "1px solid var(--bw-border)", paddingTop: "var(--bw-space-4)" }}>
                                        {proposal.proposal_url && (
                                          <a href={proposal.proposal_url} target="_blank" rel="noopener noreferrer">
                                            <Button variant="secondary" size="sm" style={{ width: "100%", justifyContent: "flex-start" }}>
                                              <FileText size={14} style={{ marginRight: 8 }} /> View Proposal PDF
                                            </Button>
                                          </a>
                                        )}
                                        {proposal.video_url && (
                                          <a href={proposal.video_url} target="_blank" rel="noopener noreferrer">
                                            <Button variant="secondary" size="sm" style={{ width: "100%", justifyContent: "flex-start" }}>
                                              <ExternalLink size={14} style={{ marginRight: 8 }} /> Watch Pitch Video
                                            </Button>
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
        <OnboardingModal 
          isOpen={isOnboardingOpen} 
          onClose={() => {
            setIsOnboardingOpen(false);
            // Show feedback after onboarding completes if not yet seen AND all graded
            if (!hasSeenFeedbackPrompt && isAllGraded) {
              setTimeout(() => setIsFeedbackOpen(true), 400);
            }
          }} 
          currentUserId={currentUserId}
        />
        <FeedbackModal
          isOpen={isFeedbackOpen}
          onClose={() => setIsFeedbackOpen(false)}
          currentUserId={currentUserId}
          existingFeedback={currentFeedback}
          onSubmitted={(fb) => setCurrentFeedback(fb)}
        />
        <EvaluationLockedDialog
          open={showLockedDialog}
          onClose={() => setShowLockedDialog(false)}
        />
      </div>
    </TooltipProvider>
  );
}
