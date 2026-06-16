"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";

// ── Types ──────────────────────────────────────────────────────────────────

type CalEvent = {
  date: string;
  time?: string;
  label: string;
  category: "fomc" | "cpi" | "jobs" | "gdp" | "earnings" | "other";
  impact: "high" | "medium" | "low";
  previous?: string;
  estimate?: string;
  actual?: string;
  cutProb?: number;
  holdProb?: number;
  hikeProb?: number;
  impliedRate?: number;
  ticker?: string;
};

// ── Static hardcoded 2026 economic calendar ──────────────────────────────
// Major US economic releases for the year, updated to known BLS/BEA/Fed schedules

const STATIC_EVENTS: CalEvent[] = [
  // FOMC
  { date: "2026-06-17", label: "FOMC Meeting",          category: "fomc",     impact: "high" },
  { date: "2026-07-29", label: "FOMC Meeting",          category: "fomc",     impact: "high" },
  { date: "2026-09-16", label: "FOMC Meeting",          category: "fomc",     impact: "high" },
  { date: "2026-10-28", label: "FOMC Meeting",          category: "fomc",     impact: "high" },
  { date: "2026-12-09", label: "FOMC Meeting",          category: "fomc",     impact: "high" },
  { date: "2027-01-27", label: "FOMC Meeting",          category: "fomc",     impact: "high" },
  { date: "2027-03-17", label: "FOMC Meeting",          category: "fomc",     impact: "high" },
  { date: "2027-04-28", label: "FOMC Meeting",          category: "fomc",     impact: "high" },
  // CPI
  { date: "2026-07-15", label: "CPI (Jun)",             category: "cpi",      impact: "high", previous: "2.4%" },
  { date: "2026-08-12", label: "CPI (Jul)",             category: "cpi",      impact: "high" },
  { date: "2026-09-11", label: "CPI (Aug)",             category: "cpi",      impact: "high" },
  { date: "2026-10-14", label: "CPI (Sep)",             category: "cpi",      impact: "high" },
  { date: "2026-11-12", label: "CPI (Oct)",             category: "cpi",      impact: "high" },
  { date: "2026-12-11", label: "CPI (Nov)",             category: "cpi",      impact: "high" },
  { date: "2027-01-14", label: "CPI (Dec)",             category: "cpi",      impact: "high" },
  // NFP
  { date: "2026-07-10", label: "Nonfarm Payrolls (Jun)",category: "jobs",     impact: "high", previous: "+139K" },
  { date: "2026-08-07", label: "Nonfarm Payrolls (Jul)",category: "jobs",     impact: "high" },
  { date: "2026-09-04", label: "Nonfarm Payrolls (Aug)",category: "jobs",     impact: "high" },
  { date: "2026-10-02", label: "Nonfarm Payrolls (Sep)",category: "jobs",     impact: "high" },
  { date: "2026-11-06", label: "Nonfarm Payrolls (Oct)",category: "jobs",     impact: "high" },
  { date: "2026-12-04", label: "Nonfarm Payrolls (Nov)",category: "jobs",     impact: "high" },
  { date: "2027-01-08", label: "Nonfarm Payrolls (Dec)",category: "jobs",     impact: "high" },
  // PCE
  { date: "2026-06-26", label: "PCE Price Index (May)", category: "cpi",      impact: "high", previous: "2.2%" },
  { date: "2026-07-31", label: "PCE Price Index (Jun)", category: "cpi",      impact: "high" },
  { date: "2026-08-28", label: "PCE Price Index (Jul)", category: "cpi",      impact: "high" },
  { date: "2026-09-25", label: "PCE Price Index (Aug)", category: "cpi",      impact: "high" },
  { date: "2026-10-30", label: "PCE Price Index (Sep)", category: "cpi",      impact: "high" },
  { date: "2026-11-25", label: "PCE Price Index (Oct)", category: "cpi",      impact: "high" },
  { date: "2026-12-23", label: "PCE Price Index (Nov)", category: "cpi",      impact: "high" },
  // GDP
  { date: "2026-07-30", label: "GDP Q2 Advance",        category: "gdp",      impact: "high", previous: "1.2%" },
  { date: "2026-10-29", label: "GDP Q3 Advance",        category: "gdp",      impact: "high" },
  { date: "2027-01-28", label: "GDP Q4 Advance",        category: "gdp",      impact: "high" },
  // Other high
  { date: "2026-06-18", label: "Retail Sales (May)",    category: "other",    impact: "medium", previous: "+0.1%" },
  { date: "2026-07-17", label: "Retail Sales (Jun)",    category: "other",    impact: "medium" },
  { date: "2026-08-14", label: "Retail Sales (Jul)",    category: "other",    impact: "medium" },
  { date: "2026-09-17", label: "Retail Sales (Aug)",    category: "other",    impact: "medium" },
  { date: "2026-10-16", label: "Retail Sales (Sep)",    category: "other",    impact: "medium" },
  { date: "2026-11-14", label: "Retail Sales (Oct)",    category: "other",    impact: "medium" },
  { date: "2026-12-12", label: "PPI (Nov)",             category: "cpi",      impact: "medium" },
];

