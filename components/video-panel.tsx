"use client";

import { useState, useCallback, useRef } from "react";
import YouTube from "react-youtube";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Send,
  Trash2,
  Loader2,
  Play,
  Video,
  MessageSquarePlus,
  X,
  ExternalLink,
} from "lucide-react";
import type { VideoComment } from "@/lib/types/database";

const EVALUATOR_COLORS = [
  "#FFEB3B", "#81D4FA", "#A5D6A7", "#CE93D8",
  "#FFAB91", "#80CBC4", "#F48FB1", "#FFE082",
];

interface Props {
  videoUrl: string;
  proposalId: string;
  evaluatorId: string;
  evaluatorName: string;
  comments: VideoComment[];
  isEditing?: boolean;
}

function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([^&\s?#]+)/
  );
  return match?.[1] ?? null;
}

function formatTimestamp(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VideoPanel({
  videoUrl,
  proposalId,
  evaluatorId,
  evaluatorName,
  comments: initialComments,
  isEditing = true,
}: Props) {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const [comments, setComments] = useState<VideoComment[]>(initialComments);
  const [showForm, setShowForm] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [capturedTimestamp, setCapturedTimestamp] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const videoId = getYouTubeId(videoUrl);

  const evaluatorColorMap = new Map<string, string>();
  [...new Set(comments.map((c) => c.evaluator_id))].forEach((eid, idx) => {
    evaluatorColorMap.set(eid, EVALUATOR_COLORS[idx % EVALUATOR_COLORS.length]);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onReady = useCallback((event: any) => {
    playerRef.current = event.target;
  }, []);

  const handleAddTimestamp = () => {
    let ts = 0;
    if (playerRef.current?.getCurrentTime) {
      ts = playerRef.current.getCurrentTime();
    }
    setCapturedTimestamp(ts);
    setShowForm(true);
    setCommentText("");
  };

  const handleSeek = (secs: number) => {
    if (playerRef.current?.seekTo) {
      playerRef.current.seekTo(secs, true);
      playerRef.current.playVideo?.();
    }
  };

  const handleSave = async () => {
    if (!commentText.trim()) {
      toast.error("Please enter a comment.");
      return;
    }
    setSaving(true);
    const newComment = {
      proposal_id: proposalId,
      evaluator_id: evaluatorId,
      timestamp_secs: capturedTimestamp,
      comment: commentText.trim(),
    };
    const tempId = crypto.randomUUID();
    const optimistic: VideoComment = {
      ...newComment,
      id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setComments((prev) =>
      [...prev, optimistic].sort((a, b) => a.timestamp_secs - b.timestamp_secs)
    );
    const { data, error } = await supabase
      .from("video_comments")
      .insert(newComment)
      .select()
      .single();
    if (error) {
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      toast.error("Failed to save comment.");
    } else {
      setComments((prev) =>
        prev
          .map((c) => (c.id === tempId ? data : c))
          .sort((a, b) => a.timestamp_secs - b.timestamp_secs)
      );
      toast.success("Comment saved.");
    }
    setShowForm(false);
    setCommentText("");
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const prev = comments;
    setComments((c) => c.filter((comment) => comment.id !== id));
    const { error } = await supabase.from("video_comments").delete().eq("id", id);
    if (error) {
      setComments(prev);
      toast.error("Failed to delete comment.");
    } else {
      toast.success("Comment deleted.");
    }
  };

  if (!videoUrl || !videoId) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 256, color: "var(--bw-content-disabled)", gap: "var(--bw-space-2)" }}>
        <Video size={32} />
        <p style={{ fontSize: "var(--bw-fs-sm)" }}>No pitch video link available.</p>
        {videoUrl && !videoId && (
          <p style={{ fontSize: "var(--bw-fs-xs)" }}>URL does not appear to be a YouTube video.</p>
        )}
      </div>
    );
  }

  // Side panel for comments
  const CommentsPanel = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Header + add button */}
      <div style={{ padding: "var(--bw-space-2) var(--bw-space-3)", borderBottom: "1px solid var(--bw-border)", background: "var(--bw-bg-primary)", flexShrink: 0, display: "flex", flexDirection: "column", gap: "var(--bw-space-2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Badge variant="secondary" style={{ fontSize: "var(--bw-fs-xs)", gap: 4, display: "flex", alignItems: "center" }}>
            <Clock size={12} />
            {comments.length} comment{comments.length !== 1 ? "s" : ""}
          </Badge>
          <a href={videoUrl} target="_blank" rel="noopener noreferrer" title="Open video in new tab">
            <Button variant="ghost" size="icon-xs"><ExternalLink size={14} /></Button>
          </a>
        </div>
        {isEditing && (
          <Button variant="secondary" size="sm" onClick={handleAddTimestamp} style={{ width: "100%", fontSize: 11 }}>
            <MessageSquarePlus size={12} style={{ marginRight: 4 }} />
            Add Comment
          </Button>
        )}
      </div>

      {/* New comment form */}
      {showForm && (
        <div style={{ borderBottom: "1px solid var(--bw-border)", padding: "var(--bw-space-3)", background: "var(--bw-bg-primary)", display: "flex", flexDirection: "column", gap: "var(--bw-space-2)", flexShrink: 0 }}>
          <Badge
            variant="secondary"
            style={{ fontSize: "var(--bw-fs-xs)", cursor: "pointer", display: "inline-flex", alignItems: "center", width: "fit-content" }}
            onClick={() => handleSeek(capturedTimestamp)}
          >
            <Play size={10} style={{ marginRight: 2 }} />
            {formatTimestamp(capturedTimestamp)}
          </Badge>
          <Textarea
            placeholder="What do you think about this moment?"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            style={{ minHeight: 60, fontSize: "var(--bw-fs-sm)" }}
            autoFocus
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--bw-space-2)" }}>
            <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setCommentText(""); }}>
              <X size={13} style={{ marginRight: 4 }} />Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !commentText.trim()}>
              {saving ? <Loader2 size={13} style={{ marginRight: 4, animation: "spin 1s linear infinite" }} /> : <Send size={13} style={{ marginRight: 4 }} />}
              Save
            </Button>
          </div>
        </div>
      )}

      {/* Comments list */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {comments.length === 0 && !showForm ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 16px", color: "var(--bw-content-disabled)", gap: "var(--bw-space-2)", textAlign: "center" }}>
            <MessageSquarePlus size={24} />
            <p style={{ fontSize: "var(--bw-fs-xs)" }}>No comments yet.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {comments.map((comment, idx) => {
              const isOwn = comment.evaluator_id === evaluatorId;
              const color = evaluatorColorMap.get(comment.evaluator_id) || EVALUATOR_COLORS[0];
              return (
                <div key={comment.id} style={{ padding: "10px var(--bw-space-3)", transition: "background var(--bw-duration-fast) var(--bw-easing)", borderTop: idx > 0 ? "1px solid var(--bw-border)" : "none" }} className="hover:bg-black/5 dark:hover:bg-white/5">
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--bw-space-2)" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--bw-space-2)", minWidth: 0, flex: 1 }}>
                      <button
                        style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, borderRadius: 16, padding: "2px 8px", fontSize: 11, fontWeight: "var(--bw-fw-medium)" as any, fontVariantNumeric: "tabular-nums", background: "var(--bw-chip)", border: "none", cursor: "pointer", color: "var(--bw-content-primary)" }}
                        onClick={() => handleSeek(comment.timestamp_secs)}
                        title="Jump to this moment"
                        className="hover:bg-black/10 dark:hover:bg-white/10"
                      >
                        <Play size={10} />
                        {formatTimestamp(comment.timestamp_secs)}
                      </button>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, backgroundColor: color, display: "inline-block" }} />
                          <span style={{ fontSize: 11, color: "var(--bw-content-secondary)", fontWeight: "var(--bw-fw-medium)" as any, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {isOwn ? "You" : comment.evaluator_id.slice(0, 8)}
                          </span>
                        </div>
                        <p style={{ fontSize: "var(--bw-fs-sm)", lineHeight: "var(--bw-lh-relaxed)" }}>{comment.comment}</p>
                      </div>
                    </div>
                    {isOwn && isEditing && (
                      <Button variant="ghost" size="icon-xs" onClick={() => handleDelete(comment.id)} style={{ flexShrink: 0, marginTop: 2 }}>
                        <Trash2 size={12} style={{ color: "var(--bw-content-secondary)" }} />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={commentsEndRef} />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Main area: Video + side comments panel */}
      <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
        {/* Video column */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {/* YouTube Player */}
          <div style={{ position: "relative", width: "100%", background: "black", flexShrink: 0 }}>
            <div style={{ aspectRatio: "16 / 9", width: "100%" }}>
              <YouTube
                videoId={videoId}
                onReady={onReady}
                opts={{
                  width: "100%",
                  height: "100%",
                  playerVars: { modestbranding: 1, rel: 0 },
                }}
                className="w-full h-full"
                iframeClassName="w-full h-full"
              />
            </div>
          </div>
        </div>

        {/* Comments side panel */}
        <div style={{ width: 240, borderLeft: "1px solid var(--bw-border)", background: "var(--bw-bg-primary)", flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {CommentsPanel}
        </div>
      </div>
    </div>
  );
}
