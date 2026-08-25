"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function EvaluationLockedDialog({ open, onClose }: Props) {
  const WHATSAPP_NUMBER = "94762195995"; // +94762195995 without leading +

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        style={{
          maxWidth: 420,
          textAlign: "center",
          padding: "var(--bw-space-8) var(--bw-space-6)",
        }}
      >
        <DialogHeader>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--bw-space-4)",
            }}
          >
            {/* Lock icon with subtle amber glow */}
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "var(--bw-warning-bg)",
                border: "1px solid var(--bw-warning)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Lock size={28} style={{ color: "var(--bw-warning)" }} />
            </div>

            <DialogTitle
              style={{
                fontSize: "var(--bw-fs-h3)",
                fontFamily: "var(--bw-font-heading)",
                textAlign: "center",
              }}
            >
              Results Locked
            </DialogTitle>
          </div>
        </DialogHeader>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--bw-space-4)",
            padding: "var(--bw-space-2) 0 var(--bw-space-4)",
          }}
        >
          <p
            style={{
              fontSize: "var(--bw-fs-sm)",
              color: "var(--bw-content-secondary)",
              lineHeight: "var(--bw-lh-relaxed)",
              textAlign: "center",
              margin: 0,
            }}
          >
            The evaluation deadline has now passed and results have been locked.
            <br />
            <strong style={{ color: "var(--bw-content-primary)" }}>
              Thank you so much for your time and effort!
            </strong>{" "}
            Your contributions to hackX 11.0 are truly valued.
          </p>

          <p
            style={{
              fontSize: "var(--bw-fs-xs)",
              color: "var(--bw-content-tertiary)",
              lineHeight: "var(--bw-lh-relaxed)",
              textAlign: "center",
              margin: 0,
            }}
          >
            If a correction is needed or you have any questions, please contact
            the organising team.
          </p>

          {/* WhatsApp CTA */}
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ width: "100%", textDecoration: "none" }}
          >
            <Button
              variant="primary"
              size="lg"
              style={{ width: "100%", gap: 10 }}
            >
              {/* WhatsApp SVG logo */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Contact on WhatsApp
            </Button>
          </a>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            style={{
              color: "var(--bw-content-tertiary)",
              width: "100%",
            }}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
