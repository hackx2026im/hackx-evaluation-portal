"use client";

import { useMemo, useState } from "react";
import { Star, MessageSquare, Users, TrendingUp, Filter } from "lucide-react";
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
import type { EvaluatorFeedback } from "@/lib/types/database";

interface ProfileRow {
  id: string;
  full_name: string;
}

interface Props {
  feedbackRows: EvaluatorFeedback[];
  evaluators: ProfileRow[];
}

const EASE_LABELS: Record<string, string> = {
  very_difficult: "Very Difficult",
  difficult:      "Difficult",
  neutral:        "Neutral",
  easy:           "Easy",
  very_easy:      "Very Easy",
};

const EASE_VARIANTS: Record<string, "negative" | "warning" | "secondary" | "accent" | "positive"> = {
  very_difficult: "negative",
  difficult:      "warning",
  neutral:        "secondary",
  easy:           "accent",
  very_easy:      "positive",
};

function StarDisplay({ rating }: { rating: number | null }) {
  if (!rating) return <span style={{ color: "var(--bw-content-disabled)", fontSize: "var(--bw-fs-xs)", fontStyle: "italic" }}>—</span>;
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={14}
          strokeWidth={1.5}
          style={{
            fill: s <= rating ? "var(--bw-warning)" : "transparent",
            stroke: s <= rating ? "var(--bw-warning)" : "var(--bw-border)",
          }}
        />
      ))}
    </div>
  );
}

