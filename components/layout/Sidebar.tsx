"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import CrossAssetLogo from "./CrossAssetLogo";

const NAV: { label: string; href: string; dev?: boolean }[] = [
  { label: "Dashboard",        href: "/" },
  { label: "Newspaper",        href: "/issue/create" },
  { label: "Reaction Tracker", href: "/reaction-tracker" },
  { label: "Watchlist",        href: "/watchlist" },
  { label: "Calendar",         href: "/calendar" },
  { label: "10K / 10Q",        href: "/10k" },
  { label: "Backtesting",      href: "/backtesting" },
  { label: "Strategy Lab",     href: "/strategy-lab", dev: true },
  { label: "Research",         href: "/research" },
  { label: "Archive",          href: "/archive" },
  { label: "Settings",         href: "/settings" },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-56 flex flex-col z-40"
      style={{ background: "var(--ca-sidebar-bg)" }}
    >
      <div className="px-5 pt-6 pb-5 flex items-center gap-3">
        <CrossAssetLogo variant="mark" color="light" className="shrink-0" />
        <div>
          <p className="text-white text-[12px] font-semibold tracking-[0.18em] uppercase leading-none"
            style={{ fontFamily: "var(--font-serif)" }}>CrossAsset</p>
          <p className="text-white/35 text-[8.5px] tracking-[0.2em] uppercase mt-1.5">Macro Intelligence</p>
        </div>
      </div>

      <div className="mx-6 border-t border-white/10" />

      <nav className="flex-1 px-3 py-5 space-y-0.5">
        {NAV.map(({ label, href, dev }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all",
                active
                  ? "text-white bg-white/10"
                  : "text-white/55 hover:text-white/85 hover:bg-white/[0.05]"
              )}
            >
              {active && (
                <span
                  className="w-[3px] h-3.5 rounded-full shrink-0 transition-all duration-300"
                  style={{ background: "var(--ca-accent)" }}
                />
              )}
              <span className={active ? "" : "pl-[5px]"}>{label}</span>
              {dev && (
                <span className="ml-auto text-[8px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}>
                  Dev
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mx-6 border-t border-white/10" />

      <div className="px-5 py-4">
        <p className="text-[10px] font-medium text-white/30 leading-relaxed">
          Research only. Not investment advice.
        </p>
      </div>
    </aside>
  );
}
