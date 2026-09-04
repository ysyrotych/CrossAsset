"use client";

// Fed Summary of Economic Projections (SEP) — public quarterly release, seeded
// from the latest FOMC dot plot. Refresh 4x/year (Mar, Jun, Sep, Dec).
const SEP: { variable: string; vals: (number | null)[]; prior: (number | null)[] }[] = [
  { variable: "GDP growth",       vals: [2.4, 2.3, 2.1, 2.0], prior: [2.3, 2.0, 1.9, 1.8] },
  { variable: "Unemployment",     vals: [4.4, 4.3, 4.2, 4.2], prior: [4.4, 4.2, 4.2, 4.2] },
  { variable: "PCE inflation",    vals: [2.7, 2.2, 2.0, 2.0], prior: [2.4, 2.1, 2.1, 2.0] },
  { variable: "Core PCE",         vals: [2.7, 2.2, 2.1, null], prior: [2.5, 2.1, 2.1, null] },
  { variable: "Fed funds",        vals: [3.4, 3.1, 3.1, 3.1], prior: [3.4, 3.1, 3.1, 3.0] },
];
const COLS = ["’26", "’27", "’28", "LR"];

export default function FedSEPTable() {
  return (
    <div className="rounded-xl overflow-hidden mb-4 macro-section" style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)" }}>
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: "var(--ca-accent)" }}>
        <p className="text-[12px] font-bold text-white tracking-wide">Fed March Forecast Highlights (SEP)</p>
        <span className="text-[9.5px] text-white/60">bold = latest · muted = prior projection</span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--ca-text-3)" }}>
            <th className="text-left px-4 py-2">Variable</th>
            {COLS.map((c) => <th key={c} className="text-right px-4 py-2 tabular-nums">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {SEP.map((row, i) => (
            <tr key={row.variable} className="border-t" style={{ borderColor: "var(--ca-border)", background: i % 2 ? "var(--ca-surface-2)" : "transparent" }}>
              <td className="px-4 py-2 text-[12.5px] font-medium" style={{ color: "var(--ca-text)" }}>{row.variable}</td>
              {row.vals.map((v, j) => {
                const prior = row.prior[j];
                const up = v != null && prior != null && v > prior;
                const dn = v != null && prior != null && v < prior;
                return (
                  <td key={j} className="px-4 py-2 text-right">
                    <span className="text-[13px] font-semibold tabular-nums" style={{ color: up ? "#147a4f" : dn ? "#b42318" : "var(--ca-text)" }}>
                      {v != null ? v.toFixed(1) : "—"}
                    </span>
                    {prior != null && <span className="text-[9.5px] tabular-nums ml-1.5" style={{ color: "var(--ca-text-3)" }}>({prior.toFixed(1)})</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
