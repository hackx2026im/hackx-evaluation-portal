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

/* Copy lives in content.md (hackX 11.0 draft, v1) — keep the two in sync. */
const SLIDES: Slide[] = [
  {
    eyebrow: "HACKX 11.0",
    heading: "Welcome aboard.",
    body: (
      <div className="space-y-4">
        <p>
          A short walkthrough of the evaluation portal — your dashboard, the
          proposals assigned to you, how scoring works, and how final rankings
          are decided.
        </p>
        <p
          style={{
            fontSize: "var(--bw-fs-sm)",
            color: "var(--bw-content-secondary)",
          }}
        >
          Under two minutes. You can reopen this guide at any time from your
          profile menu.
        </p>
      </div>
    ),
  },
  {
    eyebrow: "YOUR DASHBOARD",
    heading: "Everything at a glance.",
    body: (
      <div className="space-y-4">
        <p>
          Three cards track your progress: how many proposals are assigned to
          you, how many are still ungraded, and how many days remain before the
          deadline.
        </p>
        <p>
          The Top 15 panel is the live leaderboard, built from combined averages
          across the whole panel. It updates on its own as evaluations come in.
        </p>
      </div>
    ),
  },
  {
    eyebrow: "MY ASSIGNMENTS",
    heading: "Your work queue.",
    body: (
      <div className="space-y-4">
        <p>
          Every proposal you have been asked to review sits here, with the team
          name, direct links to the proposal document and pitch video, and its
          current status.
        </p>
        <p>
          Evaluate opens the scoring workspace. Flip on Show Pending to hide
          everything you have already graded.
        </p>
      </div>
    ),
  },
  {
    eyebrow: "ALL PROPOSALS",
    heading: "See the whole field.",
    body: (
      <div className="space-y-4">
        <p>
          All Proposals is a read-only view of every team in the competition —
          who is evaluating what, and where each submission stands.
        </p>
        <p>
          You can open any graded team&apos;s breakdown to see how the marks were
          distributed. Evaluate only appears on proposals assigned to you.
        </p>
      </div>
    ),
  },
  {
    eyebrow: "SCORING",
    heading: "Document and rubric, side by side.",
    body: (
      <div className="space-y-4">
        <p>
          Opening a proposal puts the submission on the left and the rubric on
          the right. Switch between the Document and Video tabs without losing
          your place.
        </p>
        <p>
          Scoring is split into two sections — Proposal (70 marks) and Pitch
          Video (30 marks). Each criterion lists its grade bands, so you can see
          what range matches the performance level you have in mind.
        </p>
        <div className="flex flex-wrap gap-2" style={{ margin: "var(--bw-space-4) 0 0" }}>
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
      </div>
    ),
  },
  {
    eyebrow: "NOTES & ANNOTATIONS",
    heading: "Capture your reasoning as you read.",
    body: (
      <div className="space-y-4">
        <p>
          Highlight a passage in the proposal to pin a note to it, or drop a
          timestamped comment while the pitch video plays. Your notes stay
          attached to the exact spot that prompted them.
        </p>
        <p>
          There is also an overall comment box for the summary judgement. Notes
          are visible to organisers and are what make a score defensible later.
        </p>
      </div>
    ),
  },
  {
    eyebrow: "FINAL RANKINGS",
    heading: "Combined averages decide the outcome.",
    body: (
      <div className="space-y-4">
        <p>
          Each proposal is reviewed by two evaluators, and the final score is the
          average of both totals. Individual marks are never shown across the
          panel — only the combined average reaches the leaderboard.
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
            Rankings move as the remaining evaluations land. Standings are final
            only once organisers lock evaluations.
          </p>
        </div>
        <p
          style={{
            fontSize: "var(--bw-fs-sm)",
            lineHeight: "var(--bw-lh-relaxed)",
            color: "var(--bw-content-secondary)",
          }}
        >
          If something looks off — an outlier, a borderline team, a scoring
          mismatch — talk to your co-evaluator and settle it before the lock.
        </p>
      </div>
    ),
  },
  {
    eyebrow: "SECURITY",
    heading: "Set your own password.",
    body: (
      <div className="space-y-4">
        <p>
          Your account was issued with a temporary password. Replacing it now
          keeps the evaluation record tied to you and only you.
        </p>
        <p
          style={{
            fontSize: "var(--bw-fs-sm)",
            color: "var(--bw-content-secondary)",
          }}
        >
          You can skip this and do it later from your profile menu.
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
              {slide.eyebrow}
            </span>
          ) : (
            <img
              key={`slide-img-${step}`}
              src={`/onboarding/slide${n}.webp`}
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
