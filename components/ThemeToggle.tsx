"use client";

import { useTheme } from "./ThemeProvider";
import { useRef, useCallback } from "react";

function launchTransition(
  x: number,
  y: number,
  goingDark: boolean,
  onSwitch: () => void
) {
  const targetBg = goingDark ? "#0c0c0c" : "#f9fafb";
  const maxR =
    Math.ceil(
      Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      )
    ) + 100;

  // ── Golden shockwave rings bursting from toggle ──────────────────────
  for (let i = 0; i < 5; i++) {
    const ring = document.createElement("div");
    const size = 28;
    Object.assign(ring.style, {
      position: "fixed",
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: "50%",
      border: `${2 - i * 0.2}px solid rgba(201,168,76,${0.9 - i * 0.14})`,
      top: `${y - size / 2}px`,
      left: `${x - size / 2}px`,
      zIndex: "999996",
      pointerEvents: "none",
      transform: "scale(1)",
    });
    document.body.appendChild(ring);
    ring
      .animate(
        [
          { transform: "scale(1)", opacity: 0.9 - i * 0.14 },
          { transform: `scale(${45 + i * 22})`, opacity: 0 },
        ],
        {
          duration: 800 + i * 60,
          delay: i * 55,
          easing: "cubic-bezier(0.1,0,0.5,1)",
          fill: "forwards",
        }
      )
      .finished.then(() => ring.remove());
  }

  // ── Main overlay: circle expands from toggle to cover viewport ───────
  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "999997",
    pointerEvents: "none",
    background: targetBg,
    clipPath: `circle(0px at ${x}px ${y}px)`,
    willChange: "clip-path",
  });
  document.body.appendChild(overlay);

  overlay
    .animate(
      [
        { clipPath: `circle(0px at ${x}px ${y}px)` },
        { clipPath: `circle(${maxR}px at ${x}px ${y}px)` },
      ],
      { duration: 750, delay: 40, easing: "cubic-bezier(0.4,0,0.2,1)", fill: "forwards" }
    )
    .finished.then(() => {
      // Switch theme while screen is fully covered ──────────────────────
      onSwitch();

      // ── Star field: white + gold dots appear briefly (dark only) ─────
      if (goingDark) {
        const canvas = document.createElement("canvas");
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        Object.assign(canvas.style, {
          position: "fixed",
          inset: "0",
          zIndex: "999999",
          pointerEvents: "none",
        });
        document.body.appendChild(canvas);
        const ctx = canvas.getContext("2d")!;
        for (let i = 0; i < 240; i++) {
          const sx = Math.random() * canvas.width;
          const sy = Math.random() * canvas.height;
          const r = Math.random() * 2 + 0.3;
          const alpha = Math.random() * 0.7 + 0.3;
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.fillStyle =
            Math.random() > 0.75
              ? `rgba(201,168,76,${alpha})`
              : `rgba(255,255,255,${alpha})`;
          ctx.fill();
        }
        canvas
          .animate(
            [
              { opacity: 1, transform: "scale(1)" },
              { opacity: 0, transform: "scale(1.04)" },
            ],
            { duration: 800, easing: "ease-in", fill: "forwards" }
          )
          .finished.then(() => canvas.remove());
      }

      // ── Radial gold flash at peak ─────────────────────────────────────
      const flash = document.createElement("div");
      Object.assign(flash.style, {
        position: "fixed",
        inset: "0",
        zIndex: "999998",
        pointerEvents: "none",
        background: `radial-gradient(circle at ${x}px ${y}px, rgba(201,168,76,0.3) 0%, rgba(201,168,76,0.08) 30%, transparent 65%)`,
      });
      document.body.appendChild(flash);
      flash
        .animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 600,
          easing: "ease-out",
          fill: "forwards",
        })
        .finished.then(() => flash.remove());

      // ── Collapse: overlay retracts back into toggle position ──────────
      setTimeout(() => {
        overlay
          .animate(
            [
              { clipPath: `circle(${maxR}px at ${x}px ${y}px)` },
              { clipPath: `circle(0px at ${x}px ${y}px)` },
            ],
            { duration: 580, easing: "cubic-bezier(0.6,0,0.4,1)", fill: "forwards" }
          )
          .finished.then(() => overlay.remove());
      }, 60);
    });
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  const busy = useRef(false);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (busy.current) return;
      busy.current = true;
      const rect = e.currentTarget.getBoundingClientRect();
      launchTransition(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        !isDark,
        () => {
          toggle();
          setTimeout(() => {
            busy.current = false;
          }, 1500);
        }
      );
    },
    [isDark, toggle]
  );

  return (
    <button
      onClick={handleClick}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`group relative flex-shrink-0 focus:outline-none ${className}`}
    >
      {/* Track */}
      <div
        className="relative w-[52px] h-[26px] rounded-full overflow-hidden transition-all duration-500"
        style={{
          background: isDark
            ? "linear-gradient(135deg, #080808 0%, #0c0c20 50%, #14102a 100%)"
            : "linear-gradient(135deg, #fde68a 0%, #fed7aa 50%, #fbbf24 100%)",
          boxShadow: isDark
            ? "inset 0 1px 3px rgba(0,0,0,0.8), 0 0 0 1px rgba(201,168,76,0.25)"
            : "inset 0 1px 3px rgba(0,0,0,0.15), 0 0 0 1px rgba(251,191,36,0.4)",
        }}
      >
        {/* Stars (dark mode) */}
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
              ? "0 0 14px rgba(201,168,76,0.9), 0 0 28px rgba(201,168,76,0.35), 0 2px 4px rgba(0,0,0,0.5)"
              : "0 0 8px rgba(251,191,36,0.6), 0 0 16px rgba(251,191,36,0.2), 0 2px 4px rgba(0,0,0,0.15)",
          }}
        >
          {/* Sun rays */}
          {!isDark &&
            [0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
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

          {/* Moon crescent */}
          {isDark && (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M9.5 6.5A4 4 0 0 1 5.5 2.5a4 4 0 0 0 0 8 4 4 0 0 0 4-4z"
                  fill="#0c0c0c"
                  opacity={0.65}
                />
              </svg>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
