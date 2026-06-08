import AppShell from "@/components/layout/AppShell";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

function KeyStatus({ label, configured, optional = false }: { label: string; configured: boolean; optional?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-zinc-800 last:border-0">
      <div>
        <p className="text-xs text-zinc-300">{label}</p>
        {optional && <p className="text-[10px] text-zinc-600">Optional</p>}
      </div>
      <div className="flex items-center gap-1.5">
        {configured ? (
          <>
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span className="text-[10px] text-emerald-400">Configured</span>
          </>
        ) : (
          <>
            <XCircle size={13} className={optional ? "text-zinc-600" : "text-amber-400"} />
            <span className={`text-[10px] ${optional ? "text-zinc-600" : "text-amber-400"}`}>
              {optional ? "Not set" : "Required for live generation"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasFred = !!process.env.FRED_API_KEY;
  const hasBls = !!process.env.BLS_API_KEY;
  const hasBea = !!process.env.BEA_API_KEY;
  const hasAlphaVantage = !!process.env.ALPHA_VANTAGE_API_KEY;
  const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Configure API keys, preferences, and data sources.</p>
      </div>

      <div className="max-w-2xl space-y-5">
        {/* API Keys */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-md">
          <div className="px-4 py-2.5 border-b border-zinc-800">
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">API Key Status</h3>
          </div>
          <div className="px-4 py-1">
            <KeyStatus label="Anthropic API Key (Claude)" configured={hasAnthropic} />
            <KeyStatus label="FRED API Key" configured={hasFred} />
            <KeyStatus label="BLS API Key" configured={hasBls} optional />
            <KeyStatus label="BEA API Key" configured={hasBea} optional />
            <KeyStatus label="Alpha Vantage API Key" configured={hasAlphaVantage} optional />
            <KeyStatus label="Supabase" configured={hasSupabase} optional />
          </div>
        </div>

        {/* Setup instructions */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-md p-4">
          <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">Setup Instructions</h3>
          <p className="text-xs text-zinc-400 mb-2">Create a <code className="bg-zinc-800 px-1 rounded text-zinc-200">.env.local</code> file in the project root with the following variables:</p>
          <pre className="bg-zinc-900 rounded p-3 text-xs text-zinc-300 overflow-x-auto leading-relaxed">
{`# Required for AI brief generation
ANTHROPIC_API_KEY=sk-ant-...

# Required for live macro data
FRED_API_KEY=your_fred_key

# Optional
BLS_API_KEY=your_bls_key
BEA_API_KEY=your_bea_key
ALPHA_VANTAGE_API_KEY=your_av_key

# Optional — Supabase persistence
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...`}
          </pre>
          <p className="text-[10px] text-zinc-600 mt-2">
            Free FRED API keys available at <span className="text-zinc-400">fred.stlouisfed.org/docs/api/api_key.html</span>.
            Free Anthropic API keys at <span className="text-zinc-400">console.anthropic.com</span>.
          </p>
        </div>

        {/* Profile settings (static for MVP) */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-md p-4">
          <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">User Profile</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-2">Role</label>
              <div className="grid grid-cols-2 gap-1.5">
                {["Equity Research", "Sales & Trading", "Portfolio Management", "Student"].map((role) => (
                  <button
                    key={role}
                    className={`text-xs px-2.5 py-1.5 rounded border transition-colors ${
                      role === "Student"
                        ? "border-[#E8C468] text-[#E8C468] bg-amber-950/30"
                        : "border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-2">Brief Tone</label>
              <div className="grid grid-cols-1 gap-1.5">
                {["Institutional", "Concise", "Teaching-focused", "Trading desk style"].map((tone) => (
                  <button
                    key={tone}
                    className={`text-xs px-2.5 py-1.5 rounded border transition-colors text-left ${
                      tone === "Institutional"
                        ? "border-[#E8C468] text-[#E8C468] bg-amber-950/30"
                        : "border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                    }`}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Demo mode status */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-md p-4">
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-white mb-1">Demo Mode</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {!hasAnthropic || !hasFred
                  ? "App is running in demo mode. Configure ANTHROPIC_API_KEY and FRED_API_KEY to enable live AI-generated briefs with real macro data."
                  : "All required API keys are configured. The app will generate live briefs using real FRED macro data and Claude AI."}
              </p>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-md p-4">
          <p className="text-[10px] text-zinc-500 leading-relaxed">
            <span className="font-semibold text-zinc-400">Disclaimer:</span> CrossAsset is for educational and research workflow purposes only. It does not provide investment advice or trading recommendations. All data and AI-generated content is for informational purposes only and should not be used as the basis for investment decisions.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
