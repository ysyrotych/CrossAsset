"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Defers rendering heavy children (Recharts SVGs) until the block scrolls near
 * the viewport, then keeps them mounted. With ~123 charts, mounting them all at
 * once made the page crawl; this renders only what's on/near screen.
 *
 * `force` (set while printing / presenting) renders immediately so the PDF and
 * slideshow always contain every exhibit.
 */
export default function LazyMount({
  minHeight,
  force = false,
  children,
}: {
  minHeight: number;
  force?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (shown || force) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "1200px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown, force]);

  const visible = shown || force;
  return (
    <div ref={ref} style={visible ? undefined : { minHeight }}>
      {visible ? children : null}
    </div>
  );
}
