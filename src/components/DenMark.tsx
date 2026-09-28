import { useId } from "react";

/** The Den mark: an arched doorway with a lantern flame inside. */
export function DenMark({ size = 40 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-arch`} x1="8" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFC676" />
          <stop offset="1" stopColor="#FF7A45" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="24" cy="30" r="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFB454" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFB454" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M9 44V22C9 12.6 15.7 5 24 5s15 7.6 15 17v22" stroke={`url(#${id}-arch)`} strokeWidth="3.2" strokeLinecap="round" />
      <path d="M4 44h40" stroke="#372E55" strokeWidth="3" strokeLinecap="round" />
      <circle cx="24" cy="30" r="14" fill={`url(#${id}-glow)`} />
      <path
        d="M24 21c3.2 3.4 4.8 6 4.8 8.6a4.8 4.8 0 0 1-9.6 0c0-1.6.7-3.1 2-4.6.3 1.4 1 2.3 1.9 2.5-.4-2.3.1-4.3.9-6.5Z"
        fill="#FFB454"
      />
    </svg>
  );
}
