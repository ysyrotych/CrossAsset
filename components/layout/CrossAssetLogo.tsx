// components/layout/CrossAssetLogo.tsx

type CrossAssetLogoProps = {
  variant?: "full" | "compact" | "mark";
  color?: "dark" | "light";
  className?: string;
};

export default function CrossAssetLogo({
  variant = "full",
  color = "dark",
  className = "",
}: CrossAssetLogoProps) {
  const stroke = color === "dark" ? "#050505" : "#ffffff";

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Icon / Mark */}
      {/* Mark — viewBox 0 0 100 100, center (50,50)
          Star tips:   top(50,30) right(70,50) bottom(50,70) left(30,50)
          Inner corners: tl(37,37) tr(63,37) br(63,63) bl(37,63)
          Arms spread s=10 at outer edge (reach y=7 / x=93 / y=93 / x=7)
      */}
      <svg
        width={variant === "mark" ? "30" : variant === "compact" ? "42" : "72"}
        height={variant === "mark" ? "30" : variant === "compact" ? "42" : "72"}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="CrossAsset logo mark"
      >
        {/* TOP arm */}
        <line x1="40" y1="7"  x2="37" y2="37" stroke={stroke} strokeWidth="3" strokeLinecap="round"/>
        <line x1="50" y1="7"  x2="50" y2="30" stroke={stroke} strokeWidth="3" strokeLinecap="round"/>
        <line x1="60" y1="7"  x2="63" y2="37" stroke={stroke} strokeWidth="3" strokeLinecap="round"/>
        {/* RIGHT arm */}
        <line x1="93" y1="40" x2="63" y2="37" stroke={stroke} strokeWidth="3" strokeLinecap="round"/>
        <line x1="93" y1="50" x2="70" y2="50" stroke={stroke} strokeWidth="3" strokeLinecap="round"/>
        <line x1="93" y1="60" x2="63" y2="63" stroke={stroke} strokeWidth="3" strokeLinecap="round"/>
        {/* BOTTOM arm */}
        <line x1="40" y1="93" x2="37" y2="63" stroke={stroke} strokeWidth="3" strokeLinecap="round"/>
        <line x1="50" y1="93" x2="50" y2="70" stroke={stroke} strokeWidth="3" strokeLinecap="round"/>
        <line x1="60" y1="93" x2="63" y2="63" stroke={stroke} strokeWidth="3" strokeLinecap="round"/>
        {/* LEFT arm */}
        <line x1="7"  y1="40" x2="37" y2="37" stroke={stroke} strokeWidth="3" strokeLinecap="round"/>
        <line x1="7"  y1="50" x2="30" y2="50" stroke={stroke} strokeWidth="3" strokeLinecap="round"/>
        <line x1="7"  y1="60" x2="37" y2="63" stroke={stroke} strokeWidth="3" strokeLinecap="round"/>
      </svg>

      {variant !== "mark" && (
        <div className="flex flex-col items-center">
          <div
            className={`
              mt-6 tracking-[0.22em] font-serif font-normal
              ${variant === "compact" ? "text-[20px]" : "text-[46px]"}
              ${color === "dark" ? "text-black" : "text-white"}
            `}
            style={{
              fontFamily:
                'Didot, "Bodoni 72", "Bodoni 72 Smallcaps", "Times New Roman", serif',
              letterSpacing: variant === "compact" ? "0.18em" : "0.22em",
            }}
          >
            CROSSASSET
          </div>

          {variant === "full" && (
            <div
              className={`
                mt-3 text-[13px] font-medium tracking-[0.48em]
                ${color === "dark" ? "text-black/80" : "text-white/80"}
              `}
              style={{
                fontFamily:
                  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              }}
            >
              MACRO INTELLIGENCE
            </div>
          )}
        </div>
      )}
    </div>
  );
}
