"use client";

import { useState, useEffect } from "react";

export default function Topbar() {
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const fredLive  = localStorage.getItem("crossasset_fred_live") === "true";
    const source    = localStorage.getItem("crossasset_issue_source");
    const issueLive = !!source && source !== "demo";
    setIsLive(fredLive || issueLive);
  }, []);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <header className="fixed top-0 left-56 right-0 h-[52px] bg-white border-b border-[#e8e8e8] flex items-center justify-between px-10 z-30">
      <span className="text-[12px] font-medium text-[#888]">{today}</span>
      <div className="flex items-center gap-5">
        <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#aaa]">Pre-Market</span>
        {isLive ? (
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.08em] uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            Live · FRED
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.08em] uppercase text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
            Demo
          </span>
        )}
      </div>
    </header>
  );
}
