"use client";

import AppShell from "@/components/layout/AppShell";
import { DEMO_CALENDAR } from "@/lib/data/demoData";
import { CalendarDays, Download, Plus } from "lucide-react";

function generateICS(event: (typeof DEMO_CALENDAR)[0]): string {
  const dt = event.date.replace(/-/g, "");
  const uid = `crossasset-${event.id}@crossasset.app`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CrossAsset//MacroCalendar//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART;VALUE=DATE:${dt}`,
    `DTEND;VALUE=DATE:${dt}`,
    `SUMMARY:${event.eventName}`,
    `DESCRIPTION:${event.whyItMatters.replace(/\n/g, "\\n")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function downloadICS(event: (typeof DEMO_CALENDAR)[0]) {
  const content = generateICS(event);
  const blob = new Blob([content], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.eventName.replace(/\s+/g, "_")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

const ASSET_COLORS: Record<string, string> = {
  Rates: "bg-blue-950 text-blue-400",
  Equities: "bg-violet-950 text-violet-400",
  USD: "bg-cyan-950 text-cyan-400",
  "Consumer Discretionary": "bg-purple-950 text-purple-400",
  Credit: "bg-pink-950 text-pink-400",
  "Real Estate": "bg-orange-950 text-orange-400",
  TIPS: "bg-teal-950 text-teal-400",
};

function assetColor(a: string): string {
  return ASSET_COLORS[a] ?? "bg-zinc-800 text-zinc-400";
}

export default function CalendarPage() {
  const events = DEMO_CALENDAR;

  return (
    <AppShell>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Macro Calendar</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Upcoming economic releases and Fed events with cross-asset context.</p>
        </div>
      </div>

      <div className="space-y-3">
        {events.map((event) => {
          const dateObj = new Date(event.date + "T12:00:00");
          const day = dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

          return (
            <div key={event.id} className="bg-zinc-950 border border-zinc-800 rounded-md p-4 flex gap-5">
              {/* Date column */}
              <div className="flex-shrink-0 w-24">
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mb-1">
                  <CalendarDays size={10} />
                  <span>{day}</span>
                </div>
                {event.previousReading && (
                  <div className="mt-2">
                    <p className="text-[10px] text-zinc-600">Previous</p>
                    <p className="text-xs text-zinc-400 font-mono">{event.previousReading}</p>
                  </div>
                )}
                {event.forecast && (
                  <div className="mt-1">
                    <p className="text-[10px] text-zinc-600">Forecast</p>
                    <p className="text-xs text-zinc-300 font-mono">{event.forecast}</p>
                  </div>
                )}
                {event.actual && (
                  <div className="mt-1">
                    <p className="text-[10px] text-zinc-600">Actual</p>
                    <p className="text-xs font-mono font-semibold text-emerald-400">{event.actual}</p>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white mb-1">{event.eventName}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed mb-2">{event.whyItMatters}</p>
                <div className="flex flex-wrap gap-1">
                  {event.assetsAffected.map((a) => (
                    <span key={a} className={`text-[10px] px-1.5 py-0.5 rounded ${assetColor(a)}`}>
                      {a}
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex-shrink-0 flex flex-col gap-2">
                <button
                  onClick={() => downloadICS(event)}
                  className="flex items-center gap-1.5 text-[10px] border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 px-2.5 py-1.5 rounded transition-colors"
                >
                  <Download size={10} /> .ics
                </button>
                <button className="flex items-center gap-1.5 text-[10px] border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 px-2.5 py-1.5 rounded transition-colors">
                  <Plus size={10} /> Task
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-zinc-700 mt-6 text-center">
        Calendar events are illustrative. Dates reflect upcoming economic releases as of brief date. Always verify against official release schedules.
      </p>
    </AppShell>
  );
}