function EaseDistributionBar({ rows }: { rows: EvaluatorFeedback[] }) {
  const submitted = rows.filter(r => r.ease_of_use);
  if (submitted.length === 0) return null;

  const counts: Record<string, number> = {
    very_easy: 0, easy: 0, neutral: 0, difficult: 0, very_difficult: 0,
  };
  submitted.forEach(r => { if (r.ease_of_use) counts[r.ease_of_use]++; });

  const colorMap: Record<string, string> = {
    very_difficult: "var(--bw-negative)",
    difficult:      "var(--bw-warning)",
    neutral:        "var(--bw-content-disabled)",
    easy:           "var(--bw-accent)",
    very_easy:      "var(--bw-positive)",
  };

  const order = ["very_easy", "easy", "neutral", "difficult", "very_difficult"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-3)" }}>
      {order.map(key => {
        const count = counts[key];
        const pct = submitted.length > 0 ? Math.round((count / submitted.length) * 100) : 0;
        return (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: "var(--bw-space-3)" }}>
            <div style={{ width: 80, fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-secondary)", flexShrink: 0 }}>
              {EASE_LABELS[key]}
            </div>
            <div style={{ flex: 1, height: 6, background: "var(--bw-bg-tertiary)", borderRadius: "var(--bw-radius-pill)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: colorMap[key],
                  borderRadius: "var(--bw-radius-pill)",
                  transition: "width 0.5s ease",
                }}
              />
            </div>
            <div style={{ width: 28, fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-tertiary)", textAlign: "right", flexShrink: 0 }}>
              {count}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AdminFeedbackClient({ feedbackRows, evaluators }: Props) {
  const [search, setSearch] = useState("");

  const evaluatorMap = useMemo(
    () => new Map(evaluators.map(e => [e.id, e.full_name])),
    [evaluators]
  );

  // Only rows that have actually submitted feedback (rating is set)
  const submitted = useMemo(
    () => feedbackRows.filter(r => r.overall_rating !== null),
    [feedbackRows]
  );

  const avgRating = useMemo(() => {
    if (submitted.length === 0) return null;
    const sum = submitted.reduce((acc, r) => acc + (r.overall_rating ?? 0), 0);
    return (sum / submitted.length).toFixed(1);
  }, [submitted]);

  const responseRate = useMemo(() => {
    if (evaluators.length === 0) return 0;
    return Math.round((submitted.length / evaluators.length) * 100);
  }, [submitted.length, evaluators.length]);

  const filteredRows = useMemo(() => {
    if (!search) return submitted;
    const q = search.toLowerCase();
    return submitted.filter(r => {
      const name = evaluatorMap.get(r.evaluator_id) ?? "";
      return (
        name.toLowerCase().includes(q) ||
        (r.comments ?? "").toLowerCase().includes(q) ||
        (r.ease_of_use ?? "").includes(q)
      );
    });
  }, [submitted, search, evaluatorMap]);

  // Summary stats
  const stats = [
    {
      label: "Responses",
      value: submitted.length,
      sub: `of ${evaluators.length} evaluators`,
      icon: MessageSquare,
    },
    {
      label: "Response Rate",
      value: `${responseRate}%`,
      sub: "participation",
      icon: Users,
    },
    {
      label: "Avg Rating",
      value: avgRating ? `${avgRating} / 5` : "—",
      sub: "overall experience",
      icon: TrendingUp,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-6)" }}>
      {/* Page heading */}
      <div>
        <h2
          style={{
            fontFamily: "var(--bw-font-heading)",
            fontSize: "var(--bw-fs-h1-fluid)",
            fontWeight: "var(--bw-fw-bold)" as any,
            lineHeight: "var(--bw-lh-tight)",
          }}
        >
          Evaluator Feedback
        </h2>
        <p style={{ marginTop: "var(--bw-space-2)", fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-secondary)" }}>
          Post-evaluation feedback from hackX 11.0 evaluators
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-6 sm:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} variant="flat">
              <CardHeader style={{ padding: "var(--bw-space-5) var(--bw-space-5) var(--bw-space-2)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "var(--bw-fs-xs)", fontWeight: "var(--bw-fw-medium)" as any, color: "var(--bw-content-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {stat.label}
                  </span>
                  <Icon size={14} style={{ color: "var(--bw-content-disabled)" }} />
                </div>
              </CardHeader>
              <CardContent style={{ padding: "var(--bw-space-2) var(--bw-space-5) var(--bw-space-5)" }}>
                <div style={{ fontSize: "var(--bw-fs-h2)", fontWeight: "var(--bw-fw-bold)" as any }}>{stat.value}</div>
                <div style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-tertiary)", marginTop: "var(--bw-space-1)" }}>{stat.sub}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Split: table + ease distribution */}
      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        {/* Responses Table */}
        <Card variant="flat" style={{ display: "flex", flexDirection: "column" }}>
          <CardHeader style={{ padding: "var(--bw-space-6)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "var(--bw-space-4)" }}>
              <CardTitle style={{ fontSize: "var(--bw-fs-h4)" }}>
                Individual Responses
              </CardTitle>
              <div style={{ position: "relative", width: "100%", maxWidth: 260 }}>
                <Filter size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--bw-content-disabled)", pointerEvents: "none" }} />
                <Input
                  type="search"
                  placeholder="Search evaluator or comment..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: 32 }}
                  pill
                />
              </div>
            </div>
          </CardHeader>
          <CardContent style={{ padding: "0 var(--bw-space-6) var(--bw-space-6)" }}>
            <div style={{ overflowX: "auto", margin: "0 calc(var(--bw-space-6) * -1)" }}>
              <Table style={{ minWidth: 640 }}>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ paddingLeft: "var(--bw-space-6)" }}>Evaluator</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Ease of Use</TableHead>
                    <TableHead>Comments</TableHead>
                    <TableHead style={{ textAlign: "right", paddingRight: "var(--bw-space-6)" }}>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} style={{ height: 96, textAlign: "center", color: "var(--bw-content-disabled)" }}>
                        {submitted.length === 0
                          ? "No feedback submitted yet."
                          : "No matching responses."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((row) => {
                      const name = evaluatorMap.get(row.evaluator_id) ?? "Unknown Evaluator";
                      const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                      const submittedDate = new Date(row.submitted_at).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                      });

                      return (
                        <TableRow key={row.id}>
                          <TableCell style={{ paddingLeft: "var(--bw-space-6)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "var(--bw-space-3)" }}>
                              <div
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: "50%",
                                  background: "var(--bw-bg-inverse)",
                                  color: "var(--bw-content-inverse)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "var(--bw-fs-xs)",
                                  fontWeight: "var(--bw-fw-medium)" as any,
                                  flexShrink: 0,
                                }}
                              >
                                {initials}
                              </div>
                              <span style={{ fontSize: "var(--bw-fs-sm)", fontWeight: "var(--bw-fw-medium)" as any }}>
                                {name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <StarDisplay rating={row.overall_rating} />
                          </TableCell>
                          <TableCell>
                            {row.ease_of_use ? (
                              <Badge variant={EASE_VARIANTS[row.ease_of_use]}>
                                {EASE_LABELS[row.ease_of_use]}
                              </Badge>
                            ) : (
                              <span style={{ color: "var(--bw-content-disabled)", fontSize: "var(--bw-fs-xs)", fontStyle: "italic" }}>—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.comments ? (
                              <p
                                style={{
                                  fontSize: "var(--bw-fs-xs)",
                                  color: "var(--bw-content-secondary)",
                                  maxWidth: 260,
                                  overflow: "hidden",
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical" as any,
                                  fontStyle: "italic",
                                  margin: 0,
                                }}
                              >
                                "{row.comments}"
                              </p>
                            ) : (
                              <span style={{ color: "var(--bw-content-disabled)", fontSize: "var(--bw-fs-xs)", fontStyle: "italic" }}>No comment</span>
                            )}
                          </TableCell>
                          <TableCell style={{ textAlign: "right", paddingRight: "var(--bw-space-6)", color: "var(--bw-content-tertiary)", fontSize: "var(--bw-fs-xs)", whiteSpace: "nowrap" }}>
                            {submittedDate}
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

        {/* Ease of Use Distribution */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-6)" }}>
          <Card variant="flat">
            <CardHeader style={{ padding: "var(--bw-space-6) var(--bw-space-6) var(--bw-space-4)" }}>
              <CardTitle style={{ fontSize: "var(--bw-fs-base)" }}>Ease of Use</CardTitle>
              <p style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-tertiary)", marginTop: "var(--bw-space-1)" }}>
                How easy was the portal to use?
              </p>
            </CardHeader>
            <CardContent style={{ padding: "0 var(--bw-space-6) var(--bw-space-6)" }}>
              {submitted.length === 0 ? (
                <p style={{ fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-disabled)", textAlign: "center", padding: "var(--bw-space-6) 0" }}>
                  No responses yet.
                </p>
              ) : (
                <EaseDistributionBar rows={submitted} />
              )}
            </CardContent>
          </Card>

          {/* Average star display */}
          {avgRating && (
            <Card variant="flat">
              <CardContent style={{ padding: "var(--bw-space-6)", textAlign: "center" }}>
                <p style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--bw-space-3)" }}>
                  Average Rating
                </p>
                <div
                  style={{
                    fontSize: "3rem",
                    fontWeight: "var(--bw-fw-bold)" as any,
                    fontFamily: "var(--bw-font-heading)",
                    lineHeight: 1,
                    letterSpacing: "-0.03em",
                    color: "var(--bw-content-primary)",
                    marginBottom: "var(--bw-space-3)",
                  }}
                >
                  {avgRating}
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: "var(--bw-space-2)" }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star
                      key={s}
                      size={18}
                      strokeWidth={1.5}
                      style={{
                        fill: s <= Math.round(parseFloat(avgRating)) ? "var(--bw-warning)" : "transparent",
                        stroke: s <= Math.round(parseFloat(avgRating)) ? "var(--bw-warning)" : "var(--bw-border)",
                      }}
                    />
                  ))}
                </div>
                <p style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-tertiary)" }}>
                  from {submitted.length} {submitted.length === 1 ? "response" : "responses"}
                </p>
              </CardContent>
            </Card>
          )}

          {/* No-feedback list */}
          {evaluators.length > submitted.length && (
            <Card variant="flat">
              <CardHeader style={{ padding: "var(--bw-space-5) var(--bw-space-5) var(--bw-space-3)" }}>
                <CardTitle style={{ fontSize: "var(--bw-fs-sm)" }}>Pending Feedback</CardTitle>
              </CardHeader>
              <CardContent style={{ padding: "0 var(--bw-space-5) var(--bw-space-5)" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-2)" }}>
                  {evaluators
                    .filter(e => !submitted.some(r => r.evaluator_id === e.id))
                    .map(e => (
                      <div
                        key={e.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--bw-space-2)",
                          padding: "var(--bw-space-2) var(--bw-space-3)",
                          borderRadius: "var(--bw-radius-sm)",
                          border: "1px dashed var(--bw-border)",
                        }}
                      >
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            background: "var(--bw-chip)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "var(--bw-fs-xs)",
                            color: "var(--bw-content-tertiary)",
                            flexShrink: 0,
                          }}
                        >
                          {e.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                        <span style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-secondary)" }}>
                          {e.full_name}
                        </span>
                        <Badge variant="secondary" style={{ marginLeft: "auto", fontSize: "var(--bw-fs-xs)", padding: "0 6px", height: 18 }}>
                          Pending
                        </Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
