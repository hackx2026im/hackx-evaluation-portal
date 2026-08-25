"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Upload,
  ClipboardList,
  Menu,
  X,
  Settings,
  MessageSquare,
  BookOpen,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/evaluators", label: "Evaluators", icon: Users },
  { href: "/admin/proposals", label: "Proposals", icon: Upload },
  { href: "/admin/assignments", label: "Assignments", icon: ClipboardList },
  { href: "/admin/rubric", label: "Rubric", icon: BookOpen },
  { href: "/admin/feedback", label: "Feedback", icon: MessageSquare },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

/* The drawer lives next to <main>, but its toggle belongs at the top of the
   page content — so the open state is shared through context rather than
   being local to <Sidebar>. */
const SidebarContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({ open: false, setOpen: () => {} });

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const value = React.useMemo(() => ({ open, setOpen }), [open]);
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

/* Circular menu toggle — mobile/tablet only (DESIGN.md §8). */
export function SidebarTrigger() {
  const { setOpen } = React.useContext(SidebarContext);

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Open navigation"
      className="lg:hidden bw-button--ghost"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 40,
        height: 40,
        flexShrink: 0,
        borderRadius: "var(--bw-radius-circle)",
        border: "1px solid var(--bw-border)",
        background: "var(--bw-bg-primary)",
        color: "var(--bw-content-primary)",
        cursor: "pointer",
        transition: "background var(--bw-duration-normal) var(--bw-easing)",
      }}
    >
      <Menu size={18} />
    </button>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { open, setOpen } = React.useContext(SidebarContext);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  // Close the drawer whenever the route changes.
  React.useEffect(() => {
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Dismiss on Escape and lock body scroll while the drawer is open.
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, setOpen]);

  const navContent = (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--bw-space-1)" }}>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--bw-space-3)",
                padding: "10px 16px",
                borderRadius: "var(--bw-radius-md)",
                fontSize: "var(--bw-fs-sm)",
                fontWeight: active ? ("var(--bw-fw-medium)" as any) : ("var(--bw-fw-regular)" as any),
                color: active ? "var(--bw-content-inverse)" : "var(--bw-content-primary)",
                background: active ? "var(--bw-bg-inverse)" : "transparent",
                transition: "all var(--bw-duration-normal) var(--bw-easing)",
                textDecoration: "none",
              }}
              className={active ? "" : "bw-button--ghost"}
            >
              <Icon size={18} style={{ flexShrink: 0 }} />
              <span>{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: "var(--bw-fs-xs)",
    fontWeight: "var(--bw-fw-medium)" as any,
    color: "var(--bw-content-disabled)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:block"
        style={{
          width: 240,
          flexShrink: 0,
          padding: "var(--bw-space-4) var(--bw-space-3)",
          borderRight: "1px solid var(--bw-border)",
          background: "var(--bw-bg-primary)",
          minHeight: "calc(100vh - var(--bw-nav-height))",
        }}
      >
        <div style={{ ...sectionLabelStyle, padding: "0 16px", marginBottom: "var(--bw-space-3)" }}>
          Admin Panel
        </div>
        {navContent}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <>
          <div className="bw-overlay lg:hidden" onClick={() => setOpen(false)} />
          <div
            className="lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              bottom: 0,
              width: "min(280px, 80vw)",
              background: "var(--bw-bg-primary)",
              zIndex: 101,
              padding: "var(--bw-space-6) var(--bw-space-4)",
              animation: "bw-slide-in-left var(--bw-duration-normal) var(--bw-easing)",
              borderRight: "1px solid var(--bw-border)",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "var(--bw-space-6)",
              }}
            >
              <span style={sectionLabelStyle}>Admin Panel</span>
              <button
                onClick={() => setOpen(false)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: "var(--bw-radius-circle)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--bw-content-tertiary)",
                }}
                className="bw-button--ghost"
                aria-label="Close navigation"
              >
                <X size={18} />
              </button>
            </div>
            {navContent}
          </div>
        </>
      )}
    </>
  );
}
