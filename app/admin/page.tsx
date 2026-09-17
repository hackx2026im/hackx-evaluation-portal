import { createClient } from "@/lib/supabase/server";
import { AdminDashboardClient } from "./client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const [
    { data: proposals },
    { data: evaluations },
    { data: evaluators },
    { data: assignments },
    { data: overallNotes },
    { data: lockSetting },
    { data: rubricSectionsRaw },
  ] = await Promise.all([
    supabase
      .from("proposals")
      .select("*")
      .order("created_at", { ascending: false }),
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
      .select("id, full_name")
      .eq("role", "evaluator"),
    supabase
      .from("proposal_assignments")
      .select("*"),
    supabase
      .from("evaluation_overall_notes")
      .select("proposal_id, evaluator_id, notes"),
    supabase
      .from("system_settings")
      .select("value")
      .eq("key", "evaluations_locked")
      .single(),
    supabase
      .from("rubric_sections")
      .select("id, name, total_marks, order_index, rubric_criteria(id, name, max_score, order_index)")
      .order("order_index", { ascending: true }),
  ]);

  const evaluationsLocked = lockSetting?.value === '"true"' || lockSetting?.value === true || String(lockSetting?.value) === 'true' || String(lockSetting?.value) === '"true"';

  // Group evaluations by proposal_id, storing individual scores per evaluator
  const breakdownData: Record<string, any[]> = {};
  if (evaluations) {
    // proposal_id -> Map<criterion_id, { name, max_score, scores: { [evaluator_id]: score } }>
    const accumulator: Record<string, Map<string, { name: string; max_score: number; scores: Record<string, number>; notes: Record<string, string> }>> = {};

    evaluations.forEach((ev) => {
      const criteria = Array.isArray(ev.rubric_criteria) ? ev.rubric_criteria[0] : ev.rubric_criteria;
      if (!criteria) return;

      if (!accumulator[ev.proposal_id]) {
        accumulator[ev.proposal_id] = new Map();
      }

      const key = ev.rubric_criterion_id;
      if (!accumulator[ev.proposal_id].has(key)) {
        accumulator[ev.proposal_id].set(key, {
          name: (criteria as any).name,
          max_score: (criteria as any).max_score,
          scores: {},
          notes: {},
        });
      }
      accumulator[ev.proposal_id].get(key)!.scores[ev.evaluator_id] = ev.score;
      if (ev.notes) {
        accumulator[ev.proposal_id].get(key)!.notes[ev.evaluator_id] = ev.notes;
      }
    });

    for (const [proposalId, criteriaMap] of Object.entries(accumulator)) {
      breakdownData[proposalId] = Array.from(criteriaMap.values());
    }
  }

  // Build a map: proposalId -> array of evaluator full_names
  const evaluatorByProposal: Record<string, string[]> = {};
  if (evaluations && evaluators) {
    const evaluatorMap = new Map(evaluators.map((e) => [e.id, e.full_name]));
    for (const ev of evaluations) {
      if (!evaluatorByProposal[ev.proposal_id]) {
        evaluatorByProposal[ev.proposal_id] = [];
      }
      const fullName = evaluatorMap.get(ev.evaluator_id);
      if (fullName && !evaluatorByProposal[ev.proposal_id].includes(fullName)) {
        evaluatorByProposal[ev.proposal_id].push(fullName);
      }
    }
  }

  // Build map: proposalId -> evaluatorId -> overall note text
  const overallNotesByProposal: Record<string, Record<string, string>> = {};
  if (overallNotes) {
    for (const row of overallNotes) {
      if (!overallNotesByProposal[row.proposal_id]) {
        overallNotesByProposal[row.proposal_id] = {};
      }
      overallNotesByProposal[row.proposal_id][row.evaluator_id] = row.notes;
    }
  }

  // Sort criteria within each section by order_index (client-side, since Supabase
  // doesn't guarantee nested relation order without a separate .order() call)
  const rubricSections = (rubricSectionsRaw ?? []).map((section) => ({
    ...section,
    rubric_criteria: [...(section.rubric_criteria ?? [])].sort(
      (a, b) => a.order_index - b.order_index
    ),
  }));

  return (
    <AdminDashboardClient
      proposals={proposals ?? []}
      breakdownData={breakdownData}
      evaluators={evaluators ?? []}
      evaluatorByProposal={evaluatorByProposal}
      assignments={assignments ?? []}
      overallNotesByProposal={overallNotesByProposal}
      evaluationsLocked={evaluationsLocked}
      currentUserId={user?.id ?? ""}
      rubricSections={rubricSections}
    />
  );
}

