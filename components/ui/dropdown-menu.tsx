"use client";

import * as React from "react";

/* ═══════════════════════════════════════════════════════════
   Dropdown Menu — Base Web Style
   Lightweight menu for grouping secondary actions under one
   trigger (e.g. export/download options) to keep toolbars calm.
   ═══════════════════════════════════════════════════════════ */

interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenuContext(component: string) {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx) throw new Error(`${component} must be used within a DropdownMenu`);
  return ctx;
}

function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const value = React.useMemo(() => ({ open, setOpen, triggerRef }), [open]);
  return (
    <DropdownMenuContext.Provider value={value}>
      {/* Positioning context for the absolutely-placed content panel */}
      <div style={{ position: "relative", display: "inline-block" }}>{children}</div>
    </DropdownMenuContext.Provider>
  );
}

function DropdownMenuTrigger({ children }: { children: React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }> }) {
  const { open, setOpen, triggerRef } = useDropdownMenuContext("DropdownMenuTrigger");
  return React.cloneElement(children, {
    ref: triggerRef,
    onClick: (e: React.MouseEvent) => {
      children.props.onClick?.(e);
      setOpen(!open);
    },
    "aria-expanded": open,
    "aria-haspopup": "menu",
  } as any);
}

function DropdownMenuContent({
  children,
  align = "end",
  style,
}: {
  children: React.ReactNode;
  align?: "start" | "end";
  style?: React.CSSProperties;
}) {
  const { open, setOpen, triggerRef } = useDropdownMenuContext("DropdownMenuContent");
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (contentRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, setOpen, triggerRef]);

  if (!open) return null;

  return (
    <div
      ref={contentRef}
      role="menu"
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        [align === "end" ? "right" : "left"]: 0,
        background: "var(--bw-bg-primary)",
        borderRadius: "var(--bw-radius-md)",
        boxShadow: "var(--bw-shadow-200)",
        border: "1px solid var(--bw-border)",
        minWidth: 200,
        padding: "var(--bw-space-1) 0",
        animation: "bw-fade-in var(--bw-duration-fast) var(--bw-easing)",
        zIndex: 100,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

const DropdownMenuItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ children, style, onClick, ...props }, ref) => {
  const { setOpen } = useDropdownMenuContext("DropdownMenuItem");
  return (
    <button
      ref={ref}
      type="button"
      role="menuitem"
      onClick={(e) => {
        onClick?.(e);
        setOpen(false);
      }}
      className="bw-button--ghost"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--bw-space-2)",
        width: "100%",
        padding: "var(--bw-space-3) var(--bw-space-4)",
        background: "none",
        border: "none",
        cursor: "pointer",
        fontSize: "var(--bw-fs-sm)",
        color: "var(--bw-content-primary)",
        transition: "background var(--bw-duration-fast)",
        textAlign: "left",
        fontFamily: "var(--bw-font-body)",
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
});
DropdownMenuItem.displayName = "DropdownMenuItem";

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
