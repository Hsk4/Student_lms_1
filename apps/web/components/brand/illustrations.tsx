import type { CSSProperties } from "react";
import { BrandMark, COBALT, GOLD, NAVY, Star, TINT } from "./primitives";

/**
 * Illustration kit. Everything is drawn in SVG so it stays crisp at any size,
 * carries no stock imagery, and can be recoloured by the palette alone.
 */

/** A pointed arch from `yTop` down to the baseline `y = 300`. */
function archPath(x: number, w: number, yTop: number, base = 300): string {
  const r = w / 2;
  const cx = x + r;
  const shoulder = yTop + 74;
  return [
    `M${x} ${base}`,
    `V${shoulder}`,
    `A${r} ${r} 0 0 1 ${cx} ${yTop}`,
    `A${r} ${r} 0 0 1 ${x + w} ${shoulder}`,
    `V${base}`,
    "Z",
  ].join(" ");
}

/**
 * The layered mehrab: three nested arches (navy → cobalt → pale blue) holding
 * a rising sun, three rising bars and an open book, with the mark in the
 * oculus where the inner arch comes to its point.
 */
export function ArchIllustration({
  className = "",
  style,
  label = "Three nested pointed arches holding a rising sun, three rising bars and an open book.",
}: {
  className?: string;
  style?: CSSProperties;
  label?: string;
}) {
  const inner = archPath(108, 184, 80);
  return (
    <svg
      viewBox="0 0 400 326"
      fill="none"
      className={className}
      style={style}
      role="img"
      aria-label={label}
    >
      <defs>
        <clipPath id="fastly-inner-arch">
          <path d={inner} />
        </clipPath>
        <clipPath id="fastly-outer-arch">
          <path d={archPath(20, 360, 2)} />
        </clipPath>
      </defs>

      {/*
       * Outer: navy, laid with the jaali star field at 14%. The lattice runs on
       * past the arch's edge and is clipped to the frame: on the navy hero a
       * clipped lattice leaves a visible square of "quieter" background, which
       * reads as a mistake rather than a layer.
       */}
      <path d={archPath(20, 360, 2)} fill="#0F2E4F" />
      <g fill="#FFFFFF" opacity="0.14">
        {[62, 134, 206, 278, 350].map((y) =>
          [56, 164, 272, 380].map((x) => <Star key={`${x}-${y}`} cx={x} cy={y} r={7} color="#FFFFFF" />),
        )}
      </g>
      <path d={archPath(20, 360, 2)} stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />

      {/* Middle: cobalt. */}
      <path d={archPath(64, 272, 44)} fill={COBALT} />
      <path d={archPath(64, 272, 44)} stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
      {[150, 220, 290].map((y) =>
        [100, 300].map((x) => (
          <Star key={`c${x}-${y}`} cx={x} cy={y} r={5} color="#FFFFFF" />
        )),
      )}

      {/* Inner: pale blue, with the scene clipped to the point. */}
      <g clipPath="url(#fastly-inner-arch)">
        <path d={inner} fill={TINT} />

        <path d="M152 214a48 48 0 0 1 96 0Z" fill={COBALT} opacity="0.92" />
        <path
          d="M142 214h116"
          stroke={COBALT}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.45"
        />

        <rect x="150" y="238" width="20" height="34" rx="5" fill={NAVY} opacity="0.25" />
        <rect x="178" y="224" width="20" height="48" rx="5" fill={COBALT} opacity="0.55" />
        <rect x="206" y="208" width="20" height="64" rx="5" fill={NAVY} />

        <path
          d="M138 280c18-9 40-9 62 2 22-11 44-11 62-2v12c-20-8-42-6-62 5-20-11-42-13-62-5Z"
          fill="#FFFFFF"
          stroke={NAVY}
          strokeWidth="1.5"
          strokeOpacity="0.5"
          strokeLinejoin="round"
        />
        <path d="M200 282v13" stroke={COBALT} strokeWidth="2" strokeLinecap="round" />
        <path
          d="M152 282c13-3 25-1 38 4M248 282c-13-3-25-1-38 4"
          stroke={NAVY}
          strokeWidth="1.5"
          strokeOpacity="0.22"
          strokeLinecap="round"
        />
      </g>

      <g transform="translate(180 96) scale(0.83)">
        <BrandMark size={48} tone="dark" star={false} />
      </g>
      <Star cx={200} cy={124} r={3.4} />
    </svg>
  );
}

/**
 * Hourglass in an arch: the "waiting for approval" state. One instance on the
 * landing page, one on the phone screen.
 */
export function HourglassIllustration({
  size = 160,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size * 1.12}
      viewBox="0 0 160 180"
      fill="none"
      className={className}
      role="img"
      aria-label="An hourglass inside a pointed arch"
    >
      <path
        d="M80 8c3.2 8 10 14.2 20 20.4C126 44 139 63 139 85v82H21V85c0-22 13-41 39-56.6C70 22.2 76.8 16 80 8Z"
        fill={TINT}
      />
      <path
        d="M80 8c3.2 8 10 14.2 20 20.4C126 44 139 63 139 85v82H21V85c0-22 13-41 39-56.6C70 22.2 76.8 16 80 8Z"
        stroke={COBALT}
        strokeOpacity="0.28"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Glass. */}
      <path
        d="M60 82h40M60 82c0 19 20 21 20 33s-20 14-20 33M100 82c0 19-20 21-20 33M60 148h40"
        stroke={NAVY}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Sand: the upper heap, the falling thread, the lower heap. */}
      <path d="M66 88h28c0 13-13 16-13 24 0-8-15-11-15-24Z" fill={COBALT} opacity="0.85" />
      <path d="M81 114v20" stroke={COBALT} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <path d="M64 142c0-10 7-16 16-16s16 6 16 16Z" fill={NAVY} />
      <Star cx={80} cy={24} r={3.6} color={GOLD} />
    </svg>
  );
}

/** "Waiting": a quiet clock in an arch, used beside the status tracker. */
export function WaitingIllustration({ size = 132 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      role="img"
      aria-label="A clock inside a pointed arch"
    >
      <path
        d="M60 6c2.6 6.4 8 11.4 15.7 16.3C95.2 34.6 105 48.9 105 65.1V110H15V65.1c0-16.2 9.8-30.5 29.3-42.8C52 17.4 57.4 12.4 60 6Z"
        fill={TINT}
      />
      <circle cx="60" cy="64" r="23" stroke={NAVY} strokeWidth="2" />
      <path
        d="M60 50v14l9 7"
        stroke={NAVY}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M60 35v-4M90 64h4M60 93v4M30 64h-4"
        stroke={COBALT}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />
      <Star cx={60} cy={19} r={3} color={GOLD} />
    </svg>
  );
}
