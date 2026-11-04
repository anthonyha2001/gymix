// A one-off burst of confetti from the middle of its parent (which must be
// positioned). Pieces are spread by index so server and client render alike.
const COLORS = ["var(--color-brand)", "#22c55e", "#3b82f6", "#f97316", "#ec4899", "#0d1117"];

export function Confetti({ pieces = 22 }: { pieces?: number }) {
  return (
    <span aria-hidden className="confetti pointer-events-none absolute inset-0 overflow-visible">
      {Array.from({ length: pieces }, (_, i) => {
        const angle = (i / pieces) * Math.PI * 2 + (i % 3) * 0.3;
        const dist = 70 + ((i * 37) % 60);
        return (
          <i
            key={i}
            style={
              {
                background: COLORS[i % COLORS.length],
                "--x": `${Math.round(Math.cos(angle) * dist * 1.6)}px`,
                "--y": `${Math.round(Math.sin(angle) * dist - 30)}px`,
                "--r": `${(i % 2 ? 1 : -1) * (240 + i * 25)}deg`,
                animationDelay: `${(i % 4) * 25}ms`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </span>
  );
}
