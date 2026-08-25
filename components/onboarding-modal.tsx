"use client";

import { useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PasswordChangeForm } from "./password-change-form";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
  isPreview?: boolean;
}

interface Slide {
  eyebrow: string;
  heading: string;
  body: React.ReactNode;
}

// ─── Slide definitions ────────────────────────────────────────────────────────

const SLIDES: Slide[] = [
  {
    eyebrow: "HACKX 11.0",
    heading: "Welcome.",
    body: (
      <div className="space-y-4">
        <p>
          This is a quick walkthrough of the evaluation platform. It covers your dashboard, your assignments, how to submit evaluations, and how final rankings are calculated. Takes under two minutes.
        </p>
      </div>
    ),
  },
  {
    eyebrow: "DASHBOARD",
    heading: "Your evaluation overview.",
    body: (
      <div className="space-y-4">
        <p>
          The dashboard shows your total assigned proposals, how many are still
          ungraded, and the days remaining until the deadline.
        </p>
        <p>
          The Top 15 panel on the right reflects the live leaderboard based on
          combined averages across all evaluators — it updates automatically as
          evaluations are submitted.
        </p>
      </div>
    ),
  },
  {
    eyebrow: "MY ASSIGNMENTS",
    heading: "Proposals assigned to you.",
    body: (
      <div className="space-y-4">
        <p>
          This table lists every proposal you have been asked to evaluate. Each
          row shows the team, direct links to the proposal document and
          submission, and the current status.
        </p>
        <p>
          When a proposal is ready, the Evaluate button becomes your entry
          point. Use the Show Pending toggle to filter down to ungraded
          submissions only.
        </p>
      </div>
    ),
  },
  {
    eyebrow: "ALL PROPOSALS",
    heading: "Full visibility across all submissions.",
    body: (
      <div className="space-y-4">
        <p>
          All Proposals gives you a read-only view of every team in the
          competition. You can see assigned evaluators and grading status across
          the full pool.
        </p>
        <p>
          The Evaluate action only appears for proposals directly assigned to
          you. Use the Graded only toggle or the All Evaluators filter to narrow
          the view.
        </p>
      </div>
    ),
  },
  {
    eyebrow: "SUBMITTING AN EVALUATION",
    heading: "Rubric-based scoring system.",
    body: (
      <div className="space-y-4">
        <p>
          Opening a proposal loads the PDF viewer alongside the scoring panel.
          Evaluations are split into two sections — Proposal (70 marks) and
          Pitch Video (30 marks).
        </p>
        <div className="flex flex-wrap gap-2" style={{ margin: "var(--bw-space-4) 0" }}>
          {["Excellent", "Good", "Developing", "Weak"].map((label) => (
            <span
              key={label}
              className="rounded-full"
              style={{
                padding: "6px 14px",
                border: "1px solid var(--bw-border)",
                fontSize: "var(--bw-fs-xs)",
                fontWeight: "var(--bw-fw-bold)",
                background: "var(--bw-bg-secondary)",
                color: "var(--bw-content-secondary)",
              }}
            >
              {label}
            </span>
          ))}
        </div>
        <p>
          Enter the mark directly into the field for each criterion. The grade
          band labels show you what range corresponds to each performance level.
        </p>
      </div>
    ),
  },
  {
    eyebrow: "FINAL RANKINGS",
    heading: "Determined by combined averages.",
    body: (
      <div className="space-y-4">
        <p>
          Each proposal is reviewed by two evaluators. The final score is the
          average of both evaluators&apos; total marks. Individual scores are not
          visible across the panel — only the combined average appears in the
          leaderboard.
        </p>
        <div
          className="flex gap-3 rounded-xl"
          style={{
            padding: "var(--bw-space-4)",
            background: "var(--bw-warning-bg)",
            border: "1px solid var(--bw-warning)",
            color: "var(--bw-warning)",
          }}
        >
          <span className="text-xl leading-none shrink-0 mt-0.5">⚠️</span>
          <p className="text-[14px] leading-snug font-medium">
            Rankings shift as remaining evaluations come in. Final standings are
            confirmed only once all evaluations are closed.
          </p>
        </div>
        <p
          style={{
            fontSize: "var(--bw-fs-sm)",
            lineHeight: "var(--bw-lh-relaxed)",
            color: "var(--bw-content-secondary)",
          }}
        >
          If a result warrants discussion — an outlier, a borderline team, or a
          scoring misalignment — coordinate directly with your co-evaluator to
          reach a consensus.
        </p>
      </div>
    ),
  },
  {
    eyebrow: "SECURITY",
    heading: "Change your password.",
    body: (
      <div className="space-y-4">
        <p>
          To ensure the integrity of the evaluation process, we recommend
          updating your temporary password to a secure, private one.
        </p>
        <p
          style={{
            fontSize: "var(--bw-fs-sm)",
            color: "var(--bw-content-secondary)",
          }}
        >
          You can skip this step and change it later from your profile settings
          at any time.
        </p>
      </div>
    ),
  },
];

