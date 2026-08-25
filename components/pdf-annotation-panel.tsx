"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Maximize,
  Minimize,
  Send,
  X,
  MessageSquare,
  MessageSquarePlus,
  Trash2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import type { PdfAnnotation } from "@/lib/types/database";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const EVALUATOR_COLORS = [
  "#FFEB3B", "#81D4FA", "#A5D6A7", "#CE93D8",
  "#FFAB91", "#80CBC4", "#F48FB1", "#FFE082",
];

interface Props {
  proposalUrl: string;
  proposalId: string;
  evaluatorId: string;
  evaluatorName: string;
  annotations: PdfAnnotation[];
  isEditing?: boolean;
}

export function PdfAnnotationPanel({
  proposalUrl,
  proposalId,
  evaluatorId,
  evaluatorName,
  annotations: initialAnnotations,
  isEditing = true,
}: Props) {
  const supabase = createClient();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // Annotation state
  const [annotations, setAnnotations] = useState<PdfAnnotation[]>(initialAnnotations);
  const [showForm, setShowForm] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [saving, setSaving] = useState(false);
  const [activePage, setActivePage] = useState(1); // tracks currently visible page via IntersectionObserver

  const proxyUrl = `/api/proxy/pdf?url=${encodeURIComponent(proposalUrl)}`;

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPdfLoading(false);
    setPdfError(null);
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    setPdfError(error.message || "Failed to load PDF");
    setPdfLoading(false);
  }, []);

  // Zoom controls
  const zoomIn = () => setScale((s) => Math.min(3.0, s + 0.25));
  const zoomOut = () => setScale((s) => Math.max(0.5, s - 0.25));
  const fitWidth = useCallback(() => {
    const ref = viewportRef.current;
    if (ref) {
      const containerWidth = ref.clientWidth - 32;
      setScale(containerWidth / 612);
    }
  }, []);

  // Auto fit-width on mount
  useEffect(() => {
    if (!pdfLoading && numPages > 0) fitWidth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfLoading, numPages]);

  // Fullscreen API toggle — fullscreen the whole wrapper so side panel is included
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      wrapperRef.current?.requestFullscreen().catch((err) => {
        toast.error(`Fullscreen error: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // IntersectionObserver: track which page is most visible
  useEffect(() => {
    if (!viewportRef.current || numPages === 0) return;
    const pages = viewportRef.current.querySelectorAll("[data-page-number]");
    const observer = new IntersectionObserver(
      (entries) => {
        let best: Element | null = null;
        let bestRatio = 0;
        entries.forEach((e) => {
          if (e.intersectionRatio > bestRatio) {
            bestRatio = e.intersectionRatio;
            best = e.target;
          }
        });
        if (best) {
          const pn = parseInt((best as HTMLElement).dataset.pageNumber ?? "1");
          setActivePage(pn);
        }
      },
      { root: viewportRef.current, threshold: [0.1, 0.5, 0.9] }
    );
    pages.forEach((p) => observer.observe(p));
    return () => observer.disconnect();
  }, [numPages]);

  // Save annotation (page-level comment for activePage)
  const handleSaveAnnotation = async () => {
    if (!commentText.trim()) {
      toast.error("Please add a comment.");
      return;
    }
    setSaving(true);

    const newAnnotation = {
      proposal_id: proposalId,
      evaluator_id: evaluatorId,
      page_number: activePage,
      start_offset: 0,
      end_offset: 0,
      rect_x: 0,
      rect_y: 0,
      rect_width: 0,
      rect_height: 0,
      color: EVALUATOR_COLORS[0],
      comment: commentText.trim(),
    };

    const tempId = crypto.randomUUID();
    const optimistic: PdfAnnotation = {
      ...newAnnotation,
      id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setAnnotations((prev) => [...prev, optimistic]);

    const { data, error } = await supabase
      .from("pdf_annotations")
      .insert(newAnnotation)
      .select()
      .single();

    if (error) {
      setAnnotations((prev) => prev.filter((a) => a.id !== tempId));
      toast.error("Failed to save annotation.");
    } else {
      setAnnotations((prev) => prev.map((a) => (a.id === tempId ? data : a)));
      toast.success("Comment saved.");
    }
    setShowForm(false);
    setCommentText("");
    setSaving(false);
  };

  const handleDeleteAnnotation = async (id: string) => {
    const prev = annotations;
    setAnnotations((a) => a.filter((ann) => ann.id !== id));
    const { error } = await supabase.from("pdf_annotations").delete().eq("id", id);
    if (error) {
      setAnnotations(prev);
      toast.error("Failed to delete annotation.");
    } else {
      toast.success("Comment deleted.");
    }
  };

  // Color map
  const evaluatorColorMap = new Map<string, string>();
  [...new Set(annotations.map((a) => a.evaluator_id))].forEach((eid, idx) => {
    evaluatorColorMap.set(eid, EVALUATOR_COLORS[idx % EVALUATOR_COLORS.length]);
  });

  const CommentsPanel = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Comments header + add button */}
      <div style={{ padding: "var(--bw-space-2) var(--bw-space-3)", borderBottom: "1px solid var(--bw-border)", background: "var(--bw-bg-primary)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--bw-space-2)" }}>
        <span style={{ fontSize: "var(--bw-fs-xs)", fontWeight: "var(--bw-fw-medium)" as any, color: "var(--bw-content-secondary)" }}>
          {annotations.length} comment{annotations.length !== 1 ? "s" : ""}
        </span>
        {isEditing && (
          <Button variant="secondary" size="sm" onClick={() => setShowForm(true)} style={{ fontSize: 11 }}>
            <MessageSquarePlus size={12} style={{ marginRight: 4 }} />
            Comment p.{activePage}
          </Button>
        )}
      </div>

      {/* New comment form */}
      {showForm && (
        <div style={{ borderBottom: "1px solid var(--bw-border)", padding: "var(--bw-space-3)", background: "var(--bw-bg-primary)", display: "flex", flexDirection: "column", gap: "var(--bw-space-2)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--bw-space-2)" }}>
            <Badge variant="secondary" style={{ fontSize: "var(--bw-fs-xs)", padding: "2px 8px" }}>
              Page {activePage}
            </Badge>
          </div>
          <Textarea
            placeholder="Add your comment for this page..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            style={{ minHeight: 72, fontSize: "var(--bw-fs-sm)" }}
            autoFocus
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--bw-space-2)" }}>
            <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setCommentText(""); }}>
              <X size={13} style={{ marginRight: 4 }} />Cancel
            </Button>
            <Button size="sm" onClick={handleSaveAnnotation} disabled={saving || !commentText.trim()}>
              {saving ? <Loader2 size={13} style={{ marginRight: 4, animation: "spin 1s linear infinite" }} /> : <Send size={13} style={{ marginRight: 4 }} />}
              Save
            </Button>
          </div>
        </div>
      )}

      {/* Comments list */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {annotations.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 16px", color: "var(--bw-content-disabled)", gap: "var(--bw-space-2)", textAlign: "center" }}>
            <MessageSquare size={24} />
            <p style={{ fontSize: "var(--bw-fs-xs)" }}>No comments yet. Click a page and add one.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {[...annotations]
              .sort((a, b) => a.page_number - b.page_number)
              .map((ann, idx) => {
                const isOwn = ann.evaluator_id === evaluatorId;
                const color = evaluatorColorMap.get(ann.evaluator_id) || ann.color;
                return (
                  <div
                    key={ann.id}
                    style={{ padding: "10px var(--bw-space-3)", transition: "background var(--bw-duration-fast) var(--bw-easing)", borderTop: idx > 0 ? "1px solid var(--bw-border)" : "none" }}
                    className="hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--bw-space-2)" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--bw-space-2)", minWidth: 0, flex: 1 }}>
                        <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", borderRadius: 16, padding: "2px 8px", fontSize: 11, fontWeight: "var(--bw-fw-medium)" as any, background: "var(--bw-chip)", color: "var(--bw-content-primary)" }}>
                          p.{ann.page_number}
                        </span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, backgroundColor: color, display: "inline-block" }} />
                            <span style={{ fontSize: 11, color: "var(--bw-content-secondary)", fontWeight: "var(--bw-fw-medium)" as any, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {isOwn ? "You" : ann.evaluator_id.slice(0, 8)}
                            </span>
                          </div>
                          <p style={{ fontSize: "var(--bw-fs-sm)", lineHeight: "var(--bw-lh-relaxed)" }}>{ann.comment}</p>
                        </div>
                      </div>
                      {isOwn && isEditing && (
                        <Button variant="ghost" size="icon-xs" onClick={() => handleDeleteAnnotation(ann.id)} style={{ flexShrink: 0, marginTop: 2 }}>
                          <Trash2 size={12} style={{ color: "var(--bw-content-secondary)" }} />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );

  if (!proposalUrl) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 256, color: "var(--bw-content-disabled)", gap: "var(--bw-space-2)" }}>
        <MessageSquare size={32} />
        <p style={{ fontSize: "var(--bw-fs-sm)" }}>No proposal PDF link available.</p>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--bw-space-2)", padding: "var(--bw-space-2) var(--bw-space-3)", borderBottom: "1px solid var(--bw-border)", flexShrink: 0, flexWrap: "wrap", background: "var(--bw-bg-primary)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--bw-space-1)" }}>
          <span style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-secondary)", padding: "0 6px" }}>
            {numPages > 0 ? `${numPages} pages` : "—"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--bw-space-1)" }}>
          <Button variant="ghost" size="icon-sm" onClick={zoomOut}><ZoomOut size={16} /></Button>
          <span style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-secondary)", width: 40, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
            {Math.round(scale * 100)}%
          </span>
          <Button variant="ghost" size="icon-sm" onClick={zoomIn}><ZoomIn size={16} /></Button>
          <Button variant="ghost" size="icon-sm" onClick={fitWidth} title="Fit width"><Maximize2 size={16} /></Button>
          <Button variant="ghost" size="icon-sm" onClick={toggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </Button>
          {/* Open in new tab */}
          <a href={proposalUrl} target="_blank" rel="noopener noreferrer" title="Open PDF in new tab">
            <Button variant="ghost" size="icon-sm"><ExternalLink size={16} /></Button>
          </a>
        </div>
      </div>

      {/* Main area: PDF viewport + side comments panel */}
      <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
        {/* PDF Infinite-scroll viewport */}
        <div
          ref={viewportRef}
          style={{ flex: 1, overflowY: "auto", overflowX: "auto", backgroundColor: "var(--bw-bg-primary)", padding: "16px 0" }}
        >
          {pdfLoading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 256 }}>
              <Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: "var(--bw-content-disabled)" }} />
            </div>
          )}
          {pdfError && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 256, color: "var(--bw-content-disabled)", gap: "var(--bw-space-2)" }}>
              <p style={{ fontSize: "var(--bw-fs-sm)" }}>Failed to load PDF</p>
              <p style={{ fontSize: "var(--bw-fs-xs)" }}>{pdfError}</p>
              <Button variant="secondary" size="sm" onClick={() => { setPdfError(null); setPdfLoading(true); setRetryKey((k) => k + 1); }}>Retry</Button>
            </div>
          )}
          <Document
            key={retryKey}
            file={proxyUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={null}
          >
            {numPages > 0 &&
              Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                <div
                  key={pageNum}
                  data-page-number={pageNum}
                  style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}
                >
                  <Page
                    pageNumber={pageNum}
                    scale={scale}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </div>
              ))}
          </Document>
        </div>

        {/* Comments side panel (always visible, fixed width) */}
        <div style={{ width: 240, borderLeft: "1px solid var(--bw-border)", background: "var(--bw-bg-primary)", flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {CommentsPanel}
        </div>
      </div>
    </div>
  );
}
