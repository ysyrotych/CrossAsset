interface LogoProps {
  size?: number;
  color?: string;
  showWordmark?: boolean;
  wordmarkColor?: string;
  subColor?: string;
}

export default function Logo({
  size = 32,
  color = "white",
  showWordmark = true,
  wordmarkColor = "white",
  subColor = "rgba(255,255,255,0.35)",
}: LogoProps) {
  const sw = "2.4"; // bolder than reference
  const lc = "round";

  // Diamond corner tips (center is 30,30)
  const T = [30, 19]; // top
  const R = [41, 30]; // right
  const B = [30, 41]; // bottom
  const L = [19, 30]; // left

  // Spread of the 3 parallel lines at the outer end of each arm
  const s = 6;

  return (
    <div className="flex items-center gap-3.5">
      <svg
        width={size}
        height={size}
        viewBox="0 0 60 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        {/* ── Diamond outline ── */}
        <polygon
          points={`${T[0]},${T[1]} ${R[0]},${R[1]} ${B[0]},${B[1]} ${L[0]},${L[1]}`}
          stroke={color}
          strokeWidth={sw}
          fill="none"
          strokeLinejoin="miter"
        />

        {/* ── Top arm: 3 lines, parallel at top, converge to T ── */}
        <line x1={30 - s} y1={3}  x2={T[0]} y2={T[1]} stroke={color} strokeWidth={sw} strokeLinecap={lc} />
        <line x1={30}     y1={3}  x2={T[0]} y2={T[1]} stroke={color} strokeWidth={sw} strokeLinecap={lc} />
        <line x1={30 + s} y1={3}  x2={T[0]} y2={T[1]} stroke={color} strokeWidth={sw} strokeLinecap={lc} />

        {/* ── Right arm: 3 lines, parallel at right, converge to R ── */}
        <line x1={57} y1={30 - s} x2={R[0]} y2={R[1]} stroke={color} strokeWidth={sw} strokeLinecap={lc} />
        <line x1={57} y1={30}     x2={R[0]} y2={R[1]} stroke={color} strokeWidth={sw} strokeLinecap={lc} />
        <line x1={57} y1={30 + s} x2={R[0]} y2={R[1]} stroke={color} strokeWidth={sw} strokeLinecap={lc} />

        {/* ── Bottom arm: 3 lines, parallel at bottom, converge to B ── */}
        <line x1={30 - s} y1={57} x2={B[0]} y2={B[1]} stroke={color} strokeWidth={sw} strokeLinecap={lc} />
        <line x1={30}     y1={57} x2={B[0]} y2={B[1]} stroke={color} strokeWidth={sw} strokeLinecap={lc} />
        <line x1={30 + s} y1={57} x2={B[0]} y2={B[1]} stroke={color} strokeWidth={sw} strokeLinecap={lc} />

        {/* ── Left arm: 3 lines, parallel at left, converge to L ── */}
        <line x1={3} y1={30 - s} x2={L[0]} y2={L[1]} stroke={color} strokeWidth={sw} strokeLinecap={lc} />
        <line x1={3} y1={30}     x2={L[0]} y2={L[1]} stroke={color} strokeWidth={sw} strokeLinecap={lc} />
        <line x1={3} y1={30 + s} x2={L[0]} y2={L[1]} stroke={color} strokeWidth={sw} strokeLinecap={lc} />
      </svg>

      {showWordmark && (
        <div>
          <p
            className="text-[13px] font-semibold tracking-[0.14em] uppercase leading-none"
            style={{ fontFamily: "var(--font-serif)", color: wordmarkColor }}
          >
            CrossAsset
          </p>
          <p
            className="text-[9px] tracking-[0.2em] uppercase mt-1.5"
            style={{ color: subColor }}
          >
            Macro Intelligence
          </p>
        </div>
      )}
    </div>
  );
}
