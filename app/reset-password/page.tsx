"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { PasswordChangeForm } from "@/components/password-change-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function ResetPasswordPage() {
  const [initializing, setInitializing] = React.useState(true);
  const [hasSession, setHasSession] = React.useState(false);
  const router = useRouter();
  const supabase = createClient();

  React.useEffect(() => {
    const init = async () => {
      // ── Path 1: PKCE flow — Supabase sends ?code=xxx ──
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          setHasSession(true);
          setInitializing(false);
          return;
        }
        console.error("PKCE exchange failed:", error.message);
      }

      // ── Path 2: Implicit/OTP flow — Supabase appends #access_token=xxx ──
      // Parse the hash fragment directly instead of relying on SDK auto-detection timing.
      const hash = window.location.hash;
      if (hash) {
        const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type");

        if (accessToken && refreshToken && type === "recovery") {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!error) {
            setHasSession(true);
            setInitializing(false);
            return;
          }
          console.error("setSession failed:", error.message);
        }
      }

      // ── Path 3: Session already exists (e.g. SDK already processed URL) ──
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setHasSession(true);
        setInitializing(false);
        return;
      }

      // ── Nothing worked ──
      setHasSession(false);
      setInitializing(false);
      toast.error("This password reset link is invalid or has expired.");
    };

    init();
  }, [supabase]);

  const handleSuccess = () => {
    toast.success("Password reset complete. Please sign in with your new password.");
    setTimeout(() => {
      router.push("/login");
    }, 2000);
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        background: "var(--bw-bg-primary)",
      }}
    >
      {/* ── Left panel — hero image + brand (desktop lg+ only) ── */}
      <div
        className="hidden lg:flex"
        style={{
          flex: "0 0 50%",
          background: "var(--bw-bg-inverse)",
          position: "relative",
          overflow: "hidden",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "var(--bw-space-12)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url(/loginimage.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)",
          }}
        />

        <div style={{ position: "relative", zIndex: 1 }}>
          <img
            src="/hackxlogo.webp"
            alt="hackX Logo"
            style={{ height: "120px", width: "auto", marginBottom: "var(--bw-space-4)" }}
          />
          <p
            style={{
              fontSize: "var(--bw-fs-lg)",
              color: "rgba(255, 255, 255, 0.75)",
              lineHeight: "var(--bw-lh-body)",
              maxWidth: 400,
            }}
          >
            Evaluation portal for the lecture panel.
            <br />
            Reset your password to regain access to your dashboard.
          </p>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div
        style={{
          flex: "1 1 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "clamp(24px, 6vw, 64px) clamp(20px, 5vw, 48px)",
          minHeight: "100dvh",
        }}
      >
        <div style={{ width: "100%", maxWidth: 400 }}>
          {/* Mobile / tablet brand badge (hidden on desktop) */}
          <div
            className="lg:hidden"
            style={{ marginBottom: "var(--bw-space-10)", textAlign: "center" }}
          >
            <img
              src="/hackxlogo.webp"
              alt="hackX Logo"
              style={{ height: "96px", width: "auto", marginBottom: "var(--bw-space-3)", display: "inline-block" }}
            />
            <p
              style={{
                marginTop: "var(--bw-space-2)",
                fontSize: "var(--bw-fs-sm)",
                color: "var(--bw-content-secondary)",
              }}
            >
              Evaluation portal for the lecture panel.
            </p>
          </div>

          {initializing ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <Loader2 size={32} className="animate-spin text-bw-content-tertiary" />
              <p style={{ color: "var(--bw-content-secondary)", fontSize: "var(--bw-fs-sm)" }}>
                Validating security token...
              </p>
            </div>
          ) : hasSession ? (
            <>
              <h2
                style={{
                  fontFamily: "var(--bw-font-heading)",
                  fontSize: "var(--bw-fs-h3)",
                  fontWeight: "var(--bw-fw-bold)" as any,
                  lineHeight: "var(--bw-lh-heading)",
                  color: "var(--bw-content-primary)",
                  marginBottom: "var(--bw-space-2)",
                }}
              >
                Set new password
              </h2>
              <p
                style={{
                  fontSize: "var(--bw-fs-sm)",
                  color: "var(--bw-content-secondary)",
                  marginBottom: "var(--bw-space-8)",
                }}
              >
                Please choose a secure password that you haven&apos;t used before.
              </p>

              <PasswordChangeForm
                showSkip={false}
                onSuccess={handleSuccess}
              />
            </>
          ) : (
            <div className="text-center">
              <p style={{ color: "var(--bw-negative)", marginBottom: "var(--bw-space-4)" }}>
                Authentication failed or link expired.
              </p>
              <button
                onClick={() => router.push("/login")}
                className="bw-button"
                style={{
                  padding: "10px 20px",
                  borderRadius: "var(--bw-radius-pill)",
                  background: "var(--bw-bg-inverse)",
                  color: "var(--bw-content-inverse)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Return to Login
              </button>
            </div>
          )}

          <p
            style={{
              marginTop: "var(--bw-space-8)",
              fontSize: "var(--bw-fs-xs)",
              color: "var(--bw-content-disabled)",
              textAlign: "center",
              lineHeight: "var(--bw-lh-relaxed)",
            }}
          >
            Secured by Supabase Authentication.
            <br />
            Always ensure you are on the official hackX portal.
          </p>
        </div>
      </div>
    </div>
  );
}
