"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const router = useRouter();
  const supabase = createClient();
  const emailRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in both fields.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success("Welcome back!");
    router.push("/");
    router.refresh();
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
        {/* Background image */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url(/loginimage.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        {/* Gradient overlay for readability */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)",
          }}
        />

        {/* Brand content over image */}
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
            Evaluation Portal
          </p>
        </div>
      </div>

      {/* ── Right panel — login form ── */}
      {/*
        Mobile  (<lg): takes full width, vertically centred, safe horizontal padding
        Tablet (sm–md): same layout, just slightly more padding
        Desktop (lg+): takes the remaining 50%
      */}
      <div
        style={{
          flex: "1 1 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          /* Safe padding: enough breathing room but never clips on small screens */
          padding: "clamp(24px, 6vw, 64px) clamp(20px, 5vw, 48px)",
          minHeight: "100dvh",
        }}
      >
        {/* Inner form container — full-width on mobile, capped on larger screens */}
        <div style={{ width: "100%", maxWidth: 400 }}>

          {/* ── Mobile / tablet brand badge (hidden on desktop) ── */}
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
              Evaluation Portal
            </p>
          </div>

          {/* ── Form heading ── */}
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
            Sign in
          </h2>
          <p
            style={{
              fontSize: "var(--bw-fs-sm)",
              color: "var(--bw-content-secondary)",
              marginBottom: "var(--bw-space-8)",
            }}
          >
            Enter your credentials to access the evaluation dashboard.
          </p>

          {/* ── Form ── */}
          <form
            onSubmit={handleLogin}
            style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-5)" }}
          >
            {/* Email */}
            <div>
              <label
                htmlFor="login-email"
                style={{
                  display: "block",
                  fontSize: "var(--bw-fs-sm)",
                  fontWeight: "var(--bw-fw-medium)" as any,
                  color: "var(--bw-content-primary)",
                  marginBottom: "var(--bw-space-2)",
                }}
              >
                Email
              </label>
              <input
                ref={emailRef}
                id="login-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bw-input"
                style={{ height: 48, fontSize: "16px" /* prevents iOS zoom */ }}
                required
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="login-password"
                style={{
                  display: "block",
                  fontSize: "var(--bw-fs-sm)",
                  fontWeight: "var(--bw-fw-medium)" as any,
                  color: "var(--bw-content-primary)",
                  marginBottom: "var(--bw-space-2)",
                }}
              >
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bw-input"
                  style={{ height: 48, fontSize: "16px", paddingRight: 48 /* room for eye icon */ }}
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 4,
                    color: "var(--bw-content-secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--bw-space-2)" }}>
                <Link href="/reset-password" style={{ fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-secondary)", textDecoration: "none", transition: "color 0.2s" }} onMouseOver={(e) => e.currentTarget.style.color = "var(--bw-content-primary)"} onMouseOut={(e) => e.currentTarget.style.color = "var(--bw-content-secondary)"}>
                  Forgot password?
                </Link>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="bw-button bw-button--primary"
              style={{
                width: "100%",
                height: 52,
                borderRadius: "var(--bw-radius-pill)",
                fontFamily: "var(--bw-font-body)",
                fontSize: "var(--bw-fs-base)",
                fontWeight: "var(--bw-fw-medium)" as any,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--bw-space-2)",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
                background: "var(--bw-bg-inverse)",
                color: "var(--bw-content-inverse)",
                border: "none",
                transition: "all var(--bw-duration-normal) var(--bw-easing)",
                marginTop: "var(--bw-space-2)",
              }}
            >
              {loading ? (
                <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <>
                  Sign in
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <p
            style={{
              marginTop: "var(--bw-space-8)",
              fontSize: "var(--bw-fs-xs)",
              color: "var(--bw-content-disabled)",
              textAlign: "center",
              lineHeight: "var(--bw-lh-relaxed)",
            }}
          >
            Credentials are provided by the event organizer.
            <br />
            Need help?{" "}
            <a
              href="https://wa.me/94762195995"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--bw-content-secondary)",
                textDecoration: "underline",
                textDecorationStyle: "dotted",
                cursor: "pointer",
              }}
            >
              Contact the team on WhatsApp
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
