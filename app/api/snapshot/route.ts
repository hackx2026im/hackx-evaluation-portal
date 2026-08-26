import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// POST /api/snapshot — called after a grading submission to store a JSON snapshot
// Uses the service-role client so it bypasses storage RLS entirely.
export async function POST(req: NextRequest) {
  try {
    // Verify the caller is an authenticated evaluator
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { proposalId, teamName, evaluatorName, evaluatorId, evaluationData } = body;

    if (!proposalId || !evaluationData) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Build the snapshot payload
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeName = (evaluatorName ?? "unknown").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
    const filename = `${proposalId}/${timestamp}_${safeName}.json`;

    const snapshot = {
      proposal_id: proposalId,
      team_name: teamName ?? "",
      evaluator: evaluatorName ?? "",
      evaluator_id: user.id, // Strictly use session user ID, do not trust client payload
      timestamp: new Date().toISOString(),
      evaluation_data: evaluationData,
    };

    const admin = createAdminClient();

    const { error } = await admin.storage
      .from("snapshots")
      .upload(filename, JSON.stringify(snapshot), {
        contentType: "application/json",
        upsert: true,
      });

    if (error) {
      console.error("[snapshot] Storage upload failed:", error.message);
      // Still return 200 — snapshot failure must never surface as an error to the client
      return NextResponse.json({ ok: false, detail: error.message });
    }

    return NextResponse.json({ ok: true, filename });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[snapshot] Unhandled error:", msg);
    // Always 200 — grading must never be blocked by backup failures
    return NextResponse.json({ ok: false, detail: msg });
  }
}
