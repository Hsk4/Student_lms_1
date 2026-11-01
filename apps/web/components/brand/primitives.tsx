import type { ComponentType, CSSProperties, ReactNode } from "react";
import type { LucideProps } from "lucide-react";

/**
 * Fastly brand primitives — the parts of the visual language that are *shape*
 * rather than layout. The landing page and the phone screens are both built
 * from these, so the identity cannot drift between the two.
 *
 * House rules encoded here:
 * - No gradients, no shadows, no stock imagery. Depth is a 1.5px border.
 * - Gold is the star, and the star only. Primary calls to action use
 *   `.fastly-cta` (one per screen); every other button is cobalt or outlined.
 * - Every interactive element is at least 48px tall.
 */

export const NAVY = "#0A2540";
export const COBALT = "#1E4DB7";
export const TINT = "#EAF1FF";
export const FIROZA = "#0B7F8F";
export const GOLD = "#F4B942";

/* ------------------------------------------------------------------ mark */

/**
 * The mark: an "F" drawn inside the pointed mehrab arch, with a small gold
 * eight-point star where the arch comes to its point.
 */
export function BrandMark({
  size = 40,
  tone = "light",
  star = true,
  className = "",
}: {
  size?: number;
  /** `light` sits on navy and draws white; `dark` sits on white and draws navy. */
  tone?: "light" | "dark";
  star?: boolean;
  className?: string;
}) {
  const ink = tone === "light" ? "#FFFFFF" : NAVY;
  const field = tone === "light" ? "rgba(255,255,255,0.10)" : TINT;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M24 8.6c.8 1.9 2.3 3.3 4.6 4.7C35.8 17.3 39 21.3 39 25.9V42a.8.8 0 0 1-.8.8H9.8a.8.8 0 0 1-.8-.8V25.9c0-4.6 3.2-8.6 10.4-12.6 2.3-1.4 3.8-2.8 4.6-4.7Z"
        fill={field}
        stroke={ink}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path
        d="M19.6 36V23.6h9.6M19.6 29.6h7.4"
        stroke={ink}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {star ? <Star cx={24} cy={7.2} r={3.4} /> : null}
    </svg>
  );
}

/** Eight-point star: two squares, one turned 45°. The jaali motif. */
export function Star({
  cx,
  cy,
  r,
  color = GOLD,
  className = "",
}: {
  cx: number;
  cy: number;
  r: number;
  color?: string;
  className?: string;
}) {
  const a = r * 0.42;
  const d = [
    `M${cx} ${cy - r}`,
    `L${cx + a} ${cy - a}`,
    `L${cx + r} ${cy}`,
    `L${cx + a} ${cy + a}`,
    `L${cx} ${cy + r}`,
    `L${cx - a} ${cy + a}`,
    `L${cx - r} ${cy}`,
    `L${cx - a} ${cy - a}`,
    "Z",
  ].join(" ");
  return <path d={d} fill={color} className={className} />;
}

/** Standalone star, sized like an inline icon. */
export function StarIcon({ size = 14, color = GOLD }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <Star cx={12} cy={12} r={9} color={color} />
    </svg>
  );
}

/* ------------------------------------------------------------------ arch */

export type ArchTone = "navy" | "cobalt" | "tint" | "white" | "firoza" | "outline";

const TILE_TONES: Record<ArchTone, string> = {
  navy: "bg-[#0a2540] text-white",
  cobalt: "bg-[#1e4db7] text-white",
  tint: "bg-[#eaf1ff] text-[#1e4db7]",
  white: "bg-white text-[#0a2540]",
  firoza: "bg-[#0b7f8f] text-white",
  outline: "border-[1.5px] border-cobalt/30 bg-white text-[#1e4db7]",
};

const ICON_TONES: Record<ArchTone, string> = {
  navy: "text-white",
  cobalt: "text-white",
  tint: "text-[#1e4db7]",
  white: "text-[#0a2540]",
  firoza: "text-white",
  outline: "text-[#1e4db7]",
};

/**
 * The arch tile: square footprint, pointed top, one line icon centred in it.
 * `--arch-size` drives the width so the silhouette scales cleanly.
 */
export function ArchTile({
  children,
  size = 56,
  tone = "tint",
  className = "",
  style,
}: {
  children: ReactNode;
  size?: number;
  tone?: ArchTone;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <ArchShape
      width={size}
      tone={tone}
      className={className}
      style={{ ...style, height: size }}
    >
      {children}
    </ArchShape>
  );
}

