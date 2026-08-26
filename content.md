# Onboarding Process Content

> **Archive — ideasprint 2026 era.** Superseded by the hackX 11.0 draft at the
> bottom of this file. Kept for reference; do not ship this copy.

---

## Previous content (ideasprint 2026)

## Slide 1
**Eyebrow:** HACKX 11.0
**Heading:** Welcome.
**Body:**
This is a quick walkthrough of the evaluation platform. It covers your dashboard, your assignments, how to submit evaluations, and how final rankings are calculated. Takes under two minutes.

## Slide 2
**Eyebrow:** DASHBOARD
**Heading:** Your evaluation overview.
**Body:**
The dashboard shows your total assigned proposals, how many are still ungraded, and the days remaining until the deadline.

The Top 15 panel on the right reflects the live leaderboard based on combined averages across all evaluators — it updates automatically as evaluations are submitted.

## Slide 3
**Eyebrow:** MY ASSIGNMENTS
**Heading:** Proposals assigned to you.
**Body:**
This table lists every proposal you have been asked to evaluate. Each row shows the team, direct links to the proposal document and submission, and the current status.

When a proposal is ready, the Evaluate button becomes your entry point. Use the Show Pending toggle to filter down to ungraded submissions only.

## Slide 4
**Eyebrow:** ALL PROPOSALS
**Heading:** Full visibility across all submissions.
**Body:**
All Proposals gives you a read-only view of every team in the competition. You can see assigned evaluators and grading status across the full pool.

The Evaluate action only appears for proposals directly assigned to you. Use the Graded only toggle or the All Evaluators filter to narrow the view.

## Slide 5
**Eyebrow:** SUBMITTING AN EVALUATION
**Heading:** Rubric-based scoring system.
**Body:**
Opening a proposal loads the PDF viewer alongside the scoring panel. Evaluations are split into two sections — Proposal (70 marks) and Pitch Video (30 marks).

*(Available labels: Excellent, Good, Developing, Weak)*

Enter the mark directly into the field for each criterion. The grade band labels show you what range corresponds to each performance level.

## Slide 6
**Eyebrow:** FINAL RANKINGS
**Heading:** Determined by combined averages.
**Body:**
Each proposal is reviewed by two evaluators. The final score is the average of both evaluators' total marks. Individual scores are not visible across the panel — only the combined average appears in the leaderboard.

⚠️ **Important:** Rankings shift as remaining evaluations come in. Final standings are confirmed only once all evaluations are closed.

If a result warrants discussion — an outlier, a borderline team, or a scoring misalignment — coordinate directly with your co-evaluator to reach a consensus.

## Slide 7
**Eyebrow:** SECURITY
**Heading:** Change your password.
**Body:**
To ensure the integrity of the evaluation process, we recommend updating your temporary password to a secure, private one.

You can skip this step and change it later from your profile settings at any time.


---

# hackX 11.0 — Onboarding Content (current)

> **This is the copy that ships.** Mirrored in `components/onboarding-modal.tsx`
> (`SLIDES`) — keep the two in sync.
>
> **Changes from the archived version:** rebranded to hackX 11.0; the FINAL
> RANKINGS slide was dropped because the Top 15 leaderboard was removed from the
> evaluator dashboard; slide 5 now describes a single 100-mark rubric covering
> both proposal and pitch video, replacing the old 70/30 split.
>
> **Imagery:** slides 1 and 6 reuse the original mint-green animations
> (`onboard1.gif`, `onboard7.gif`). Slides 2-5 are real portal screenshots
> composited onto the same mint field by `scripts/build_onboarding_frames.py`
> from `design/onboarding/shots.json`.

## Slide 1
**Eyebrow:** hackX 11.0
**Heading:** Welcome.
**Image:** `onboard1.gif` (reused)
**Body:**
This is a quick walkthrough of the evaluation platform. It covers your dashboard, your assignments, how to submit evaluations, and how final rankings are calculated. Takes under two minutes.

## Slide 2
**Eyebrow:** DASHBOARD
**Heading:** Your evaluation overview.
**Image:** `slide-dashboard.webp`
**Body:**
The dashboard shows your total assigned proposals, how many are still ungraded, and the days remaining until the deadline.

## Slide 3
**Eyebrow:** MY ASSIGNMENTS
**Heading:** Proposals assigned to you.
**Image:** `slide-assignments.webp`
**Body:**
This table lists every proposal you have been asked to evaluate. Each row shows the team, direct links to the proposal document and submission, and the current status.

When a proposal is ready, the Evaluate button becomes your entry point. Use the Show Pending toggle to filter down to ungraded submissions only.

## Slide 4
**Eyebrow:** ALL PROPOSALS
**Heading:** Full visibility across all submissions.
**Image:** `slide-all-proposals.webp`
**Body:**
All Proposals gives you a read-only view of every team in the competition. You can see assigned evaluators and grading status across the full pool.

The Evaluate action only appears for proposals directly assigned to you. Use the Graded-only toggle or the All Evaluators filter to narrow the view.

> **Note:** the All Proposals section was removed from the evaluator dashboard in
> commit `2330b41`, along with the Graded-only toggle and the All Evaluators
> filter described above. This slide is included by request; revisit the copy if
> the section does not return.

## Slide 5
**Eyebrow:** SUBMITTING AN EVALUATION
**Heading:** Rubric-based scoring system.
**Image:** `slide-evaluation.webp`
**Body:**
Opening a proposal loads the PDF viewer alongside the scoring panel. A single rubric is used to evaluate both the proposal and pitch video, with each criterion accompanied by a description to guide your evaluation.

*(Available labels: Excellent, Good, Developing, Weak)*

Enter the mark directly into the field for each criterion. The grade band labels show you the mark range corresponding to each performance level.

## Slide 6
**Eyebrow:** SECURITY
**Heading:** Change your password.
**Image:** `onboard7.gif` (reused)
**Body:**
To ensure the integrity of the evaluation process, we recommend updating your temporary password to a secure, private one.

You can skip this step and change it later from your profile settings at any time.
