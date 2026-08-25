import * as React from "react";

/* ═══════════════════════════════════════════════════════════
   Button — Base Web Style
   Pill-shaped, high-contrast, multiple variants
   ═══════════════════════════════════════════════════════════ */

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm" | "icon-xs";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: "var(--bw-bg-inverse)",
    color: "var(--bw-content-inverse)",
    border: "none",
  },
  secondary: {
    background: "var(--bw-bg-primary)",
    color: "var(--bw-content-primary)",
    border: "1px solid var(--bw-border-strong)",
  },
  tertiary: {
    background: "var(--bw-chip)",
    color: "var(--bw-content-primary)",
    border: "none",
  },
  ghost: {
    background: "transparent",
    color: "var(--bw-content-primary)",
    border: "none",
  },
  destructive: {
    background: "var(--bw-negative)",
    color: "var(--bw-white)",
    border: "none",
  },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: "6px 12px", fontSize: "var(--bw-fs-sm)", height: "32px" },
  md: { padding: "10px 16px", fontSize: "var(--bw-fs-base)", height: "40px" },
  lg: { padding: "14px 20px", fontSize: "var(--bw-fs-base)", height: "48px" },
  icon: { padding: "8px", width: "36px", height: "36px", fontSize: "var(--bw-fs-base)" },
  "icon-sm": { padding: "4px", width: "28px", height: "28px", fontSize: "var(--bw-fs-sm)" },
  "icon-xs": { padding: "2px", width: "24px", height: "24px", fontSize: "var(--bw-fs-xs)" },
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", style, disabled, children, ...props }, ref) => {
    const vs = variantStyles[variant];
    const ss = sizeStyles[size];

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`bw-button bw-button--${variant} bw-button--${size} ${className}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          fontFamily: "var(--bw-font-body)",
          fontWeight: "var(--bw-fw-medium)" as any,
          lineHeight: "1",
          borderRadius: size === "icon" || size === "icon-sm" || size === "icon-xs" ? "var(--bw-radius-circle)" : "var(--bw-radius-pill)",
          cursor: disabled ? "not-allowed" : "pointer",
          transition: `all var(--bw-duration-normal) var(--bw-easing)`,
          opacity: disabled ? 0.5 : 1,
          whiteSpace: "nowrap",
          textDecoration: "none",
          ...vs,
          ...ss,
          ...style,
        }}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

/* Helper to generate className-compatible buttonVariants for <a> tags */
function buttonVariants({
  variant = "primary" as ButtonVariant,
  size = "md" as ButtonSize,
  className = "",
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return `bw-button bw-button--${variant} bw-button--${size} ${className}`.trim();
}

export { Button, buttonVariants };