/**
 * The mehrab silhouette as a filled box: a shoulder arc at the top, square
 * at the bottom. A CSS `border-radius` can only round a corner off; this
 * actually comes to a point, which is the brand's whole shape.
 */
export function ArchShape({
  width,
  tone = "tint",
  children,
  className = "",
  style,
}: {
  width: number;
  tone?: ArchTone;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const shoulder = Math.round(width * 0.42);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${TILE_TONES[tone]} ${className}`}
      style={{
        width,
        borderRadius: `${shoulder}px ${shoulder}px ${Math.max(6, width * 0.16)}px ${Math.max(6, width * 0.16)}px / ${shoulder}px ${shoulder}px ${Math.round(width * 0.12)}px ${Math.round(width * 0.12)}px`,
        ...style,
      }}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

/** Line icon coloured to sit inside an `ArchTile`. */
export function TileIcon({
  icon: Icon,
  tone = "tint",
  size = 24,
  strokeWidth = 1.6,
}: {
  icon: ComponentType<LucideProps>;
  tone?: ArchTone;
  size?: number;
  strokeWidth?: number;
}) {
  return <Icon size={size} strokeWidth={strokeWidth} className={ICON_TONES[tone]} />;
}

/** Number inside a small pointed arch — step markers and code steps. */
export function ArchNumber({
  n,
  size = 40,
  tone = "navy",
  className = "",
}: {
  n: ReactNode;
  size?: number;
  tone?: "navy" | "cobalt" | "outline" | "tint";
  className?: string;
}) {
  const styles =
    tone === "cobalt"
      ? "bg-cobalt text-white"
      : tone === "outline"
        ? "border-[1.5px] border-cobalt/30 text-cobalt"
        : tone === "tint"
          ? "bg-tint text-navy"
          : "bg-navy text-white";
  return (
    <span
      className={`fastly-display inline-flex shrink-0 items-center justify-center ${styles} ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: `${size * 0.5}px ${size * 0.5}px ${size * 0.2}px ${size * 0.2}px / ${size * 0.42}px ${size * 0.42}px ${size * 0.14}px ${size * 0.14}px`,
        fontSize: size * 0.44,
        paddingTop: size * 0.06,
      }}
      aria-hidden="true"
    >
      {n}
    </span>
  );
}

/* ----------------------------------------------------------------- chips */

export type ChipTone = "paid" | "focus" | "due" | "neutral" | "navy";

const CHIP_TONES: Record<ChipTone, string> = {
  paid: "bg-[#e6f3f4] text-[#075e6a]",
  focus: "bg-[#eaf1ff] text-[#1e4db7]",
  // Amber stays on the palette's warm side without inventing an orange.
  due: "bg-[#fdf0d6] text-[#6e4b06]",
  neutral: "bg-transparent text-ink-soft border-[1.5px] border-line",
  navy: "bg-[#0a2540] text-white",
};

/** Status chip: small, rounded rectangle, sentence case. */
export function StatusChip({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: ChipTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex min-h-6 items-center whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold ${CHIP_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- layout */

/** A labelled pill: the hero's "For [school]" and the board chips. */
export function Pill({
  children,
  tone = "onNavy",
  className = "",
}: {
  children: ReactNode;
  tone?: "onNavy" | "cobalt" | "white";
  className?: string;
}) {
  const styles =
    tone === "cobalt"
      ? "border-cobalt/25 bg-[#eaf1ff] text-[#1e4db7]"
      : tone === "white"
        ? "border-line bg-white text-[#0a2540]"
        : "border-on-navy-line bg-white/[0.06] text-white";
  return (
    <span
      className={`inline-flex min-h-9 items-center gap-2 rounded-full border-[1.5px] px-3.5 text-[13px] font-medium ${styles} ${className}`}
    >
      {children}
    </span>
  );
}

/** Section eyebrow: small caps, cobalt, wide tracking. */
export function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <p
      className={`text-xs font-semibold uppercase tracking-[0.16em] ${dark ? "text-[#f4b942]" : "text-[#1e4db7]"}`}
    >
      {children}
    </p>
  );
}

/* --------------------------------------------------------------- jaali */

/**
 * The jaali lattice, as a positioned layer. Rendered as a sibling *behind*
 * content (absolute, inset-0, no pointer events) so the 14%/16% pattern never
 * lands on top of type.
 */
export function Jaali({
  tone = "navy",
  className = "",
}: {
  tone?: "navy" | "tint";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${tone === "tint" ? "fastly-jaali-tint" : "fastly-jaali"} ${className}`}
    />
  );
}
