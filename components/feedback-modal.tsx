"use client";

import { useState, useEffect } from "react";
import { Star, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { EvaluatorFeedback, EaseOfUse } from "@/lib/types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  existingFeedback?: EvaluatorFeedback | null;
  /** Called after successful submit so parent can update state */
  onSubmitted?: (feedback: EvaluatorFeedback) => void;
}

type ModalState = "form" | "thanks";

const EASE_OPTIONS: { value: EaseOfUse; label: string }[] = [
  { value: "very_difficult", label: "Very Difficult" },
  { value: "difficult",      label: "Difficult" },
  { value: "neutral",        label: "Neutral" },
  { value: "easy",           label: "Easy" },
  { value: "very_easy",      label: "Very Easy" },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function FeedbackModal({
  isOpen,
  onClose,
  currentUserId,
  existingFeedback,
  onSubmitted,
}: FeedbackModalProps) {
  const supabase = createClient();

  // Form state
  const [rating, setRating]       = useState<number>(existingFeedback?.overall_rating ?? 0);
  const [hovered, setHovered]     = useState<number>(0);
  const [ease, setEase]           = useState<EaseOfUse | "">(existingFeedback?.ease_of_use ?? "");
  const [comments, setComments]   = useState<string>(existingFeedback?.comments ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [modalState, setModalState] = useState<ModalState>("form");

  // Sync state when existingFeedback changes (e.g. opened a second time)
  useEffect(() => {
    if (isOpen) {
      setRating(existingFeedback?.overall_rating ?? 0);
      setEase(existingFeedback?.ease_of_use ?? "");
      setComments(existingFeedback?.comments ?? "");
      setModalState("form");
    }
  }, [isOpen, existingFeedback]);

  // ── Mark seen immediately when popup opens ─────────────────────────────────

  useEffect(() => {
    if (!isOpen || !currentUserId) return;
    // Fire-and-forget — prevents re-show even if user closes immediately
    supabase
      .from("evaluator_feedback")
      .upsert(
        { evaluator_id: currentUserId, has_seen_prompt: true },
        { onConflict: "evaluator_id" }
      )
      .then(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentUserId]);

  if (!isOpen) return null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSkip = () => {
    // has_seen_prompt already set above — just close
    onClose();
  };

  const handleSubmit = async () => {
    if (!rating || !ease) return;
    setSubmitting(true);
    try {
      const payload = {
        evaluator_id:   currentUserId,
        overall_rating: rating,
        ease_of_use:    ease,
        comments:       comments.trim() || null,
        submitted_at:   new Date().toISOString(),
        has_seen_prompt: true,
      };
      const { data, error } = await supabase
        .from("evaluator_feedback")
        .upsert(payload, { onConflict: "evaluator_id" })
        .select()
        .single();

      if (error) throw error;

      setModalState("thanks");
      if (onSubmitted && data) onSubmitted(data as EvaluatorFeedback);
      setTimeout(() => {
        onClose();
      }, 2800);
    } catch (err) {
      console.error("Feedback submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = rating > 0 && ease !== "";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm"
        onClick={handleSkip}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fbm-modal fixed z-[201] inset-x-4 bottom-4 sm:inset-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-[480px] sm:w-full"
        style={{
          background: "var(--bw-bg-primary)",
          border: "1px solid var(--bw-border)",
          boxShadow: "var(--bw-shadow-200)",
          borderRadius: "var(--bw-radius-lg)",
          overflow: "hidden",
          maxHeight: "90svh",
          overflowY: "auto",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
      >
        {modalState === "thanks" ? (
          /* ── Thank-you state ── */
          <div
            style={{
              padding: "var(--bw-space-12) var(--bw-space-8)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--bw-space-4)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "var(--bw-positive-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
              }}
            >
              ✓
            </div>
            <h2
              style={{
                fontFamily: "var(--bw-font-heading)",
                fontSize: "var(--bw-fs-h4)",
                fontWeight: "var(--bw-fw-bold)" as any,
                color: "var(--bw-content-primary)",
                letterSpacing: "-0.01em",
              }}
            >
              We really appreciate it.
            </h2>
            <p
              style={{
                fontSize: "var(--bw-fs-sm)",
                color: "var(--bw-content-secondary)",
                lineHeight: "var(--bw-lh-relaxed)",
                maxWidth: 320,
              }}
            >
              See you at the finals.
            </p>
          </div>
        ) : (
          /* ── Form state ── */
          <div style={{ padding: "var(--bw-space-6)" }}>
            {/* Close button */}
            <button
              onClick={handleSkip}
              aria-label="Close"
              style={{
                position: "absolute",
                top: "var(--bw-space-4)",
                right: "var(--bw-space-4)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--bw-content-tertiary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                width: 32,
                height: 32,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--bw-content-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--bw-content-tertiary)")}
            >
              <X size={18} strokeWidth={2.5} />
            </button>

            {/* Header */}
            <div style={{ marginBottom: "var(--bw-space-6)", paddingRight: "var(--bw-space-8)" }}>
              <p
                style={{
                  fontSize: "var(--bw-fs-xs)",
                  fontWeight: "var(--bw-fw-bold)" as any,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--bw-content-tertiary)",
                  marginBottom: "var(--bw-space-3)",
                }}
              >
                HACKX 11.0
              </p>
              <h2
                id="feedback-title"
                style={{
                  fontFamily: "var(--bw-font-heading)",
                  fontSize: "var(--bw-fs-h2-fluid)",
                  fontWeight: "var(--bw-fw-bold)" as any,
                  lineHeight: "var(--bw-lh-tight)",
                  color: "var(--bw-content-primary)",
                  letterSpacing: "-0.02em",
                  marginBottom: "var(--bw-space-3)",
                }}
              >
                {existingFeedback?.overall_rating
                  ? "Edit your feedback."
                  : "Thank you so much."}
              </h2>
              <p
                style={{
                  fontSize: "var(--bw-fs-sm)",
                  color: "var(--bw-content-secondary)",
                  lineHeight: "var(--bw-lh-relaxed)",
                }}
              >
                {existingFeedback?.overall_rating
                  ? "Update your thoughts below — every detail helps."
                  : "You made hackX 11.0 possible. We would love to hear your thoughts on the portal — what worked, what didn't, and anything we can do better. This means a lot to us and will directly shape how we build for hackX and the upcoming hackX."}
              </p>
            </div>

            {/* Divider */}
            <div
              style={{
                height: 1,
                background: "var(--bw-border)",
                margin: "0 0 var(--bw-space-6)",
              }}
            />

            {/* Q1: Star rating */}
            <div style={{ marginBottom: "var(--bw-space-6)" }}>
              <p
                style={{
                  fontSize: "var(--bw-fs-sm)",
                  fontWeight: "var(--bw-fw-medium)" as any,
                  color: "var(--bw-content-primary)",
                  marginBottom: "var(--bw-space-3)",
                }}
              >
                How would you rate your overall experience?
              </p>
              <div style={{ display: "flex", gap: "var(--bw-space-2)" }}>
                {[1, 2, 3, 4, 5].map((star) => {
                  const filled = star <= (hovered || rating);
                  return (
                    <button
                      key={star}
                      type="button"
                      aria-label={`${star} star${star > 1 ? "s" : ""}`}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHovered(star)}
                      onMouseLeave={() => setHovered(0)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 2,
                        lineHeight: 1,
                        transition: "transform 0.12s ease",
                        transform: filled ? "scale(1.15)" : "scale(1)",
                      }}
                    >
                      <Star
                        size={28}
                        strokeWidth={1.5}
                        style={{
                          fill: filled ? "var(--bw-warning)" : "transparent",
                          stroke: filled ? "var(--bw-warning)" : "var(--bw-content-disabled)",
                          transition: "fill 0.12s ease, stroke 0.12s ease",
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Q2: Ease of use */}
            <div style={{ marginBottom: "var(--bw-space-6)" }}>
              <p
                style={{
                  fontSize: "var(--bw-fs-sm)",
                  fontWeight: "var(--bw-fw-medium)" as any,
                  color: "var(--bw-content-primary)",
                  marginBottom: "var(--bw-space-3)",
                }}
              >
                How easy was it to navigate and complete the evaluations?
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--bw-space-2)",
                }}
              >
                {EASE_OPTIONS.map((opt) => {
                  const selected = ease === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEase(opt.value)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: "var(--bw-radius-pill)",
                        border: `1px solid ${selected ? "var(--bw-border-strong)" : "var(--bw-border)"}`,
                        background: selected ? "var(--bw-bg-inverse)" : "transparent",
                        color: selected ? "var(--bw-content-inverse)" : "var(--bw-content-primary)",
                        fontSize: "var(--bw-fs-xs)",
                        fontWeight: selected ? ("var(--bw-fw-medium)" as any) : ("var(--bw-fw-regular)" as any),
                        cursor: "pointer",
                        transition: "all var(--bw-duration-normal) var(--bw-easing)",
                        fontFamily: "var(--bw-font-body)",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Q3: Comments */}
            <div style={{ marginBottom: "var(--bw-space-6)" }}>
              <p
                style={{
                  fontSize: "var(--bw-fs-sm)",
                  fontWeight: "var(--bw-fw-medium)" as any,
                  color: "var(--bw-content-primary)",
                  marginBottom: "var(--bw-space-3)",
                }}
              >
                Any suggestions or comments?{" "}
                <span style={{ color: "var(--bw-content-disabled)", fontWeight: "normal" as any }}>
                  Optional
                </span>
              </p>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
                placeholder="Share your thoughts..."
                className="bw-input"
                style={{
                  resize: "vertical",
                  minHeight: 80,
                  maxHeight: 200,
                  fontFamily: "var(--bw-font-body)",
                }}
              />
            </div>

            {/* Actions */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: "var(--bw-space-4)",
                borderTop: "1px solid var(--bw-border)",
              }}
            >
              <button
                type="button"
                onClick={handleSkip}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "var(--bw-fs-sm)",
                  color: "var(--bw-content-tertiary)",
                  padding: "10px 0",
                  fontFamily: "var(--bw-font-body)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--bw-content-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--bw-content-tertiary)")}
              >
                Maybe later
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="bw-button"
                style={{
                  background: canSubmit ? "var(--bw-bg-inverse)" : "var(--bw-bg-tertiary)",
                  color: canSubmit ? "var(--bw-content-inverse)" : "var(--bw-content-disabled)",
                  border: "none",
                  borderRadius: "var(--bw-radius-pill)",
                  padding: "12px 24px",
                  fontSize: "var(--bw-fs-sm)",
                  fontWeight: "var(--bw-fw-medium)" as any,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  transition: "all var(--bw-duration-normal) var(--bw-easing)",
                  fontFamily: "var(--bw-font-body)",
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? "Submitting..." : "Share My Thoughts"}
              </button>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .fbm-modal {
          animation: fbm-slide-up 0.28s cubic-bezier(0.32, 0.72, 0, 1);
        }
        @media (min-width: 640px) {
          .fbm-modal {
            animation: fbm-scale-in 0.2s ease;
          }
        }
        @keyframes fbm-slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fbm-scale-in {
          from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}} />
    </>
  );
}
