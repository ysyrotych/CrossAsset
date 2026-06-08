"use client";
import AppShell from "@/components/layout/AppShell";
import { DEMO_CALENDAR } from "@/lib/data/demoData";
import { Download } from "lucide-react";

function generateICS(event: (typeof DEMO_CALENDAR)[0]) {
  const dt = event.date.replace(/-/g, "");
  return ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//CrossAsset//EN","BEGIN:VEVENT",
    `UID:crossasset-${event.id}@crossasset.app`,`DTSTART;VALUE=DATE:${dt}`,`DTEND;VALUE=DATE:${dt}`,
    `SUMMARY:${event.eventName}`,`DESCRIPTION:${event.whyItMatters.replace(/\n/g,"\\n")}`,
    "END:VEVENT","END:VCALENDAR"].join("\r\n");
}

function downloadICS(event: (typeof DEMO_CALENDAR)[0]) {
  const blob = new Blob([generateICS(event)], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${event.eventName.replace(/\s+/g,"_")}.ics`; a.click();
  URL.revokeObjectURL(url);
}

const ASSET_TAG = "text-[10px] px-2 py-0.5 border border-[#e0e7ff] text-[#0f2044] rounded-full";

export default function CalendarPage() {
  return (
    <AppShell>
      <div className="mb-10 pb-8 border-b border-[#ebebeb]">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#0f2044] mb-3">Calendar</p>
        <h1 className="text-[34px] font-light text-[#0a0a0a] tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>Macro Calendar</h1>
        <p className="text-[13px] text-[#9ca3af] mt-1">Upcoming economic events and key releases.</p>
      </div>

      <div className="space-y-0 border border-[#ebebeb] rounded-md overflow-hidden">
        {DEMO_CALENDAR.map((event, i) => {
          const dateObj = new Date(event.date + "T12:00:00");
          const day = dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
          const month = dateObj.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
          const dayNum = dateObj.getDate();

          return (
            <div key={event.id} className={`flex gap-0 ${i > 0 ? "border-t border-[#f0f0f0]" : ""} hover:bg-[#fafafa] transition-colors`}>
              {/* Date column */}
              <div className="w-20 shrink-0 flex flex-col items-center justify-center py-5 border-r border-[#f0f0f0]">
                <p className="text-[10px] font-semibold text-[#0f2044] uppercase tracking-wider">{month}</p>
                <p className="text-2xl font-light text-[#0a0a0a] leading-none mt-0.5">{dayNum}</p>
              </div>

              {/* Content */}
              <div className="flex-1 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-[#0a0a0a] mb-1">{event.eventName}</p>
                    <p className="text-[12px] text-[#6b7280] leading-relaxed mb-3">{event.whyItMatters}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {event.assetsAffected.map(a => <span key={a} className={ASSET_TAG}>{a}</span>)}
                    </div>
                  </div>

                  {/* Readings */}
                  <div className="flex gap-6 shrink-0 text-right">
                    {event.previousReading && (
                      <div>
                        <p className="text-[10px] text-[#9ca3af] uppercase tracking-wider mb-0.5">Previous</p>
                        <p className="text-[13px] font-mono text-[#6b7280]">{event.previousReading}</p>
                      </div>
                    )}
                    {event.forecast && (
                      <div>
                        <p className="text-[10px] text-[#9ca3af] uppercase tracking-wider mb-0.5">Forecast</p>
                        <p className="text-[13px] font-mono font-medium text-[#0a0a0a]">{event.forecast}</p>
                      </div>
                    )}
                    {event.actual && (
                      <div>
                        <p className="text-[10px] text-[#9ca3af] uppercase tracking-wider mb-0.5">Actual</p>
                        <p className="text-[13px] font-mono font-semibold text-green-600">{event.actual}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="flex items-center px-5 border-l border-[#f0f0f0]">
                <button onClick={() => downloadICS(event)}
                  className="flex items-center gap-1.5 text-[11px] text-[#9ca3af] hover:text-[#0f2044] transition-colors">
                  <Download size={12} /> .ics
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-[#d1d5db] mt-6 text-center">
        Dates are illustrative. Verify against official release schedules before use.
      </p>
    </AppShell>
  );
}