// ── Category config ─────────────────────────────────────────────────────────

const CAT_CONFIG = {
  fomc:     { label: "FOMC",     color: "#0c1b38", bg: "#eef1f8", dot: "#0c1b38" },
  cpi:      { label: "Inflation",color: "#92400e", bg: "#fef9f0", dot: "#d97706" },
  jobs:     { label: "Jobs",     color: "#065f46", bg: "#f0fdf8", dot: "#059669" },
  gdp:      { label: "GDP",      color: "#5b21b6", bg: "#f5f3ff", dot: "#7c3aed" },
  earnings: { label: "Earnings", color: "#1e40af", bg: "#eff6ff", dot: "#3b82f6" },
  other:    { label: "Other",    color: "#374151", bg: "#f9fafb", dot: "#9ca3af" },
};

const IMPACT_COLORS = {
  high:   "bg-red-100 text-red-700 border border-red-200",
  medium: "bg-amber-50 text-amber-700 border border-amber-200",
  low:    "bg-gray-100 text-gray-500 border border-gray-200",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseDate(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00");
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function fmtDateLong(dateStr: string) {
  return parseDate(dateStr).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function fmtDateShort(dateStr: string) {
  return parseDate(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysFromNow(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = parseDate(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Calendar grid ────────────────────────────────────────────────────────────

function CalendarGrid({ events, selectedDate, onSelect }: {
  events: CalEvent[];
  selectedDate: string | null;
  onSelect: (d: string) => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay  = new Date(viewYear, viewMonth + 1, 0);
  const startPad = firstDay.getDay(); // 0=Sun
  const daysInMonth = lastDay.getDate();

  const eventsThisMonth = events.filter((e) => {
    const d = parseDate(e.date);
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
  });

  const eventsOnDay = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    return eventsThisMonth.filter((e) => isSameDay(parseDate(e.date), d));
  };

  const monthLabel = firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  return (
    <div>
      {/* Month nav */}
      <div className="mb-4 flex items-center justify-between">
        <button onClick={prevMonth} className="flex h-8 w-8 items-center justify-center border border-[#e8e3da] text-[#555] hover:border-[#0c1b38] hover:text-[#0c1b38]">‹</button>
        <p className="text-[13px] font-bold tracking-[0.1em] text-[#0a0a0a]">{monthLabel}</p>
        <button onClick={nextMonth} className="flex h-8 w-8 items-center justify-center border border-[#e8e3da] text-[#555] hover:border-[#0c1b38] hover:text-[#0c1b38]">›</button>
      </div>

      {/* Day headers */}
      <div className="mb-1 grid grid-cols-7 text-center">
        {DAYS.map((d) => (
          <div key={d} className="py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-[#aaa]">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px bg-[#e8e3da]">
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} className="bg-[#faf9f7] py-1" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const evs = eventsOnDay(day);
          const isToday = isSameDay(new Date(viewYear, viewMonth, day), today);
          const isSelected = dateStr === selectedDate;
          const hasHigh = evs.some(e => e.impact === "high");

          return (
            <button
              key={day}
              onClick={() => onSelect(dateStr)}
              className={`group relative min-h-[52px] bg-white p-1.5 text-left transition-all hover:bg-[#f5f3ff] ${isSelected ? "ring-1 ring-inset ring-[#0c1b38]" : ""}`}
            >
              <span className={`flex h-5 w-5 items-center justify-center text-[11px] font-bold
                ${isToday ? "rounded-full bg-[#0c1b38] text-white" : "text-[#555]"}`}>
                {day}
              </span>
              {evs.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {evs.slice(0, 3).map((e, idx) => (
                    <span
                      key={idx}
                      className="h-[5px] w-[5px] rounded-full"
                      style={{ background: CAT_CONFIG[e.category].dot }}
                    />
                  ))}
                  {evs.length > 3 && <span className="text-[8px] text-[#aaa]">+{evs.length - 3}</span>}
                </div>
              )}
              {hasHigh && (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3">
        {Object.entries(CAT_CONFIG).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: v.dot }} />
            <span className="text-[9.5px] font-medium text-[#777]">{v.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Event card ───────────────────────────────────────────────────────────────

function EventCard({ event }: { event: CalEvent }) {
  const cfg = CAT_CONFIG[event.category];
  const days = daysFromNow(event.date);

  return (
    <div className="border border-[#e8e3da] bg-white p-4 transition-all hover:border-[#0c1b38]">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cfg.dot }} />
          <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${IMPACT_COLORS[event.impact]}`}>
            {event.impact}
          </span>
          {days === 0 && <span className="rounded bg-[#0c1b38] px-1.5 py-0.5 text-[9px] font-bold text-white">TODAY</span>}
          {days > 0 && days <= 7 && <span className="text-[10px] font-semibold text-[#0c1b38]">in {days}d</span>}
        </div>
      </div>

      <p className="mb-1 text-[13px] font-bold text-[#0a0a0a]">{event.label}</p>
      <p className="mb-3 text-[10.5px] font-medium text-[#888]">{fmtDateLong(event.date)}</p>

      {/* FOMC probs */}
      {event.category === "fomc" && event.cutProb != null && (
        <div className="mb-3 grid grid-cols-3 gap-2">
          {[
            { label: "Cut −25bps", val: event.cutProb, color: "#059669" },
            { label: "Hold",       val: event.holdProb!, color: "#555" },
            { label: "Hike +25bps",val: event.hikeProb!, color: "#dc2626" },
          ].map(({ label, val, color }) => (
            <div key={label} className="rounded border border-[#e8e3da] p-2 text-center">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#999]">{label}</p>
              <p className="mt-0.5 text-[16px] font-bold tabular-nums" style={{ color }}>{val.toFixed(1)}%</p>
            </div>
          ))}
        </div>
      )}
      {event.category === "fomc" && event.impliedRate != null && (
        <p className="text-[10.5px] text-[#888]">
          Implied rate post-meeting: <span className="font-bold text-[#0a0a0a]">{event.impliedRate.toFixed(3)}%</span>
        </p>
      )}

      {/* Data readings */}
      {(event.previous || event.estimate || event.actual) && (
        <div className="flex gap-4 border-t border-[#f0ece5] pt-3">
          {event.previous && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wide text-[#aaa]">Previous</p>
              <p className="text-[12px] font-semibold tabular-nums text-[#555]">{event.previous}</p>
            </div>
          )}
          {event.estimate && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wide text-[#aaa]">Estimate</p>
              <p className="text-[12px] font-bold tabular-nums text-[#0a0a0a]">{event.estimate}</p>
            </div>
          )}
          {event.actual && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wide text-[#aaa]">Actual</p>
              <p className="text-[12px] font-bold tabular-nums text-[#059669]">{event.actual}</p>
            </div>
          )}
        </div>
      )}

      {/* Earnings */}
      {event.category === "earnings" && event.ticker && (
        <span className="inline-block rounded border border-[#dbeafe] bg-[#eff6ff] px-2 py-0.5 text-[10px] font-bold text-[#1e40af]">
          {event.ticker}
        </span>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

type LiveData = {
  fedwatch?: { date: string; label: string; cutProb: number; holdProb: number; hikeProb: number; impliedRate: number }[];
  econCalendar?: { event: string; date: string; impact: string; estimate?: string; previous?: string; actual?: string }[];
  earnings?: { symbol: string; date: string }[];
};

export default function CalendarPage() {
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filter, setFilter] = useState<CalEvent["category"] | "all">("all");
  const [view, setView] = useState<"upcoming" | "calendar">("upcoming");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/dashboard-data");
      if (!r.ok) return;
      const d = await r.json();
      setLiveData({ fedwatch: d.fedwatch, econCalendar: d.econCalendar, earnings: d.earnings });
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Merge static + live events
  const allEvents: CalEvent[] = (() => {
    const evs = [...STATIC_EVENTS];

    // Enrich FOMC events with live FedWatch probabilities
    if (liveData?.fedwatch) {
      for (const fw of liveData.fedwatch) {
        const idx = evs.findIndex((e) => e.date === fw.date && e.category === "fomc");
        if (idx >= 0) {
          evs[idx] = { ...evs[idx], cutProb: fw.cutProb, holdProb: fw.holdProb, hikeProb: fw.hikeProb, impliedRate: fw.impliedRate };
        }
      }
    }

    // Add live economic events from ForexFactory (this week)
    if (liveData?.econCalendar) {
      for (const e of liveData.econCalendar) {
        const dateStr = e.date?.split("T")[0] ?? "";
        if (!dateStr) continue;
        const already = evs.some((x) => x.date === dateStr && x.label.toLowerCase().includes(e.event.toLowerCase().substring(0, 8)));
        if (!already) {
          evs.push({
            date:     dateStr,
            label:    e.event,
            category: e.event.toLowerCase().includes("fomc") ? "fomc"
              : e.event.toLowerCase().includes("cpi") || e.event.toLowerCase().includes("pce") || e.event.toLowerCase().includes("inflation") ? "cpi"
              : e.event.toLowerCase().includes("payroll") || e.event.toLowerCase().includes("unemployment") || e.event.toLowerCase().includes("job") ? "jobs"
              : e.event.toLowerCase().includes("gdp") ? "gdp"
              : "other",
            impact:   (e.impact === "High" ? "high" : e.impact === "Medium" ? "medium" : "low") as "high" | "medium" | "low",
            estimate: e.estimate,
            previous: e.previous,
            actual:   (e as { actual?: string }).actual,
          });
        }
      }
    }

    // Add earnings
    if (liveData?.earnings) {
      for (const e of liveData.earnings) {
        if (!e.date) continue;
        evs.push({ date: e.date, label: `${e.symbol} Earnings`, category: "earnings", impact: "medium", ticker: e.symbol });
      }
    }

    return evs.sort((a, b) => a.date.localeCompare(b.date));
  })();

  const today = new Date().toISOString().split("T")[0];

  const upcomingEvents = allEvents
    .filter((e) => e.date >= today)
    .filter((e) => filter === "all" || e.category === filter)
    .slice(0, 40);

  const selectedDayEvents = selectedDate
    ? allEvents.filter((e) => e.date === selectedDate)
    : [];

  // Next high-impact event
  const nextBig = allEvents.find((e) => e.date >= today && e.impact === "high");

  return (
    <AppShell>
      <div className="pb-16">

        {/* ── Banner ─────────────────────────────────────────────────────── */}
        <div className="-mx-10 -mt-10 mb-8 bg-[#0c1b38] px-10 py-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/40">CrossAsset</p>
              <h1 className="mt-1 text-[22px] font-light tracking-tight text-white" style={{ fontFamily: "var(--font-serif)" }}>
                Macro Calendar
              </h1>
              <p className="mt-1 text-[11px] text-white/40">
                FOMC meetings · Economic releases · Earnings
              </p>
            </div>
            {nextBig && (
              <div className="border border-white/20 bg-white/[0.06] px-5 py-3 text-right">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">Next High-Impact</p>
                <p className="mt-1 text-[13px] font-bold text-white">{nextBig.label}</p>
                <p className="mt-0.5 text-[10.5px] text-white/50">{fmtDateShort(nextBig.date)} · {daysFromNow(nextBig.date) === 0 ? "Today" : `in ${daysFromNow(nextBig.date)} days`}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Controls ───────────────────────────────────────────────────── */}
        <div className="mb-6 flex items-center justify-between">
          {/* View toggle */}
          <div className="flex gap-1">
            {(["upcoming", "calendar"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`border px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors
                  ${view === v ? "border-[#0c1b38] bg-[#0c1b38] text-white" : "border-[#e8e3da] text-[#777] hover:border-[#0c1b38] hover:text-[#0c1b38]"}`}>
                {v === "upcoming" ? "Agenda" : "Calendar"}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setFilter("all")}
              className={`border px-3 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.12em] transition-colors
                ${filter === "all" ? "border-[#0c1b38] bg-[#0c1b38] text-white" : "border-[#e8e3da] text-[#777] hover:border-[#0c1b38]"}`}>
              All
            </button>
            {Object.entries(CAT_CONFIG).map(([k, v]) => (
              <button key={k} onClick={() => setFilter(k as CalEvent["category"])}
                className={`border px-3 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.12em] transition-colors
                  ${filter === k ? "text-white" : "border-[#e8e3da] text-[#777] hover:border-[#0c1b38]"}`}
                style={filter === k ? { background: v.dot, borderColor: v.dot } : {}}>
                {v.label}
              </button>
            ))}
          </div>

          <button onClick={load} disabled={loading}
            className="border border-[#e8e3da] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#777] hover:border-[#0c1b38] hover:text-[#0c1b38] disabled:opacity-40">
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </div>

        {view === "calendar" ? (
          /* ── Calendar + detail view ── */
          <div className="grid grid-cols-[1fr_380px] gap-6">
            <div className="border border-[#e8e3da] bg-white p-6">
              <CalendarGrid events={allEvents} selectedDate={selectedDate} onSelect={setSelectedDate} />
            </div>
            <div className="space-y-3">
              {selectedDate ? (
                <>
                  <div className="mb-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0c1b38]">
                      {parseDate(selectedDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    </p>
                    <p className="text-[11px] text-[#aaa]">{selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? "s" : ""}</p>
                  </div>
                  {selectedDayEvents.length === 0
                    ? <div className="border border-[#e8e3da] bg-white p-6 text-center text-[12px] text-[#bbb]">No events scheduled</div>
                    : selectedDayEvents.map((e, i) => <EventCard key={i} event={e} />)
                  }
                </>
              ) : (
                <div className="border border-[#e8e3da] bg-white p-8 text-center">
                  <p className="text-[12px] text-[#bbb]">Click a date to see events</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Agenda list ── */
          <div className="grid grid-cols-[1fr_340px] gap-6">
            {/* Left: grouped event list */}
            <div className="space-y-0">
              {loading && (
                <div className="flex items-center justify-center py-16">
                  <p className="text-[11px] uppercase tracking-widest text-[#bbb]">Loading events…</p>
                </div>
              )}
              {!loading && upcomingEvents.length === 0 && (
                <div className="py-12 text-center text-[12px] text-[#bbb]">No upcoming events in this category</div>
              )}
              {upcomingEvents.map((event, i) => {
                const cfg = CAT_CONFIG[event.category];
                const days = daysFromNow(event.date);
                const prevEvent = i > 0 ? upcomingEvents[i - 1] : null;
                const showDateDivider = !prevEvent || prevEvent.date !== event.date;
                return (
                  <div key={`${event.date}-${i}`}>
                    {showDateDivider && (
                      <div className={`flex items-center gap-3 ${i > 0 ? "mt-4" : ""} mb-1`}>
                        <p className="text-[10.5px] font-bold text-[#0a0a0a]">
                          {parseDate(event.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        </p>
                        {days === 0 && <span className="rounded bg-[#0c1b38] px-1.5 py-0.5 text-[8px] font-bold uppercase text-white">Today</span>}
                        {days === 1 && <span className="text-[10px] font-semibold text-[#0c1b38]">Tomorrow</span>}
                        {days > 1 && days <= 7 && <span className="text-[10px] text-[#888]">in {days} days</span>}
                      </div>
                    )}
                    <div className={`flex gap-0 border border-b-0 border-[#e8e3da] bg-white transition-all last:border-b hover:bg-[#faf9f7] ${event.impact === "high" ? "border-l-[3px]" : ""}`}
                      style={{ borderLeftColor: event.impact === "high" ? cfg.dot : undefined }}>
                      {/* Category stripe */}
                      <div className="flex w-28 shrink-0 flex-col items-center justify-center border-r border-[#f0ece5] py-3"
                        style={{ background: cfg.bg }}>
                        <span className="h-2 w-2 rounded-full mb-1" style={{ background: cfg.dot }} />
                        <p className="text-[8.5px] font-bold uppercase tracking-[0.12em]" style={{ color: cfg.color }}>{cfg.label}</p>
                      </div>

                      {/* Content */}
                      <div className="flex flex-1 items-center gap-6 px-5 py-3">
                        <div className="flex-1">
                          <p className="text-[12.5px] font-bold text-[#0a0a0a]">{event.label}</p>
                          {event.category === "fomc" && event.cutProb != null && (
                            <p className="mt-0.5 text-[10.5px] text-[#888]">
                              Cut <span className="font-bold text-[#059669]">{event.cutProb.toFixed(0)}%</span>
                              {" · "}Hold <span className="font-bold text-[#555]">{event.holdProb!.toFixed(0)}%</span>
                              {" · "}Hike <span className="font-bold text-[#dc2626]">{event.hikeProb!.toFixed(0)}%</span>
                              {" · "}Impl. <span className="font-bold">{event.impliedRate!.toFixed(3)}%</span>
                            </p>
                          )}
                        </div>
                        {/* Readings */}
                        <div className="flex gap-4 text-right shrink-0">
                          {event.actual && (
                            <div>
                              <p className="text-[8.5px] font-bold uppercase tracking-wide text-[#aaa]">Actual</p>
                              <p className="text-[12px] font-bold text-[#059669]">{event.actual}</p>
                            </div>
                          )}
                          {event.estimate && !event.actual && (
                            <div>
                              <p className="text-[8.5px] font-bold uppercase tracking-wide text-[#aaa]">Est.</p>
                              <p className="text-[12px] font-semibold text-[#0a0a0a]">{event.estimate}</p>
                            </div>
                          )}
                          {event.previous && (
                            <div>
                              <p className="text-[8.5px] font-bold uppercase tracking-wide text-[#aaa]">Prev.</p>
                              <p className="text-[12px] text-[#777]">{event.previous}</p>
                            </div>
                          )}
                        </div>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ${IMPACT_COLORS[event.impact]}`}>
                          {event.impact}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: summary stats + next FOMC detail */}
            <div className="space-y-4">
              {/* This week count */}
              <div className="border border-[#e8e3da] bg-white p-5">
                <p className="mb-3 text-[9.5px] font-bold uppercase tracking-[0.2em] text-[#0c1b38]">Next 30 Days</p>
                <div className="space-y-2">
                  {Object.entries(CAT_CONFIG).map(([k, v]) => {
                    const count = allEvents.filter(e => {
                      const d = daysFromNow(e.date);
                      return e.category === k && d >= 0 && d <= 30;
                    }).length;
                    if (count === 0) return null;
                    return (
                      <div key={k} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: v.dot }} />
                          <span className="text-[11px] text-[#555]">{v.label}</span>
                        </div>
                        <span className="text-[11px] font-bold text-[#0a0a0a]">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Next FOMC deep dive */}
              {(() => {
                const nextFomc = allEvents.find(e => e.category === "fomc" && e.date >= today);
                if (!nextFomc) return null;
                const d = daysFromNow(nextFomc.date);
                return (
                  <div className="border border-[#0c1b38] bg-[#0c1b38] p-5 text-white">
                    <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.25em] text-white/40">Next FOMC</p>
                    <p className="text-[14px] font-bold">{nextFomc.label}</p>
                    <p className="mt-0.5 text-[10.5px] text-white/50">
                      {fmtDateLong(nextFomc.date)} · {d === 0 ? "Today" : `in ${d} days`}
                    </p>
                    {nextFomc.cutProb != null ? (
                      <div className="mt-4 space-y-2">
                        {[
                          { label: "Cut −25bps", val: nextFomc.cutProb, color: "#34d399" },
                          { label: "Hold",       val: nextFomc.holdProb!, color: "#94a3b8" },
                          { label: "Hike +25bps",val: nextFomc.hikeProb!, color: "#f87171" },
                        ].map(({ label, val, color }) => (
                          <div key={label}>
                            <div className="mb-0.5 flex justify-between">
                              <span className="text-[10px] text-white/60">{label}</span>
                              <span className="text-[10px] font-bold" style={{ color }}>{val.toFixed(1)}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-white/10">
                              <div className="h-full rounded-full transition-all" style={{ width: `${val}%`, background: color }} />
                            </div>
                          </div>
                        ))}
                        <p className="mt-3 text-[9.5px] text-white/35">
                          Implied rate: {nextFomc.impliedRate?.toFixed(3)}% · Source: CME ZQ Futures
                        </p>
                      </div>
                    ) : (
                      <p className="mt-3 text-[10px] text-white/40">FedWatch data loading…</p>
                    )}
                  </div>
                );
              })()}

              {/* High-impact events this month */}
              <div className="border border-[#e8e3da] bg-white p-5">
                <p className="mb-3 text-[9.5px] font-bold uppercase tracking-[0.2em] text-[#0c1b38]">High Impact This Month</p>
                <div className="space-y-2">
                  {allEvents
                    .filter(e => {
                      const d = parseDate(e.date);
                      const n = new Date();
                      return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear() && e.impact === "high";
                    })
                    .map((e, i) => {
                      const cfg = CAT_CONFIG[e.category];
                      const d = daysFromNow(e.date);
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: cfg.dot }} />
                          <div className="flex-1">
                            <p className="text-[11px] font-semibold text-[#0a0a0a]">{e.label}</p>
                            <p className="text-[9.5px] text-[#aaa]">
                              {fmtDateShort(e.date)}{d < 0 ? " · past" : d === 0 ? " · today" : ""}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
