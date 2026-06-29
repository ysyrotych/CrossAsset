import AppShell from "@/components/layout/AppShell";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#0c1b38]">{children}</p>
  );
}

function KeyStatus({ label, configured, optional = false }: { label: string; configured: boolean; optional?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#ebebeb] last:border-0">
      <div>
        <p className="text-[13px] text-[#0a0a0a]">{label}</p>
        {optional && <p className="text-[11px] text-[#bbb] mt-0.5">Optional</p>}
      </div>
      <div className="flex items-center gap-1.5">
        {configured ? (
          <>
            <CheckCircle2 size={13} className="text-[#147a4f]" />
            <span className="text-[11px] text-[#147a4f] font-medium">Configured</span>
          </>
        ) : (
          <>
            <XCircle size={13} className={optional ? "text-[#ccc]" : "text-amber-500"} />
            <span className={`text-[11px] font-medium ${optional ? "text-[#bbb]" : "text-amber-600"}`}>
              {optional ? "Not set" : "Required for live data"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const hasAnthropic   = !!process.env.ANTHROPIC_API_KEY;
  const hasFred        = !!process.env.FRED_API_KEY;
  const hasFinnhub     = !!process.env.FINNHUB_API_KEY;
  const hasBls         = !!process.env.BLS_API_KEY;
  const hasBea         = !!process.env.BEA_API_KEY;
  const hasSupabase    = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const allRequired    = hasAnthropic && hasFred && hasFinnhub;

  return (
    <AppShell>
      <div className="mb-10 pb-8 border-b border-[#ebebeb]">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#0c1b38] mb-3">Configuration</p>
        <h1 className="text-[34px] font-light text-[#0a0a0a] tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>Settings</h1>
        <p className="text-[13px] text-[#9ca3af] mt-1">API keys, data sources, and preferences.</p>
      </div>

      <div className="max-w-2xl space-y-6">

        {/* Status banner */}
        <div className={`flex items-start gap-3 border rounded-md px-4 py-3 ${allRequired ? "border-[#c3e6cd] bg-[#f4fbf6]" : "border-amber-200 bg-amber-50"}`}>
          <AlertCircle size={14} className={`flex-shrink-0 mt-0.5 ${allRequired ? "text-[#147a4f]" : "text-amber-500"}`} />
          <div>
            <p className="text-[12px] font-semibold text-[#0a0a0a] mb-0.5">
              {allRequired ? "Live mode active" : "Demo mode — configure API keys for live data"}
            </p>
            <p className="text-[11.5px] text-[#777] leading-relaxed">
              {allRequired
                ? "All required keys are set. The app is fetching live macro data and generating AI briefs."
                : "Missing one or more required API keys. The app falls back to demo data. Add keys to .env.local on Vercel."}
            </p>
          </div>
        </div>

        {/* API Key Status */}
        <div className="border border-[#ebebeb] rounded-md">
          <div className="px-5 py-3 border-b border-[#ebebeb]">
            <SectionLabel>API Key Status</SectionLabel>
          </div>
          <div className="px-5 py-1">
            <KeyStatus label="Anthropic (Claude AI)" configured={hasAnthropic} />
            <KeyStatus label="FRED — Federal Reserve economic data" configured={hasFred} />
            <KeyStatus label="Finnhub — equities, forex, crypto" configured={hasFinnhub} />
            <KeyStatus label="BLS — labor statistics" configured={hasBls} optional />
            <KeyStatus label="BEA — GDP & income data" configured={hasBea} optional />
            <KeyStatus label="Supabase — issue persistence" configured={hasSupabase} optional />
          </div>
        </div>

        {/* Setup instructions */}
        <div className="border border-[#ebebeb] rounded-md">
          <div className="px-5 py-3 border-b border-[#ebebeb]">
            <SectionLabel>Setup Instructions</SectionLabel>
          </div>
          <div className="px-5 py-4">
            <p className="text-[12.5px] text-[#555] mb-3 leading-relaxed">
              Create a <code className="bg-[#f5f5f5] border border-[#e8e8e8] px-1.5 py-0.5 rounded text-[11.5px] text-[#0a0a0a]">.env.local</code> file in the project root (or add environment variables on Vercel):
            </p>
            <pre className="bg-[#f8f8f8] border border-[#e8e8e8] rounded-md p-4 text-[11.5px] text-[#333] overflow-x-auto leading-relaxed font-mono">
{`# Required
ANTHROPIC_API_KEY=sk-ant-...
FRED_API_KEY=your_fred_key
FINNHUB_API_KEY=your_finnhub_key

# Optional
BLS_API_KEY=your_bls_key
BEA_API_KEY=your_bea_key

# Optional — Supabase issue persistence
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...`}
            </pre>
            <div className="mt-3 space-y-1">
              <p className="text-[11px] text-[#999]">Free FRED keys: fred.stlouisfed.org/docs/api/api_key.html</p>
              <p className="text-[11px] text-[#999]">Free Finnhub keys: finnhub.io (register for free tier)</p>
              <p className="text-[11px] text-[#999]">Anthropic keys: console.anthropic.com</p>
            </div>
          </div>
        </div>

        {/* Data sources */}
        <div className="border border-[#ebebeb] rounded-md">
          <div className="px-5 py-3 border-b border-[#ebebeb]">
            <SectionLabel>Data Sources</SectionLabel>
          </div>
          <div className="px-5 py-1">
            {[
              { label: "FRED",     desc: "Fed funds, CPI, GDP, unemployment, yield curve, HY OAS", key: "FRED_API_KEY" },
              { label: "Finnhub",  desc: "Equities, forex, crypto, earnings calendar, news headlines", key: "FINNHUB_API_KEY" },
              { label: "CoinGecko", desc: "Cryptocurrency prices (no key required)", key: null },
              { label: "Supabase", desc: "Persistent storage for generated issues and archive", key: "NEXT_PUBLIC_SUPABASE_URL" },
            ].map((s) => (
              <div key={s.label} className="flex items-start justify-between py-3 border-b border-[#ebebeb] last:border-0">
                <div>
                  <p className="text-[12.5px] font-semibold text-[#0a0a0a]">{s.label}</p>
                  <p className="text-[11px] text-[#999] mt-0.5">{s.desc}</p>
                </div>
                {s.key === null && (
                  <span className="text-[11px] text-[#147a4f] font-medium">No key needed</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="border border-[#ebebeb] rounded-md px-5 py-4">
          <p className="text-[11px] text-[#bbb] leading-relaxed">
            <span className="font-semibold text-[#999]">Disclaimer:</span> CrossAsset is for educational and research workflow purposes only. It does not provide investment advice or trading recommendations. All data and AI-generated content is informational and should not be used as the basis for investment decisions.
          </p>
        </div>

      </div>
    </AppShell>
  );
}
