"use client";

import { useState, useEffect } from "react";
import { Star, CheckCircle, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { EvaluatorFeedback, EaseOfUse } from "@/lib/types/database";
import Link from "next/link";

interface Props {
  currentUserId: string;
  existingFeedback: EvaluatorFeedback | null;
}

const EASE_OPTIONS: { value: EaseOfUse; label: string }[] = [
  { value: "very_difficult", label: "Very Difficult" },
  { value: "difficult",      label: "Difficult" },
  { value: "neutral",        label: "Neutral" },
  { value: "easy",           label: "Easy" },
  { value: "very_easy",      label: "Very Easy" },
];

export function FeedbackPageClient({ currentUserId, existingFeedback }: Props) {
  const supabase = createClient();

  const alreadySubmitted = !!(existingFeedback?.overall_rating);

  const [rating, setRating]       = useState<number>(existingFeedback?.overall_rating ?? 0);
  const [hovered, setHovered]     = useState<number>(0);
  const [ease, setEase]           = useState<EaseOfUse | "">(existingFeedback?.ease_of_use ?? "");
  const [comments, setComments]   = useState<string>(existingFeedback?.comments ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(alreadySubmitted);
  const [editing, setEditing]       = useState(false);

  // If editing, reset to existing values
  useEffect(() => {
    if (editing) {
      setRating(existingFeedback?.overall_rating ?? 0);
      setEase(existingFeedback?.ease_of_use ?? "");
      setComments(existingFeedback?.comments ?? "");
    }
  }, [editing, existingFeedback]);

  const canSubmit = rating > 0 && ease !== "";

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("evaluator_feedback")
        .upsert({
          evaluator_id:    currentUserId,
          overall_rating:  rating,
          ease_of_use:     ease,
          comments:        comments.trim() || null,
          submitted_at:    new Date().toISOString(),
          has_seen_prompt: true,
        }, { onConflict: "evaluator_id" });

      if (error) throw error;
      setSubmitted(true);
      setEditing(false);
    } catch (err) {
      console.error("Feedback submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bw-bg-secondary)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--bw-space-6) var(--bw-space-4)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "var(--bw-bg-primary)",
          borderRadius: "var(--bw-radius-lg)",
          border: "1px solid var(--bw-border)",
          boxShadow: "var(--bw-shadow-100)",
          overflow: "hidden",
        }}
      >
        {/* Brand bar */}
        <div
          style={{
            padding: "var(--bw-space-4) var(--bw-space-6)",
            borderBottom: "1px solid var(--bw-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--bw-space-3)" }}>
            <div
              style={{
                width: 24,
                height: 24,
                background: "var(--bw-bg-inverse)",
                borderRadius: "var(--bw-radius-sm)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--bw-content-inverse)",
                fontFamily: "var(--bw-font-heading)",
                fontWeight: "var(--bw-fw-bold)" as any,
                fontSize: "12px",
              }}
            >
              iS
            </div>
            <span
              style={{
                fontFamily: "var(--bw-font-heading)",
                fontWeight: "var(--bw-fw-bold)" as any,
                fontSize: "var(--bw-fs-sm)",
                color: "var(--bw-content-primary)",
              }}
            >
              hackX 11.0
            </span>
          </div>
          <Link
            href="/evaluator"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--bw-space-1)",
              fontSize: "var(--bw-fs-xs)",
              color: "var(--bw-content-tertiary)",
              textDecoration: "none",
            }}
          >
            <ArrowLeft size={12} />
            Dashboard
          </Link>
        </div>

        {/* Content */}
        <div style={{ padding: "var(--bw-space-8) var(--bw-space-6)" }}>
          {submitted && !editing ? (
            /* ── Already submitted / thank you ── */
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "var(--bw-space-4)",
                textAlign: "center",
                padding: "var(--bw-space-6) 0",
              }}
            >
              <CheckCircle
                size={48}
                style={{ color: "var(--bw-positive)" }}
                strokeWidth={1.5}
              />
              <div>
                <h1
                  style={{
                    fontFamily: "var(--bw-font-heading)",
                    fontSize: "var(--bw-fs-h4)",
                    fontWeight: "var(--bw-fw-bold)" as any,
                    color: "var(--bw-content-primary)",
                    letterSpacing: "-0.01em",
                    marginBottom: "var(--bw-space-3)",
                  }}
                >
                  Your feedback has been recorded.
                </h1>
                <p
                  style={{
                    fontSize: "var(--bw-fs-sm)",
                    color: "var(--bw-content-secondary)",
                    lineHeight: "var(--bw-lh-relaxed)",
                    maxWidth: 360,
                    margin: "0 auto",
                  }}
                >
                  Thank you for being part of hackX 11.0. We really appreciate it.
                </p>
              </div>

              {/* Show submitted rating */}
              {existingFeedback?.overall_rating && (
                <div
                  style={{
                    display: "flex",
                    gap: "var(--bw-space-1)",
                    marginTop: "var(--bw-space-2)",
                  }}
                >
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={20}
                      strokeWidth={1.5}
                      style={{
                        fill: s <= existingFeedback.overall_rating! ? "var(--bw-warning)" : "transparent",
                        stroke: s <= existingFeedback.overall_rating! ? "var(--bw-warning)" : "var(--bw-content-disabled)",
                      }}
                    />
                  ))}
                </div>
              )}

              <button
                onClick={() => setEditing(true)}
                style={{
                  marginTop: "var(--bw-space-4)",
                  background: "transparent",
                  border: "1px solid var(--bw-border)",
                  borderRadius: "var(--bw-radius-pill)",
                  padding: "10px 20px",
                  fontSize: "var(--bw-fs-sm)",
                  cursor: "pointer",
                  color: "var(--bw-content-secondary)",
                  fontFamily: "var(--bw-font-body)",
                  transition: "all var(--bw-duration-normal)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--bw-border-strong)";
                  e.currentTarget.style.color = "var(--bw-content-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--bw-border)";
                  e.currentTarget.style.color = "var(--bw-content-secondary)";
                }}
              >
                Edit my feedback
              </button>
            </div>
          ) : (
            /* ── Form ── */
            <>
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
                EVALUATOR FEEDBACK
              </p>
              <h1
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
                {editing ? "Edit your feedback." : "Thank you so much."}
              </h1>
              <p
                style={{
                  fontSize: "var(--bw-fs-sm)",
                  color: "var(--bw-content-secondary)",
                  lineHeight: "var(--bw-lh-relaxed)",
                  marginBottom: "var(--bw-space-6)",
                }}
              >
                {editing
                  ? "Update your thoughts below — every detail helps."
                  : "You made hackX 11.0 possible. We would love to hear your thoughts on the portal — what worked, what didn't, and anything we can do better. This means a lot to us and will directly shape how we build for hackX and the upcoming hackX."}
              </p>

              <div style={{ height: 1, background: "var(--bw-border)", marginBottom: "var(--bw-space-6)" }} />

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
                          size={32}
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
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--bw-space-2)" }}>
                  {EASE_OPTIONS.map((opt) => {
                    const selected = ease === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEase(opt.value)}
                        style={{
                          padding: "10px 18px",
                          borderRadius: "var(--bw-radius-pill)",
                          border: `1px solid ${selected ? "var(--bw-border-strong)" : "var(--bw-border)"}`,
                          background: selected ? "var(--bw-bg-inverse)" : "transparent",
                          color: selected ? "var(--bw-content-inverse)" : "var(--bw-content-primary)",
                          fontSize: "var(--bw-fs-sm)",
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
                  rows={4}
                  placeholder="Share your thoughts..."
                  className="bw-input"
                  style={{
                    resize: "vertical",
                    minHeight: 100,
                    fontFamily: "var(--bw-font-body)",
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--bw-space-4)" }}>
                {editing && (
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "var(--bw-fs-sm)",
                      color: "var(--bw-content-tertiary)",
                      padding: "10px 0",
                      fontFamily: "var(--bw-font-body)",
                    }}
                  >
                    Cancel
                  </button>
                )}
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
                    padding: "14px 32px",
                    fontSize: "var(--bw-fs-base)",
                    fontWeight: "var(--bw-fw-medium)" as any,
                    cursor: canSubmit ? "pointer" : "not-allowed",
                    transition: "all var(--bw-duration-normal) var(--bw-easing)",
                    fontFamily: "var(--bw-font-body)",
                    opacity: submitting ? 0.7 : 1,
                    marginLeft: editing ? 0 : "auto",
                    display: "block",
                  }}
                >
                  {submitting ? "Submitting..." : "Share My Thoughts"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
