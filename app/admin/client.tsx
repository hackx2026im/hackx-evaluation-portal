"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { LayoutDashboard, Trophy, Clock, FileText, Search, ExternalLink, BarChart, Download, Loader2, Lock, Unlock, FileDown, MessageSquare, Mail, ChevronDown } from "lucide-react";
import Link from "next/link";
import type { Proposal, Profile, ProposalAssignment } from "@/lib/types/database";

interface Props {
  proposals: Proposal[];
  breakdownData?: Record<string, any[]>;
  evaluators?: Pick<Profile, "id" | "full_name">[];
  evaluatorByProposal?: Record<string, string[]>;
  assignments?: ProposalAssignment[];
  overallNotesByProposal?: Record<string, Record<string, string>>;
  evaluationsLocked?: boolean;
  currentUserId?: string;
  rubricSections?: Array<{
    id: string;
    name: string;
    total_marks: number;
    order_index: number;
    rubric_criteria: Array<{
      id: string;
      name: string;
      max_score: number;
      order_index: number;
    }>;
  }>;
}

export function AdminDashboardClient({ proposals, breakdownData = {}, evaluators = [], evaluatorByProposal = {}, assignments = [], overallNotesByProposal = {}, evaluationsLocked = false, currentUserId = "", rubricSections = [] }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);
  const [isTogglingLock, setIsTogglingLock] = useState(false);
  const [lockState, setLockState] = useState(evaluationsLocked);
  const router = useRouter();
  const supabase = createClient();

  const handleDownloadBackup = async () => {
    setIsDownloadingBackup(true);
    try {
      const res = await fetch("/api/download-backup");
      if (!res.ok) throw new Error("Backup failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `hackX-backup-${date}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded successfully");
    } catch {
      toast.error("Failed to download backup");
    } finally {
      setIsDownloadingBackup(false);
    }
  };

  const handleToggleLock = async () => {
    setIsTogglingLock(true);
    const newValue = !lockState;
    try {
      const res = await fetch("/api/system-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "evaluations_locked", value: String(newValue) }),
      });
      if (!res.ok) throw new Error("Failed to update setting");
      setLockState(newValue);
      toast.success(newValue ? "Evaluations locked" : "Evaluations unlocked");
      router.refresh();
    } catch {
      toast.error("Failed to update lock setting");
    } finally {
      setIsTogglingLock(false);
    }
  };

  const handleDownloadTop25 = () => {
    const top25 = proposals
      .filter((p) => p.is_graded)
      .sort((a, b) => b.total_score - a.total_score)
      .slice(0, 25);

    const headers = ["Rank", "Team Name", "Product Name", "Score", "Proposal Link", "Pitch Video Link"];
    const rows = top25.map((p, i) => [
      i + 1,
      `"${p.team_name.replace(/"/g, '""')}"`,
      `"${p.product_name.replace(/"/g, '""')}"`,
      p.total_score,
      p.proposal_url || "",
      p.video_url || "",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hackX-2026-top25.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Top 25 CSV downloaded");
  };

  const handleDownloadComments = () => {
    // Helper: escape a value for CSV (wraps in quotes, escapes internal quotes)
    const esc = (v: string | number | null | undefined) => {
      const s = String(v ?? "").replace(/"/g, '""');
      return `"${s}"`;
    };

    const headers = [
      "Rank",
      "Team Name",
      "Product Name",
      "Total Score",
      "Evaluator",
      "Comment Type",      // "Overall" | criterion name
      "Criterion",         // blank for Overall rows
      "Max Score",         // blank for Overall rows
      "Evaluator Score",   // blank for Overall rows
      "Comment",
    ];

    const rows: string[][] = [];

    // Sort proposals: graded first (score desc), then ungraded alphabetically
    const sorted = [...proposals].sort((a, b) => {
      if (a.is_graded && b.is_graded) return b.total_score - a.total_score;
      if (a.is_graded) return -1;
      if (b.is_graded) return 1;
      return a.team_name.localeCompare(b.team_name);
    });

    let rank = 0;

    for (const proposal of sorted) {
      const assigneeIds = assignments
        .filter((a) => a.proposal_id === proposal.id)
        .map((a) => a.evaluator_id);

      if (assigneeIds.length === 0) continue;
      if (proposal.is_graded) rank++;

      const rankVal = proposal.is_graded ? rank : "";
      const scoreVal = proposal.is_graded ? proposal.total_score : "";

      const criteriaData = (breakdownData[proposal.id] || []) as {
        name: string;
        max_score: number;
        scores: Record<string, number>;
        notes: Record<string, string>;
      }[];

      for (const evalId of assigneeIds) {
        const evalName = evaluatorMap.get(evalId) || "Unknown";

        // ── Overall comment ───────────────────────────────────────────────
        const overall = overallNotesByProposal[proposal.id]?.[evalId]?.trim();
        if (overall) {
          rows.push([
            esc(rankVal),
            esc(proposal.team_name),
            esc(proposal.product_name),
            esc(scoreVal),
            esc(evalName),
            esc("Overall"),
            esc(""),          // Criterion
            esc(""),          // Max Score
            esc(""),          // Evaluator Score
            esc(overall),
          ]);
        }

        // ── Criterion-level comments ──────────────────────────────────────
        // Dedup bleed-through: same note on >1 criterion = old global note bug
        const noteFreq: Record<string, number> = {};
        criteriaData.forEach((c) => {
          const note = (c.notes as Record<string, string>)?.[evalId]?.trim();
          if (note) noteFreq[note] = (noteFreq[note] ?? 0) + 1;
        });
        const bleedText = Object.entries(noteFreq).find(([, cnt]) => cnt > 1)?.[0];

        for (const c of criteriaData) {
          const note = (c.notes as Record<string, string>)?.[evalId]?.trim();
          if (!note || note === bleedText) continue;
          const evalScore = c.scores?.[evalId] !== undefined ? c.scores[evalId] : "";
          rows.push([
            esc(rankVal),
            esc(proposal.team_name),
            esc(proposal.product_name),
            esc(scoreVal),
            esc(evalName),
            esc("Criterion"),
            esc(c.name),
            esc(c.max_score),
            esc(evalScore),
            esc(note),
          ]);
        }
      }
    }

    if (rows.length === 0) {
      toast.info("No evaluator comments found yet.");
      return;
    }

    const csv = [
      headers.map(esc).join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }); // BOM for Excel
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hackX-2026-evaluator-comments.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Comments CSV downloaded — ${rows.length} rows`);
  };

  // ── Shared CSV builder for email results (used by both selected & rejected) ──
  const buildEmailResultsCSV = (subset: Proposal[]): string => {
    // CSV escape helper: always wrap in double quotes, escape internal quotes
    const esc = (v: string | number | null | undefined): string => {
      const s = String(v ?? "").replace(/"/g, '""');
      return `"${s}"`;
    };

    // ── Header row ────────────────────────────────────────────────────
    const headers: string[] = [
      "Team Name",
      "Product Name",
      "Overall Score (max 100)",
    ];
    for (const section of rubricSections) {
      for (const criterion of section.rubric_criteria) {
        headers.push(`${criterion.name} (max ${criterion.max_score})`);
        headers.push(`${criterion.name} — Comments`);
      }
      headers.push(`${section.name} Total (max ${section.total_marks})`);
    }
    headers.push("Overall Comment — Evaluator 01");
    headers.push("Overall Comment — Evaluator 02");

    // ── Data rows ──────────────────────────────────────────────────
    const rows: string[] = [];

    for (const proposal of subset) {
      const assigneeIds = assignments
        .filter((a) => a.proposal_id === proposal.id)
        .map((a) => a.evaluator_id);

      const criteriaData = (breakdownData[proposal.id] || []) as {
        name: string;
        max_score: number;
        scores: Record<string, number>;
        notes: Record<string, string>;
      }[];

      const criteriaByName = new Map(criteriaData.map((c) => [c.name, c]));

      // Pre-compute bleed-through note per evaluator.
      // A note appearing on >1 criterion = old global-note bug; suppress per-criterion.
      const bleedByEvaluator = new Map<string, string | undefined>();
      for (const evalId of assigneeIds) {
        const freq: Record<string, number> = {};
        criteriaData.forEach((c) => {
          const note = c.notes?.[evalId]?.trim();
          if (note) freq[note] = (freq[note] ?? 0) + 1;
        });
        bleedByEvaluator.set(
          evalId,
          Object.entries(freq).find(([, cnt]) => cnt > 1)?.[0]
        );
      }

      // rowValues built in two passes:
      // pass 1 — identity cols (overall score filled in after section loop)
      // pass 2 — per-criterion cols, section totals
      // This lets us derive the overall from the criteria, not from the DB integer.
      const identityValues: string[] = [
        esc(proposal.team_name),
        esc(proposal.product_name),
        // overall score placeholder — replaced below
      ];
      const criterionValues: string[] = [];
      let overallTotal = 0;
      let hasAnyScore = false;

      for (const section of rubricSections) {
        let sectionTotal = 0;
        let hasSectionScores = false;

        for (const criterion of section.rubric_criteria) {
          const cd = criteriaByName.get(criterion.name);

          // Exact (unrounded) average across both evaluators
          let avgScore: number | string = "";
          if (cd) {
            const scores = assigneeIds
              .map((id) => cd.scores[id])
              .filter((s): s is number => s !== undefined);
            if (scores.length > 0) {
              const exactAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
              avgScore = parseFloat(exactAvg.toFixed(1)); // display: e.g. 6.5
              sectionTotal += exactAvg;                   // accumulate exact value
              overallTotal += exactAvg;                   // track grand total
              hasSectionScores = true;
              hasAnyScore = true;
            }
          }
          criterionValues.push(esc(avgScore));

          // Combined criterion comments (skip bleed-through text)
          const commentParts: string[] = [];
          assigneeIds.forEach((evalId, idx) => {
            const bleedText = bleedByEvaluator.get(evalId);
            const note = cd?.notes?.[evalId]?.trim() ?? "";
            if (!note || note === bleedText) return;
            commentParts.push(`Evaluator 0${idx + 1}: ${note}`);
          });
          criterionValues.push(esc(commentParts.join(" | ")));
        }

        // Section total: exact sum → display to 1dp
        criterionValues.push(
          esc(hasSectionScores ? parseFloat(sectionTotal.toFixed(1)) : "")
        );
      }

      // Overall score = derived from criteria (fully consistent, self-verifying)
      const overallDisplay = hasAnyScore ? parseFloat(overallTotal.toFixed(1)) : "";
      const rowValues = [
        ...identityValues,
        esc(overallDisplay),
        ...criterionValues,
      ];

      // Overall comments — Evaluator 01 & 02 (anonymous labels)
      const overallComments: string[] = [];
      for (let i = 0; i < 2; i++) {
        const evalId = assigneeIds[i];
        if (!evalId) { overallComments.push(esc("")); continue; }
        const fromTable = overallNotesByProposal[proposal.id]?.[evalId]?.trim() ?? "";
        const bleedText = bleedByEvaluator.get(evalId) ?? "";
        overallComments.push(esc(fromTable || bleedText));
      }

      rows.push([...rowValues, ...overallComments].join(","));
    }

    const headerRow = headers.map(esc).join(",");
    return [headerRow, ...rows].join("\n");
  };

  // ── Download Selected (Top 25) ────────────────────────────────────────────
  const handleDownloadSelectedCSV = () => {
    if (rubricSections.length === 0) {
      toast.error("Rubric data not loaded — please refresh the page.");
      return;
    }
    // Stable sort: score desc, then team name asc as tiebreaker
    const graded = [...proposals]
      .filter((p) => p.is_graded)
      .sort((a, b) =>
        b.total_score - a.total_score || a.team_name.localeCompare(b.team_name)
      );
    const selected = graded.slice(0, 25);
    if (selected.length === 0) { toast.info("No graded proposals to export."); return; }

    // Warn if there is a tie straddling the rank-25/26 boundary
    const lastSelected = selected[selected.length - 1];
    const firstRejected = graded[25];
    if (firstRejected && lastSelected.total_score === firstRejected.total_score) {
      toast.warning(
        `⚠️ Tie at rank 25/26: "${lastSelected.team_name}" and "${firstRejected.team_name}" both scored ${lastSelected.total_score}. Teams are split alphabetically — review manually.`,
        { duration: 8000 }
      );
    }

    const csv = buildEmailResultsCSV(selected);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hackX-2026-selected-top25-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Selected CSV downloaded — ${selected.length} proposals`);
  };

  // ── Download Rejected (Rank 16+) ──────────────────────────────────────────
  const handleDownloadRejectedCSV = () => {
    if (rubricSections.length === 0) {
      toast.error("Rubric data not loaded — please refresh the page.");
      return;
    }
    // Same stable sort — must match selected to keep splits consistent
    const graded = [...proposals]
      .filter((p) => p.is_graded)
      .sort((a, b) =>
        b.total_score - a.total_score || a.team_name.localeCompare(b.team_name)
      );
    const rejected = graded.slice(25);
    if (rejected.length === 0) { toast.info("No non-selected proposals to export."); return; }

    // Warn if tie at boundary (mirror of selected handler)
    const lastSelected = graded[14];
    const firstRejected = rejected[0];
    if (lastSelected && firstRejected && lastSelected.total_score === firstRejected.total_score) {
      toast.warning(
        `⚠️ Tie at rank 25/26: "${lastSelected.team_name}" and "${firstRejected.team_name}" both scored ${lastSelected.total_score}. Teams are split alphabetically — review manually.`,
        { duration: 8000 }
      );
    }

    const csv = buildEmailResultsCSV(rejected);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hackX-2026-rejected-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Rejected CSV downloaded — ${rejected.length} proposals`);
  };

  const totalProposals = proposals.length;
  const gradedCount = proposals.filter((p) => p.is_graded).length;
  const pendingCount = totalProposals - gradedCount;
  const avgScore =
    gradedCount > 0
      ? Math.round(
          proposals
            .filter((p) => p.is_graded)
            .reduce((sum, p) => sum + p.total_score, 0) / gradedCount
        )
      : 0;

  const stats = [
    { label: "Total Proposals", value: totalProposals, icon: FileText },
    { label: "Graded", value: gradedCount, icon: Trophy },
    { label: "Pending", value: pendingCount, icon: Clock },
    { label: "Avg Score", value: avgScore, icon: LayoutDashboard },
  ];

  const evaluatorMap = useMemo(() => {
    return new Map(evaluators.map((e) => [e.id, e.full_name]));
  }, [evaluators]);

  const filteredProposals = useMemo(() => {
    if (!searchQuery) return proposals;
    const query = searchQuery.toLowerCase();
    return proposals.filter(
      (p) =>
        p.team_name.toLowerCase().includes(query) ||
        p.product_name.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query))
    );
  }, [proposals, searchQuery]);

  const topTeams = useMemo(() => {
    return proposals
      .filter((p) => p.is_graded)
      .sort((a, b) => b.total_score - a.total_score)
      .slice(0, 25);
  }, [proposals]);

  const handleDeleteProposal = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("proposals")
        .delete()
        .eq("id", deletingId);

      if (error) throw error;
      
      toast.success("Proposal deleted successfully");
      setDeletingId(null);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete proposal");
    } finally {
      setIsDeleting(false);
    }
  };

  const renderBreakdownDialog = (proposal: Proposal, trigger: React.ReactNode, isIcon?: boolean) => {
    const criteriaData = (breakdownData[proposal.id] || []) as { name: string; max_score: number; scores: Record<string, number>; notes: Record<string, string> }[];
    const assignedEvaluatorIds = assignments
      .filter((a) => a.proposal_id === proposal.id)
      .map((a) => a.evaluator_id);
    
    const assignedEvaluators = assignedEvaluatorIds.map(id => ({
      id,
      name: evaluatorMap.get(id) || "Unknown"
    }));

    // Calculate total score per evaluator
    const evaluatorTotals: Record<string, number> = {};
    assignedEvaluatorIds.forEach(evalId => {
      let total = 0;
      let hasAnyScore = false;
      criteriaData.forEach(c => {
        if (c.scores[evalId] !== undefined) {
          total += c.scores[evalId];
          hasAnyScore = true;
        }
      });
      if (hasAnyScore) evaluatorTotals[evalId] = total;
    });

    return (
      <Dialog>
        <DialogTrigger asChild>
          {isIcon ? (
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
              {trigger}
            </button>
          ) : (
            trigger
          )}
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle style={{ fontSize: "var(--bw-fs-h4)" }}>
              Detailed Scores: {proposal.team_name}
            </DialogTitle>
          </DialogHeader>
          <div style={{ padding: "0 var(--bw-space-6) var(--bw-space-6)", display: "flex", flexDirection: "column", gap: "var(--bw-space-4)" }}>
            
            {/* Summary Row */}
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${assignedEvaluators.length + 1}, 1fr)`, gap: "var(--bw-space-2)", background: "var(--bw-chip)", padding: "var(--bw-space-3)", borderRadius: "var(--bw-radius-md)" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-tertiary)" }}>Average</span>
                <span style={{ fontSize: "var(--bw-fs-base)", fontWeight: "var(--bw-fw-bold)" as any }}>{proposal.total_score}/100</span>
              </div>
              {assignedEvaluators.map(evaluator => (
                <div key={evaluator.id} style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{evaluator.name}</span>
                  <span style={{ fontSize: "var(--bw-fs-base)", fontWeight: "var(--bw-fw-bold)" as any }}>
                    {evaluatorTotals[evaluator.id] !== undefined ? `${evaluatorTotals[evaluator.id]}/100` : "Pending"}
                  </span>
                </div>
              ))}
            </div>

            {/* Detailed Table */}
            <div style={{ border: "1px solid var(--bw-border)", borderRadius: "var(--bw-radius-md)", overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead style={{ fontSize: "var(--bw-fs-xs)", padding: "var(--bw-space-2) var(--bw-space-3)" }}>Criterion</TableHead>
                      {assignedEvaluators.map(e => (
                        <TableHead key={e.id} style={{ fontSize: "var(--bw-fs-xs)", textAlign: "center", padding: "var(--bw-space-2) var(--bw-space-3)" }}>{e.name}</TableHead>
                      ))}
                      <TableHead style={{ fontSize: "var(--bw-fs-xs)", textAlign: "right", padding: "var(--bw-space-2) var(--bw-space-3)" }}>Avg</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {criteriaData.length > 0 ? (
                      criteriaData.map((c, idx) => {
                        const scoresArr = assignedEvaluatorIds
                          .map(id => c.scores[id])
                          .filter(s => s !== undefined);
                        const avg = scoresArr.length > 0 
                          ? Math.round(scoresArr.reduce((a, b) => a + b, 0) / scoresArr.length)
                          : null;

                        return (
                          <TableRow key={idx}>
                            <TableCell style={{ fontSize: "var(--bw-fs-xs)", padding: "var(--bw-space-2) var(--bw-space-3)" }}>
                              <div style={{ fontWeight: "var(--bw-fw-medium)" as any }}>{c.name}</div>
                              <div style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-tertiary)" }}>Max: {c.max_score}</div>
                            </TableCell>
                            {assignedEvaluatorIds.map(evalId => (
                              <TableCell key={evalId} style={{ fontSize: "var(--bw-fs-xs)", textAlign: "center", padding: "var(--bw-space-2) var(--bw-space-3)" }}>
                                {c.scores[evalId] !== undefined ? c.scores[evalId] : <span style={{ color: "var(--bw-content-disabled)" }}>—</span>}
                              </TableCell>
                            ))}
                            <TableCell style={{ fontSize: "var(--bw-fs-xs)", textAlign: "right", fontWeight: "var(--bw-fw-bold)" as any, padding: "var(--bw-space-2) var(--bw-space-3)" }}>
                              {avg !== null ? avg : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={assignedEvaluators.length + 2} style={{ textAlign: "center", padding: "var(--bw-space-4)", color: "var(--bw-content-disabled)", fontStyle: "italic" }}>
                          No scoring data available yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Evaluator Comments — admin sees all, grouped by evaluator */}
            {(() => {
              const commentsByEvaluator = assignedEvaluators.map(evaluator => {
                // Per-criterion unique notes (dedup bleed-through for legacy data)
                const rawNotes = criteriaData
                  .filter(c => (c.notes as Record<string, string>)?.[evaluator.id])
                  .map(c => ({ name: c.name, note: (c.notes as Record<string, string>)[evaluator.id] }));

                const noteFreq: Record<string, number> = {};
                rawNotes.forEach(({ note }) => { noteFreq[note] = (noteFreq[note] ?? 0) + 1; });
                const bleedText = Object.entries(noteFreq).find(([, c]) => c > 1)?.[0];
                const uniqueCriterionNotes = bleedText
                  ? rawNotes.filter(r => r.note !== bleedText)
                  : rawNotes;

                // Overall note from the dedicated table (source of truth for new submissions)
                const overallNote = overallNotesByProposal[proposal.id]?.[evaluator.id]
                  || bleedText || "";

                return { evaluator, uniqueCriterionNotes, overallNote };
              }).filter(e => e.uniqueCriterionNotes.length > 0 || e.overallNote);

              if (commentsByEvaluator.length === 0) return null;

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-3)" }}>
                  <div style={{ fontSize: "var(--bw-fs-xs)", fontWeight: "var(--bw-fw-medium)" as any, color: "var(--bw-content-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Evaluator Comments
                  </div>
                  {commentsByEvaluator.map(({ evaluator, uniqueCriterionNotes, overallNote }) => (
                    <div key={evaluator.id} style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-2)", background: "var(--bw-chip)", padding: "var(--bw-space-3)", borderRadius: "var(--bw-radius-md)" }}>
                      <div style={{ fontSize: "var(--bw-fs-xs)", fontWeight: "var(--bw-fw-medium)" as any, color: "var(--bw-content-secondary)", marginBottom: "var(--bw-space-1)" }}>
                        {evaluator.name}
                      </div>
                      {overallNote && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingBottom: uniqueCriterionNotes.length > 0 ? "var(--bw-space-2)" : 0, borderBottom: uniqueCriterionNotes.length > 0 ? "1px dashed var(--bw-border)" : "none" }}>
                          <span style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Overall Comment</span>
                          <p style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-primary)", margin: 0, paddingLeft: 4, borderLeft: "2px solid var(--bw-border)", fontStyle: "italic" }}>{overallNote}</p>
                        </div>
                      )}
                      {uniqueCriterionNotes.map((item, i) => (
                        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2, paddingBottom: i < uniqueCriterionNotes.length - 1 ? "var(--bw-space-2)" : 0, borderBottom: i < uniqueCriterionNotes.length - 1 ? "1px dashed var(--bw-border)" : "none" }}>
                          <span style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{item.name}</span>
                          <p style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-primary)", margin: 0, paddingLeft: 4, borderLeft: "2px solid var(--bw-border)", fontStyle: "italic" }}>{item.note}</p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Links + Admin Edit */}
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
              {/* Admin can always edit any evaluation — bypasses lock */}
              <Link href={`/evaluator/evaluate/${proposal.id}?admin_override=1`}>
                <Button variant="primary" size="sm" style={{ width: "100%", justifyContent: "flex-start", marginTop: "var(--bw-space-2)" }}>
                  <FileText size={14} style={{ marginRight: 8 }} /> Edit Grading (Admin)
                </Button>
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-6)" }}>
      {/* Page heading */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--bw-space-4)" }}>
        <div>
          <h2 style={{ fontFamily: "var(--bw-font-heading)", fontSize: "var(--bw-fs-h1-fluid)", fontWeight: "var(--bw-fw-bold)" as any, lineHeight: "var(--bw-lh-tight)" }}>
            Dashboard
          </h2>
          <p style={{ marginTop: "var(--bw-space-2)", fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-secondary)" }}>
            Overview of all hackX 11.0 proposals
          </p>
        </div>
        {/* Header action buttons — kept to two: the one live toggle, and
            every export collapsed under a single menu so the page opens
            calm instead of a wall of equally-weighted pills. */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--bw-space-3)", alignItems: "center" }}>
          {/* Lock / Unlock toggle */}
          <button
            onClick={handleToggleLock}
            disabled={isTogglingLock}
            className="bw-button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--bw-space-2)",
              padding: "10px 18px",
              background: lockState ? "var(--bw-warning-bg)" : "var(--bw-bg-primary)",
              border: lockState ? "1px solid var(--bw-warning)" : "1px solid var(--bw-border)",
              borderRadius: "var(--bw-radius-pill)",
              fontSize: "var(--bw-fs-sm)",
              fontWeight: "var(--bw-fw-medium)" as any,
              color: lockState ? "var(--bw-warning)" : "var(--bw-content-primary)",
              cursor: isTogglingLock ? "not-allowed" : "pointer",
              opacity: isTogglingLock ? 0.6 : 1,
              fontFamily: "var(--bw-font-body)",
              transition: "all var(--bw-duration-normal)",
              whiteSpace: "nowrap",
            }}
          >
            {isTogglingLock
              ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
              : lockState ? <Unlock size={14} /> : <Lock size={14} />}
            {isTogglingLock ? "Updating..." : lockState ? "Unlock Evaluations" : "Lock Evaluations"}
          </button>

          {/* Exports — Top 25 CSV, Comments CSV, Selected/Rejected email CSVs, full backup */}
          <DropdownMenu>
            <DropdownMenuTrigger>
              <button
                disabled={isDownloadingBackup}
                className="bw-button"
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--bw-space-2)",
                  padding: "10px 18px",
                  background: "var(--bw-bg-primary)",
                  border: "1px solid var(--bw-border)",
                  borderRadius: "var(--bw-radius-pill)",
                  fontSize: "var(--bw-fs-sm)",
                  fontWeight: "var(--bw-fw-medium)" as any,
                  color: "var(--bw-content-primary)",
                  cursor: isDownloadingBackup ? "not-allowed" : "pointer",
                  opacity: isDownloadingBackup ? 0.6 : 1,
                  fontFamily: "var(--bw-font-body)",
                  transition: "all var(--bw-duration-normal)",
                  whiteSpace: "nowrap",
                }}
              >
                {isDownloadingBackup
                  ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                  : <Download size={14} />}
                {isDownloadingBackup ? "Preparing..." : "Export"}
                <ChevronDown size={14} style={{ color: "var(--bw-content-tertiary)" }} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleDownloadTop25}>
                <FileDown size={14} />
                Top 25 CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadComments}>
                <MessageSquare size={14} />
                Evaluator Comments CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadSelectedCSV}>
                <Mail size={14} />
                Selected (Top 25) Emails
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadRejectedCSV}>
                <Mail size={14} />
                Rejected (Rank 16+) Emails
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadBackup} disabled={isDownloadingBackup}>
                <Download size={14} />
                Full JSON Backup
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} variant="flat">
              <CardHeader style={{ padding: "var(--bw-space-5) var(--bw-space-5) var(--bw-space-2)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "var(--bw-fs-xs)", fontWeight: "var(--bw-fw-medium)" as any, color: "var(--bw-content-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{stat.label}</span>
                  <Icon size={14} style={{ color: "var(--bw-content-disabled)" }} />
                </div>
              </CardHeader>
              <CardContent style={{ padding: "var(--bw-space-2) var(--bw-space-5) var(--bw-space-5)" }}>
                <div style={{ fontSize: "var(--bw-fs-h2)", fontWeight: "var(--bw-fw-bold)" as any }}>{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Split View: Table + Leaderboard */}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        {/* Proposals Table */}
        <Card variant="flat" style={{ display: "flex", flexDirection: "column" }}>
          <CardHeader style={{ padding: "var(--bw-space-6)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "var(--bw-space-4)" }}>
              <CardTitle style={{ fontSize: "var(--bw-fs-h4)" }}>Recent Proposals</CardTitle>
              <div style={{ position: "relative", width: "100%", maxWidth: 260 }}>
                <Search size={16} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--bw-content-disabled)" }} />
                <Input
                  type="search"
                  placeholder="Search team, product..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: 34 }}
                  pill
                />
              </div>
            </div>
          </CardHeader>
          <CardContent style={{ padding: "var(--bw-space-0) var(--bw-space-6) var(--bw-space-6)" }}>
            <div style={{ overflowX: "auto", margin: "0 calc(var(--bw-space-6) * -1)" }}>
              <Table style={{ minWidth: 720 }}>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ paddingLeft: "var(--bw-space-6)" }}>Team</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead style={{ textAlign: "right" }}>Total</TableHead>
                    <TableHead style={{ textAlign: "right", paddingRight: "var(--bw-space-6)" }}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProposals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} style={{ height: 96, textAlign: "center", color: "var(--bw-content-disabled)" }}>
                        No proposals found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProposals.map((proposal) => {
                      const assigneeIds = assignments
                        .filter((a) => a.proposal_id === proposal.id)
                        .map((a) => a.evaluator_id);
                      const criteriaData = (breakdownData[proposal.id] || []) as any[];

                      return (
                        <TableRow key={proposal.id}>
                          <TableCell style={{ paddingLeft: "var(--bw-space-6)" }}>
                            <div style={{ fontWeight: "var(--bw-fw-medium)" as any }}>{proposal.team_name}</div>
                            <div style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-tertiary)" }}>{proposal.product_name}</div>
                          </TableCell>
                          <TableCell>
                            {assigneeIds.length > 0 ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-2)" }}>
                                {assigneeIds.map((evalId) => {
                                  const hasGraded = criteriaData.some(c => c.scores[evalId] !== undefined);
                                  return (
                                    <div key={evalId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--bw-space-3)" }}>
                                      <span style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-secondary)" }}>
                                        {evaluatorMap.get(evalId) || "Unknown"}
                                      </span>
                                      <Badge variant={hasGraded ? "positive" : "secondary"}>
                                        {hasGraded ? "Graded" : "Pending"}
                                      </Badge>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <span style={{ fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-disabled)", fontStyle: "italic" }}>Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell style={{ textAlign: "right", fontWeight: "var(--bw-fw-bold)" as any }}>
                            {proposal.is_graded ? `${proposal.total_score}` : "—"}
                          </TableCell>
                          <TableCell style={{ textAlign: "right", paddingRight: "var(--bw-space-6)" }}>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--bw-space-2)" }}>
                              {proposal.is_graded ? (
                                renderBreakdownDialog(
                                  proposal,
                                  <Button variant="secondary" size="sm">Breakdown</Button>,
                                )
                              ) : (
                                <Button variant="ghost" size="sm" disabled style={{ color: "var(--bw-content-disabled)" }}>Pending</Button>
                              )}
                              <Button variant="destructive" size="sm" onClick={() => setDeletingId(proposal.id)}>Delete</Button>
                            </div>
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

        {/* Top 25 Leaderboard */}
        <div style={{ position: "sticky", top: "calc(var(--bw-nav-height) + var(--bw-space-6))", alignSelf: "start", maxHeight: "calc(100vh - var(--bw-nav-height) - var(--bw-space-12))", overflowY: "auto" }} className="hidden xl:block">
          <Card variant="flat" style={{ display: "flex", flexDirection: "column" }}>
            <CardHeader style={{ padding: "var(--bw-space-6)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--bw-space-2)" }}>
                <Trophy size={18} style={{ color: "var(--bw-warning)" }} />
                <CardTitle style={{ fontSize: "var(--bw-fs-h4)" }}>Top 25 Teams</CardTitle>
              </div>
            </CardHeader>
            <CardContent style={{ padding: "0 var(--bw-space-6) var(--bw-space-6)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-4)" }}>
                {topTeams.length === 0 ? (
                  <div style={{ fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-disabled)", textAlign: "center", padding: "var(--bw-space-6) 0" }}>
                    No graded proposals yet.
                  </div>
                ) : (
                  topTeams.map((team, index) => {
                    const evaluatedByList = evaluatorByProposal[team.id] || [];
                    return (
                      <div key={team.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--bw-space-2)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--bw-space-3)", minWidth: 0, flex: 1 }}>
                          {/* Rank badge */}
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: "var(--bw-radius-circle)",
                              background: index < 3 ? "var(--bw-bg-inverse)" : "var(--bw-chip)",
                              color: index < 3 ? "var(--bw-content-inverse)" : "var(--bw-content-primary)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "var(--bw-fs-xs)",
                              fontWeight: "var(--bw-fw-bold)" as any,
                              flexShrink: 0,
                            }}
                          >
                            {index + 1}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: "var(--bw-fs-sm)", fontWeight: "var(--bw-fw-medium)" as any, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team.team_name}</p>
                            {evaluatedByList.length > 0 && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                                {evaluatedByList.map((name, i) => (
                                  <Badge key={i} variant="secondary" style={{ fontSize: "var(--bw-fs-xs)", padding: "0px 6px", height: 18 }}>{name}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--bw-space-3)", flexShrink: 0 }}>
                          <span style={{ fontWeight: "var(--bw-fw-bold)" as any, fontSize: "var(--bw-fs-sm)" }}>{team.total_score}</span>
                          {renderBreakdownDialog(
                            team,
                            <BarChart size={14} />,
                            true
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you absolutely sure?</DialogTitle>
          </DialogHeader>
          <div style={{ padding: "0 var(--bw-space-6) var(--bw-space-6)" }}>
            <p style={{ fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-secondary)", marginBottom: "var(--bw-space-6)" }}>
              This action cannot be undone. This will permanently delete the proposal
              and all associated evaluations and assignments.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--bw-space-3)" }}>
              <Button variant="secondary" onClick={() => setDeletingId(null)} disabled={isDeleting}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteProposal} disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Delete Proposal"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
