import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// GET /api/export-proposal-rubric?proposalId=<uuid>
// GET /api/export-proposal-rubric?evaluatorId=<uuid>
// Admin-only: exports team info + the full rubric as a CSV sheet, either for
// a single proposal or for every proposal assigned to one evaluator (one row
// per team). For evaluators who cannot use the platform directly.
export async function GET(request: Request) {
  try {
    // 1. Verify caller is an authenticated admin
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2. Read the target from the query string
    const { searchParams } = new URL(request.url);
    const proposalId = searchParams.get("proposalId");
    const evaluatorId = searchParams.get("evaluatorId");

    if (!proposalId && !evaluatorId) {
      return NextResponse.json({ error: "Missing proposalId or evaluatorId" }, { status: 400 });
    }

    const admin = createAdminClient();

    // 3. Resolve which proposals to export, and a filename hint
    let proposals: { team_name: string; proposal_url: string | null; video_url: string | null }[];
    let filenameBase: string;

    if (evaluatorId) {
      const [{ data: evaluatorProfile }, { data: assignments, error: assignmentsError }] = await Promise.all([
        admin.from("profiles").select("full_name").eq("id", evaluatorId).single(),
        admin.from("proposal_assignments").select("proposal_id").eq("evaluator_id", evaluatorId),
      ]);

      if (assignmentsError) throw assignmentsError;
      if (!evaluatorProfile) {
        return NextResponse.json({ error: "Evaluator not found" }, { status: 404 });
      }

      const proposalIds = (assignments ?? []).map((a) => a.proposal_id);
      if (proposalIds.length === 0) {
        return NextResponse.json({ error: "This evaluator has no assigned proposals" }, { status: 404 });
      }

      const { data: assignedProposals, error: proposalsError } = await admin
        .from("proposals")
        .select("team_name, proposal_url, video_url")
        .in("id", proposalIds)
        .order("team_name", { ascending: true });

      if (proposalsError) throw proposalsError;
      proposals = assignedProposals ?? [];

      filenameBase = `${evaluatorProfile.full_name}-assignments`.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    } else {
      const { data: proposal, error: proposalError } = await admin
        .from("proposals")
        .select("team_name, proposal_url, video_url")
        .eq("id", proposalId as string)
        .single();

      if (proposalError || !proposal) {
        return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
      }

      proposals = [proposal];
      filenameBase = `${proposal.team_name}-evaluation-sheet`.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    }

    // 4. Fetch the full rubric once (shared across all rows)
    const { data: sections, error: sectionsError } = await admin
      .from("rubric_sections")
      .select("id, name, order_index, rubric_criteria(id, name, description, max_score, order_index)")
      .order("order_index", { ascending: true });

    if (sectionsError) throw sectionsError;

    const criteria = (sections ?? [])
      .sort((a, b) => a.order_index - b.order_index)
      .flatMap((section) =>
        [...(section.rubric_criteria ?? [])]
          .sort((a, b) => a.order_index - b.order_index)
          .map((c) => ({ ...c, sectionName: section.name }))
      );

    // 5. Build the CSV — one row per team. Team name, drive link, and video
    // link come first, then exactly one column per criterion (for the
    // score). The criterion's name, section, max score and description are
    // folded into that column's header (not repeated on every row).
    const csvEscape = (value: string | number) => {
      const str = String(value ?? "");
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const headerCells: (string | number)[] = ["Team Name", "Proposal (Drive) Link", "Video Link"];
    for (const c of criteria) {
      headerCells.push(`${c.sectionName} — ${c.name} (Max: ${c.max_score})\n${c.description ?? ""}`);
    }

    const rows = proposals.map((p) => {
      const dataCells: (string | number)[] = [p.team_name, p.proposal_url ?? "", p.video_url ?? ""];
      for (const _c of criteria) {
        dataCells.push(""); // blank score cell to fill in
      }
      return dataCells;
    });

    const csv = [headerCells, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\r\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[export-proposal-rubric] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
