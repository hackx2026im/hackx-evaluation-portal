import * as React from "react";

/* ═══════════════════════════════════════════════════════════
   Progress — Base Web Style
   Minimal progress bar with animated fill
   ═══════════════════════════════════════════════════════════ */

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
}

function Progress({ value = 0, max = 100, className = "", style, ...props }: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`bw-progress ${className}`} style={style} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} {...props}>
      <div
        className="bw-progress-bar"
        style={{ "--bw-progress-value": percentage / 100 } as React.CSSProperties}
      />
    </div>
  );
}

export { Progress };
