// Places 1-3 on a leaderboard: a small numbered disc in gold, silver or bronze
// (no emoji). Anything lower is just the number.
const TONES = [
  "bg-[#e8c547] text-ink ring-[#f5dc7a]",
  "bg-[#cfd4dc] text-ink ring-[#e5e8ed]",
  "bg-[#c98a55] text-white ring-[#e0ac80]",
];

export function RankMedal({ rank, className = "", style }: { rank: number; className?: string; style?: React.CSSProperties }) {
  if (rank > 3) return <>{rank}</>;
  return (
    <span
      style={style}
      aria-label={`Place ${rank}`}
      className={`inline-grid size-7 place-items-center rounded-full text-xs font-black tabular-nums ring-2 ring-inset shadow-sm ${TONES[rank - 1]} ${className}`}
    >
      {rank}
    </span>
  );
}
