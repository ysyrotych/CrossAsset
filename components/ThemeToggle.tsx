"use client";

import { useTheme } from "./ThemeProvider";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`group relative flex-shrink-0 focus:outline-none ${className}`}
    >
      {/* Track */}
      <div
        className="relative w-[52px] h-[26px] rounded-full overflow-hidden transition-all duration-500"
        style={{
          background: isDark
            ? "linear-gradient(135deg, #06090f 0%, #0d1a3a 50%, #1a1040 100%)"
            : "linear-gradient(135deg, #fde68a 0%, #fed7aa 50%, #fbbf24 100%)",
          boxShadow: isDark
            ? "inset 0 1px 3px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,168,76,0.2)"
            : "inset 0 1px 3px rgba(0,0,0,0.15), 0 0 0 1px rgba(251,191,36,0.4)",
        }}
      >
        {/* Stars (visible in dark mode) */}
        {[
          { x: 10, y: 6, s: 1.5 },
          { x: 16, y: 14, s: 1 },
          { x: 8, y: 18, s: 1 },
          { x: 22, y: 8, s: 1.2 },
        ].map((star, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white transition-all duration-500"
            style={{
              width: star.s,
              height: star.s,
              left: star.x,
              top: star.y,
              opacity: isDark ? 0.7 : 0,
              transform: `scale(${isDark ? 1 : 0})`,
              transitionDelay: `${i * 40}ms`,
            }}
          />
        ))}

        {/* Thumb */}
        <div
          className="absolute top-[3px] w-[20px] h-[20px] rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          style={{
            left: isDark ? 29 : 3,
            background: isDark
              ? "linear-gradient(135deg, #c9a84c 0%, #e8c870 50%, #c9a84c 100%)"
              : "linear-gradient(135deg, #ffffff 0%, #fef9ef 100%)",
            boxShadow: isDark
              ? "0 0 12px rgba(201,168,76,0.8), 0 0 24px rgba(201,168,76,0.3), 0 2px 4px rgba(0,0,0,0.4)"
              : "0 0 8px rgba(251,191,36,0.6), 0 0 16px rgba(251,191,36,0.2), 0 2px 4px rgba(0,0,0,0.15)",
          }}
        >
          {/* Sun rays */}
          {!isDark && [0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <div
              key={angle}
              className="absolute bg-amber-300 transition-all duration-300"
              style={{
                width: 1.5,
                height: 4,
                top: "50%",
                left: "50%",
                borderRadius: 1,
                transformOrigin: "50% 150%",
                transform: `translateX(-50%) translateY(-150%) rotate(${angle}deg)`,
                opacity: isDark ? 0 : 0.8,
              }}
            />
          ))}

          {/* Moon crescent (visible in dark mode) */}
          {isDark && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ opacity: 1 }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M9.5 6.5A4 4 0 0 1 5.5 2.5a4 4 0 0 0 0 8 4 4 0 0 0 4-4z"
                  fill="#06090f"
                  opacity={0.6}
                />
              </svg>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
