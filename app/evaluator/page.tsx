import { createClient } from "@/lib/supabase/server";
import { EvaluatorDashboardClient } from "./client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EvaluatorDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [
    { data: proposals },
    { data: myEvaluationsData },
    { data: allEvaluations },
    { data: allEvaluationsDetailed },
    { data: profiles },
    { data: assignments },
    { data: settings },
    { data: myOverallNotesRows },
    { data: allOverallNotesRows },
    { data: feedbackRow },
    { data: lockSetting },
    { data: rubricCriteria }
  ] = await Promise.all([
    supabase
      .from("proposals")
      .select("*")
      .order("created_at", { ascending: false }),
    // Explicitly fetch THIS evaluator's own evaluations to guarantee no row truncation or missing grades
    supabase
      .from("evaluations")
      .select(`
        proposal_id,
        evaluator_id,
        rubric_criterion_id,
        score,
        notes,
        rubric_criteria (
          name,
          max_score
        )
      `)
      .eq("evaluator_id", user.id)
      .range(0, 4999),
    // Fetch evaluations across all evaluators for co-evaluator score comparisons
    supabase
      .from("evaluations")
      .select("proposal_id, evaluator_id, score")
      .range(0, 9999),
    // Fetch all evaluations with rubric details for global breakdown view
    supabase
      .from("evaluations")
      .select(`
        proposal_id,
        evaluator_id,
        rubric_criterion_id,
        score,
        notes,
        rubric_criteria (
          name,
          max_score
        )
      `)
      .range(0, 9999),
    supabase
      .from("profiles")
      .select("id, full_name, has_seen_onboarding"),
    supabase
      .from("proposal_assignments")
      .select("*"),
    supabase
      .from("system_settings")
      .select("*")
      .eq("key", "evaluation_deadline")
      .single(),
    supabase
      .from("evaluation_overall_notes")
      .select("proposal_id, notes")
      .eq("evaluator_id", user.id),
    // Fetch ALL evaluators' overall notes for global breakdown
    supabase
      .from("evaluation_overall_notes")
      .select("proposal_id, evaluator_id, notes"),
    supabase
      .from("evaluator_feedback")
      .select("*")
      .eq("evaluator_id", user.id)
      .maybeSingle(),
    supabase
      .from("system_settings")
      .select("value")
      .eq("key", "evaluations_locked")
      .single(),
    supabase
      .from("rubric_criteria")
      .select("max_score"),
  ]);

  const maxPossibleScore = (rubricCriteria ?? []).reduce((acc, curr) => acc + (curr.max_score || 0), 0) || 100;

  const evaluationsLocked = (() => {
    const raw = (lockSetting as any)?.value;
    return raw === '"true"' || raw === true || String(raw) === 'true' || String(raw) === '"true"';
  })();

  let daysLeft = "14";
  if (settings?.value) {
    const deadlineDate = new Date(settings.value as string);
    const diff = deadlineDate.getTime() - Date.now();
    daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24))).toString();
  }

  // My evaluations only (directly from myEvaluationsData, guaranteed complete)
  const myEvaluations = myEvaluationsData ?? [];

  // Get unique proposal IDs that this evaluator has graded
  const gradedProposalIds = [
    ...new Set(myEvaluations.map((e) => e.proposal_id)),
  ];

  // Build breakdown for this evaluator's own scores only (for full rubric display)
  const breakdownData: Record<string, any[]> = {};
  const accumulator: Record<string, Map<string, { name: string; score: number; max_score: number; notes: string }>> = {};
  myEvaluations.forEach((ev) => {
    const criteria = Array.isArray(ev.rubric_criteria) ? ev.rubric_criteria[0] : ev.rubric_criteria;
    if (!criteria) return;

    if (!accumulator[ev.proposal_id]) {
      accumulator[ev.proposal_id] = new Map();
    }
    accumulator[ev.proposal_id].set(ev.rubric_criterion_id, {
      name: (criteria as any).name,
      score: ev.score,
      max_score: (criteria as any).max_score,
      notes: ev.notes ?? "",
    });
  });
  for (const [proposalId, criteriaMap] of Object.entries(accumulator)) {
    breakdownData[proposalId] = Array.from(criteriaMap.values());
  }

  // Build per-evaluator score totals per proposal: proposalId -> { evaluatorId -> { name, total } }
  const scoresByProposal: Record<string, Record<string, { name: string; total: number }>> = {};
  if (allEvaluations && profiles) {
    const evaluatorMap = new Map(profiles.map((p) => [p.id, p.full_name]));
    const perEvalTotals: Record<string, Record<string, number>> = {};
    for (const ev of allEvaluations) {
      if (!perEvalTotals[ev.proposal_id]) perEvalTotals[ev.proposal_id] = {};
      perEvalTotals[ev.proposal_id][ev.evaluator_id] = (perEvalTotals[ev.proposal_id][ev.evaluator_id] ?? 0) + ev.score;
    }
    for (const [proposalId, evalTotals] of Object.entries(perEvalTotals)) {
      scoresByProposal[proposalId] = {};
      for (const [evalId, total] of Object.entries(evalTotals)) {
        const name = evaluatorMap.get(evalId) ?? "Unknown";
        scoresByProposal[proposalId][evalId] = { name, total };
      }
    }
  }

  // Fallback guarantee: ensure THIS evaluator's score is always present in scoresByProposal for all their graded proposals
  const currentEvaluatorName = profiles?.find(p => p.id === user.id)?.full_name ?? "You";
  for (const ev of myEvaluations) {
    if (!scoresByProposal[ev.proposal_id]) scoresByProposal[ev.proposal_id] = {};
    if (!scoresByProposal[ev.proposal_id][user.id]) {
      const myProposalTotal = myEvaluations
        .filter(e => e.proposal_id === ev.proposal_id)
        .reduce((sum, e) => sum + (e.score || 0), 0);
      scoresByProposal[ev.proposal_id][user.id] = { name: currentEvaluatorName, total: myProposalTotal };
    }
  }

  // Build map: proposalId -> overall note text (this evaluator only)
  const myOverallNotes: Record<string, string> = {};
  if (myOverallNotesRows) {
    for (const row of myOverallNotesRows) {
      myOverallNotes[row.proposal_id] = row.notes;
    }
  }

  // Build global breakdown: proposalId -> criterion[] with per-evaluator scores/notes
  // Same structure as admin breakdownData for consistency
  const globalBreakdownData: Record<string, any[]> = {};
  if (allEvaluationsDetailed) {
    const globalAcc: Record<string, Map<string, { name: string; max_score: number; scores: Record<string, number>; notes: Record<string, string> }>> = {};
    allEvaluationsDetailed.forEach((ev) => {
      const criteria = Array.isArray(ev.rubric_criteria) ? ev.rubric_criteria[0] : ev.rubric_criteria;
      if (!criteria) return;
      if (!globalAcc[ev.proposal_id]) globalAcc[ev.proposal_id] = new Map();
      const key = ev.rubric_criterion_id;
      if (!globalAcc[ev.proposal_id].has(key)) {
        globalAcc[ev.proposal_id].set(key, {
          name: (criteria as any).name,
          max_score: (criteria as any).max_score,
          scores: {},
          notes: {},
        });
      }
      globalAcc[ev.proposal_id].get(key)!.scores[ev.evaluator_id] = ev.score;
      if (ev.notes) {
        globalAcc[ev.proposal_id].get(key)!.notes[ev.evaluator_id] = ev.notes;
      }
    });
    for (const [proposalId, criteriaMap] of Object.entries(globalAcc)) {
      globalBreakdownData[proposalId] = Array.from(criteriaMap.values());
    }
  }

  // Build map: proposalId -> array of evaluator full_names who graded it
  const evaluatorByProposal: Record<string, string[]> = {};
  if (allEvaluations && profiles) {
    const evalMap = new Map(profiles.map((p) => [p.id, p.full_name]));
    for (const ev of allEvaluations) {
      if (!evaluatorByProposal[ev.proposal_id]) evaluatorByProposal[ev.proposal_id] = [];
      const fullName = evalMap.get(ev.evaluator_id);
      if (fullName && !evaluatorByProposal[ev.proposal_id].includes(fullName)) {
        evaluatorByProposal[ev.proposal_id].push(fullName);
      }
    }
  }

  // Build global overall notes: proposalId -> evaluatorId -> notes
  const globalOverallNotes: Record<string, Record<string, string>> = {};
  if (allOverallNotesRows) {
    for (const row of allOverallNotesRows) {
      if (!globalOverallNotes[row.proposal_id]) globalOverallNotes[row.proposal_id] = {};
      globalOverallNotes[row.proposal_id][row.evaluator_id] = row.notes;
    }
  }

  return (
    <EvaluatorDashboardClient
      proposals={proposals ?? []}
      currentUserId={user!.id}
      gradedProposalIds={gradedProposalIds}
      profiles={profiles ?? []}
      breakdownData={breakdownData}
      scoresByProposal={scoresByProposal}
      assignments={assignments ?? []}
      serverNow={new Date().toISOString()}
      daysLeft={daysLeft}
      hasSeenOnboarding={profiles?.find(p => p.id === user!.id)?.has_seen_onboarding ?? true}
      myOverallNotes={myOverallNotes}
      feedbackRecord={feedbackRow ?? null}
      hasSeenFeedbackPrompt={feedbackRow?.has_seen_prompt ?? false}
      evaluationsLocked={evaluationsLocked}
      maxPossibleScore={maxPossibleScore}
      globalBreakdownData={globalBreakdownData}
      evaluatorByProposal={evaluatorByProposal}
      globalOverallNotes={globalOverallNotes}
    />
  );
}