const TOTAL_STEPS = SLIDES.length;

// ─── Main component ───────────────────────────────────────────────────────────

export function OnboardingModal({
  isOpen,
  onClose,
  currentUserId,
  isPreview = false,
}: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);
  const supabase = createClient();

  if (!isOpen) return null;

  const slide = SLIDES[step];
  const n = step + 1;

  // ── persistence ──────────────────────────────────────────────────────────

  const persist = async () => {
    if (!isPreview && currentUserId) {
      await supabase
        .from("profiles")
        .update({ has_seen_onboarding: true })
        .eq("id", currentUserId);
    }
  };

  const handleClose = () => {
    persist(); // fire-and-forget — non-critical write, don't block UI
    onClose(); // close immediately
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setImgFailed(false);
      setStep((s) => s + 1);
    } else {
      handleClose();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setImgFailed(false);
      setStep((s) => s - 1);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Backdrop (separate element so it never wraps the modal) ── */}
      <div
        className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/*
        ── Modal container ──
        Has its OWN position:fixed so it is never at the mercy of
        a flex-parent's items-end on Android Chrome.

        Mobile  (<sm): pinned to bottom via bottom-0 inset-x-0, sheet style
        Tablet  (sm–md): centred with translate trick, max-w-lg, card style
        Desktop (md+): centred, max-w-[860px], two-column layout
      */}
      <div
        className={[
          "fixed z-[201] obm-modal",
          // Mobile: full width, stuck to bottom
          "inset-x-0 bottom-0 w-full",
          "rounded-t-2xl",
          // sm+: centred in viewport
          "sm:inset-auto sm:bottom-auto",
          "sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
          "sm:max-w-lg sm:rounded-2xl",
          // md+: wider two-column
          "md:max-w-[860px]",
          "flex flex-col md:flex-row md:items-stretch",
        ].join(" ")}
        style={{
          background: "var(--bw-bg-primary)",
          border: "1px solid var(--bw-border)",
          boxShadow: "var(--bw-shadow-200)",
          maxHeight: "92svh",
          overflowY: "auto",
          // Account for Android navigation bar at the bottom
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* PREVIEW badge */}
        {isPreview && (
          <div className="absolute top-4 left-4 z-30 pointer-events-none">
            <span
              style={{
                fontSize: "var(--bw-fs-xs)",
                fontWeight: "var(--bw-fw-bold)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--bw-content-secondary)",
                background: "var(--bw-bg-secondary)",
                padding: "var(--bw-space-1) var(--bw-space-2)",
                borderRadius: "var(--bw-radius-sm)",
                border: "1px solid var(--bw-border)",
              }}
            >
              Preview mode
            </span>
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={handleClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-30 rounded-full flex items-center justify-center transition-colors"
          style={{
            width: "32px",
            height: "32px",
            color: "var(--bw-content-secondary)",
            background: "transparent",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--bw-content-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--bw-content-secondary)")}
        >
          <X size={20} strokeWidth={2.5} />
        </button>

        {/*
          ── Image panel ──
          Visible on mobile and desktop. Fixed smaller height on mobile.
        */}
        <div
          className="flex w-full h-[200px] md:h-auto md:w-[40%] items-center justify-center relative overflow-hidden shrink-0"
          style={{
            background: "var(--bw-bg-secondary)",
            borderRadius: "var(--bw-radius-md) var(--bw-radius-md) 0 0",
            borderBottom: "1px solid var(--bw-border)",
          }}
        >
          {imgFailed ? (
            <span
              style={{
                fontSize: "var(--bw-fs-xs)",
                fontWeight: "var(--bw-fw-bold)",
                letterSpacing: "0.05em",
                color: "var(--bw-content-disabled)",
                textTransform: "uppercase",
              }}
            >
              onboard{n}.gif
            </span>
          ) : (
            <img
              key={`slide-img-${step}`}
              src={`/onboarding/onboard${n}.gif`}
              alt=""
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/*
          ── Right / main content panel ──
          Full-width on mobile, 60% on desktop.
          Padding is larger on desktop, compact on mobile.
        */}
        <div
          className="flex flex-col justify-between w-full md:w-[60%]"
          style={{
            /* clamp gives comfortable padding on any screen width */
            padding: "clamp(20px, 5vw, 32px)",
            /* Extra top padding to clear the close button */
            paddingTop: "clamp(48px, 7vw, 56px)",
          }}
        >
          {/* Content */}
          <div>
            {/* Step counter — visible on mobile only as a subtle progress hint */}
            <p
              className="md:hidden"
              style={{
                fontSize: "var(--bw-fs-xs)",
                color: "var(--bw-content-disabled)",
                marginBottom: "var(--bw-space-3)",
                fontWeight: "var(--bw-fw-medium)",
              }}
            >
              Step {n} of {TOTAL_STEPS}
            </p>

            {/* Eyebrow */}
            <p
              style={{
                fontSize: "var(--bw-fs-xs)",
                fontWeight: "var(--bw-fw-bold)",
                letterSpacing: "0.05em",
                color: "var(--bw-content-tertiary)",
                textTransform: "uppercase",
                marginBottom: "var(--bw-space-3)",
              }}
            >
              {slide.eyebrow}
            </p>

            {/* Heading */}
            <h1
              style={{
                fontFamily: "var(--bw-font-heading)",
                /* clamp: 1.5rem on mobile → 2rem on desktop */
                fontSize: "var(--bw-fs-h2-fluid)",
                fontWeight: "var(--bw-fw-bold)",
                lineHeight: "var(--bw-lh-tight)",
                color: "var(--bw-content-primary)",
                marginBottom: "var(--bw-space-4)",
                letterSpacing: "-0.02em",
              }}
            >
              {slide.heading}
            </h1>

            {/* Body */}
            <div
              style={{
                fontSize: "var(--bw-fs-base)",
                lineHeight: "var(--bw-lh-body)",
                color: "var(--bw-content-secondary)",
              }}
            >
              {step === TOTAL_STEPS - 1 ? (
                <div>
                  <PasswordChangeForm
                    onSuccess={handleClose}
                    onSkip={handleClose}
                    showSkip={true}
                  />
                </div>
              ) : (
                slide.body
              )}
            </div>
          </div>

          {/* ── Bottom navigation bar ── */}
          {step < TOTAL_STEPS - 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "var(--bw-space-8)",
                paddingTop: "var(--bw-space-5)",
                borderTop: "1px solid var(--bw-border)",
              }}
            >
            {/* Skip / Back */}
            <div className="flex-1 flex justify-start">
              <button
                onClick={step === 0 ? handleClose : handleBack}
                className="transition-colors rounded-full"
                style={{
                  fontSize: "var(--bw-fs-sm)",
                  fontWeight: "var(--bw-fw-medium)",
                  color: "var(--bw-content-secondary)",
                  padding: "10px 14px",
                  marginLeft: "-14px",
                  background: "transparent",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--bw-content-primary)";
                  e.currentTarget.style.background = "var(--bw-hover-light)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--bw-content-secondary)";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {step === 0 ? "Skip guide" : "Back"}
              </button>
            </div>

            {/* Progress dots — hidden on very small phones, visible on sm+ */}
            <div
              className="hidden sm:flex items-center justify-center flex-1 shrink-0"
              style={{ gap: "var(--bw-space-2)" }}
            >
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === step ? "20px" : "7px",
                    height: "7px",
                    background:
                      i === step ? "var(--bw-bg-inverse)" : "var(--bw-bg-tertiary)",
                  }}
                />
              ))}
            </div>

            {/* Next / Finish */}
            <div className="flex-1 flex justify-end">
              <button
                onClick={step < TOTAL_STEPS - 1 ? handleNext : handleClose}
                className="rounded-full transition-all flex items-center justify-center whitespace-nowrap active:scale-[0.97]"
                style={{
                  background: "var(--bw-bg-inverse)",
                  color: "var(--bw-content-inverse)",
                  fontSize: "var(--bw-fs-sm)",
                  fontWeight: "var(--bw-fw-medium)",
                  padding: "12px 18px",
                  gap: "var(--bw-space-1)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                {step === TOTAL_STEPS - 1
                  ? "Finish"
                  : step === 0
                  ? "Get started"
                  : "Next"}
                {step < TOTAL_STEPS - 1 ? (
                  <ChevronRight size={16} strokeWidth={2.5} />
                ) : (
                  <Check size={16} strokeWidth={2.5} />
                )}
              </button>
            </div>
          </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        /* Slide up on mobile, scale-in on sm+ */
        .obm-modal {
          animation: obm-mobile 0.28s cubic-bezier(0.32, 0.72, 0, 1);
        }
        @media (min-width: 640px) {
          .obm-modal {
            animation: obm-desktop 0.2s ease;
          }
        }
        @keyframes obm-mobile {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes obm-desktop {
          from { opacity: 0; transform: scale(0.97) translateY(4px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
      `}} />
    </>
  );
}
