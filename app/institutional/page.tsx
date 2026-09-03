"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { Command } from "lucide-react";
import type { ManagerListItem, ConsensusRow } from "@/lib/institutional/types";
import ManagersView from "@/components/institutional/ManagersView";
import SecurityView from "@/components/institutional/SecurityView";
import ConsensusView from "@/components/institutional/ConsensusView";
import SuperinvestorsView from "@/components/institutional/SuperinvestorsView";
import CommandPalette from "@/components/institutional/CommandPalette";
import { ACTION_META } from "@/components/institutional/shared";

type View = "managers" | "security" | "consensus" | "superinvestors";
const TABS: { id: View; label: string }[] = [
  { id: "managers", label: "Managers" },
  { id: "security", label: "Security" },
  { id: "consensus", label: "Consensus" },
  { id: "superinvestors", label: "Superinvestors" },
];

export default function InstitutionalPage() {
  const [view, setView] = useState<View>("managers");
  const [managers, setManagers] = useState<ManagerListItem[]>([]);
  const [tape, setTape] = useState<ConsensusRow[]>([]);
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    fetch("/api/institutional/managers").then((r) => r.json()).then((d) => setManagers(d.managers ?? []));
    fetch("/api/institutional/consensus?limit=20").then((r) => r.json()).then((d) => setTape(d.rows ?? []));
  }, []);

  // Deep-linking: sync view + selection to the URL hash (#managers/berkshire, #security/NVDA)
  useEffect(() => {
    const h = window.location.hash.replace(/^#/, "");
    const [v, arg] = h.split("/");
    if (["managers", "security", "consensus", "superinvestors"].includes(v)) setView(v as View);
    if (v === "managers" && arg) setSelectedManager(arg);
    if (v === "security" && arg) setSelectedTicker(arg.toUpperCase());
  }, []);

  useEffect(() => {
    let hash = `#${view}`;
    if (view === "managers" && selectedManager) hash += `/${selectedManager}`;
    if (view === "security" && selectedTicker) hash += `/${selectedTicker}`;
    if (window.location.hash !== hash) history.replaceState(null, "", hash);
  }, [view, selectedManager, selectedTicker]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function pickManager(slug: string) { setSelectedManager(slug); setView("managers"); }
  function pickTicker(t: string) { setSelectedTicker(t); setView("security"); }

  return (
    <AppShell>
      {/* header */}
      <div className="mb-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.14em] uppercase mb-2" style={{ color: "var(--ca-text-2)" }}>Institutional Intelligence</p>
            <h1 className="text-[34px] font-light tracking-tight" style={{ fontFamily: "var(--font-serif)", color: "var(--ca-text)" }}>Smart Money</h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--ca-text-3)" }}>13F holdings, quarter-over-quarter conviction, and insider fusion — across the funds that move markets.</p>
          </div>
          <button onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[12px] font-medium inst-card-hover"
            style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)", color: "var(--ca-text-2)" }}>
            <Command size={13} /> Jump to… <kbd className="text-[10px] px-1.5 py-0.5 rounded ml-1" style={{ background: "var(--ca-surface-2)" }}>⌘K</kbd>
          </button>
        </div>
      </div>

      {/* smart-money tape */}
      {tape.length > 0 && <Tape rows={tape} onPick={pickTicker} />}

      {/* tabs */}
      <div className="flex items-center gap-1 mb-6 mt-6" style={{ borderBottom: "1px solid var(--ca-border)" }}>
        {TABS.map((t) => {
          const active = view === t.id;
          return (
            <button key={t.id} onClick={() => setView(t.id)}
              className="relative px-4 py-2.5 text-[13px] font-medium transition-colors"
              style={{ color: active ? "var(--ca-text)" : "var(--ca-text-3)" }}>
              {t.label}
              {active && <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] rounded-full inst-scale-in" style={{ background: "var(--ca-accent)" }} />}
            </button>
          );
        })}
      </div>

      {/* views */}
      {view === "managers" && <ManagersView managers={managers} selected={selectedManager} onSelect={setSelectedManager} onPickTicker={pickTicker} />}
      {view === "security" && <SecurityView ticker={selectedTicker} onPickManager={pickManager} />}
      {view === "consensus" && <ConsensusView onPickTicker={pickTicker} />}
      {view === "superinvestors" && <SuperinvestorsView onPickManager={pickManager} onPickTicker={pickTicker} />}

      {/* footnote */}
      <p className="text-[10.5px] mt-10 pt-5" style={{ color: "var(--ca-text-3)", borderTop: "1px solid var(--ca-border)" }}>
        13F reports long positions in US-listed 13(f) securities only (no shorts, cash, or non-US holdings) and is filed up to 45 days after quarter-end. Data is for research, not investment advice.
      </p>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} managers={managers} onPickManager={pickManager} onPickTicker={pickTicker} />
    </AppShell>
  );
}

function Tape({ rows, onPick }: { rows: ConsensusRow[]; onPick: (t: string) => void }) {
  const doubled = useMemo(() => [...rows, ...rows], [rows]);
  return (
    <div className="relative overflow-hidden rounded-xl py-2.5" style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)" }}>
      <div className="inst-marquee-track">
        {doubled.map((r, i) => {
          const up = r.consensusScore >= 0;
          const m = up ? ACTION_META.ADD : ACTION_META.EXIT;
          return (
            <button key={i} onClick={() => onPick(r.ticker)} className="inline-flex items-center gap-2 px-4 whitespace-nowrap">
              <span className="text-[12px] font-bold" style={{ color: "var(--ca-text)" }}>{r.ticker}</span>
              <span className="text-[11px] font-semibold tabular-nums" style={{ color: m.fg }}>
                {up ? "▲" : "▼"} {r.buyers}/{r.sellers}
              </span>
              <span className="text-[10px]" style={{ color: "var(--ca-text-3)" }}>·</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
