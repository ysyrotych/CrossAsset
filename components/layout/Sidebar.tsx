"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Newspaper,
  TrendingUp,
  Star,
  Calendar,
  CheckSquare,
  Archive,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Daily Issue", href: "/issue", icon: Newspaper },
  { label: "Reaction Tracker", href: "/reaction-tracker", icon: TrendingUp },
  { label: "Watchlist", href: "/watchlist", icon: Star },
  { label: "Calendar", href: "/calendar", icon: Calendar },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Archive", href: "/archive", icon: Archive },
  { label: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-zinc-950 border-r border-zinc-800 flex flex-col z-40">
      <div className="px-5 py-5 border-b border-zinc-800">
        <span className="text-base font-semibold tracking-tight text-white">CrossAsset</span>
        <p className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-widest">Macro Intelligence</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors",
                active
                  ? "bg-zinc-800 text-white font-medium"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
              )}
            >
              <Icon size={14} className={active ? "text-[#E8C468]" : "text-zinc-500"} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-zinc-800">
        <p className="text-[10px] text-zinc-600 leading-relaxed">
          For educational &amp; research purposes only. Not investment advice.
        </p>
      </div>
    </aside>
  );
}
