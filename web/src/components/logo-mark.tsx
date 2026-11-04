// The Gymix mark: a bold "G" with the two waves of a contactless tap, drawn on
// a 100x100 grid. Colour comes from `currentColor`.
export const MARK_PATHS = [
  { d: "M47.6 35.5 A27 23 0 1 0 69 58 H48", width: 16, cap: "butt" },
  { d: "M60.8 29.1 A13 13 0 0 1 71.9 40.2", width: 8.5, cap: "round" },
  { d: "M62.3 18.2 A24 24 0 0 1 82.8 38.7", width: 8.5, cap: "round" },
] as const;

// Nudges the drawing to the optical centre of the square.
export const MARK_TRANSFORM = "translate(3,-1.5)";

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={className}>
      <g transform={MARK_TRANSFORM} fill="none" stroke="currentColor" strokeLinejoin="round">
        {MARK_PATHS.map((p) => (
          <path key={p.d} d={p.d} strokeWidth={p.width} strokeLinecap={p.cap} />
        ))}
      </g>
    </svg>
  );
}

// The mark as a complete SVG document (favicon, app icons).
export function markSvg({ background, color, radius = 22, scale = 1 }: { background: string; color: string; radius?: number; scale?: number }) {
  const offset = (100 - 100 * scale) / 2;
  const paths = MARK_PATHS.map(
    (p) => `<path d="${p.d}" stroke-width="${p.width}" stroke-linecap="${p.cap}"/>`,
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="${radius}" fill="${background}"/><g transform="translate(${offset},${offset}) scale(${scale}) ${MARK_TRANSFORM}" fill="none" stroke="${color}" stroke-linejoin="round">${paths}</g></svg>`;
}
