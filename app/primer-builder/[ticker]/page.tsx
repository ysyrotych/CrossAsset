"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const PrimerBuilder = dynamic(() => import("@/components/PrimerBuilder"), { ssr: false });

export default function PrimerBuilderPage() {
  const params = useParams();
  const ticker = ((params?.ticker as string) ?? "").toUpperCase();
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    fetch(`/api/sec?ticker=${encodeURIComponent(ticker)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch(e => setError(e.message ?? "Failed to load"))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return (
    <div style={{ background: "#040d1c", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div style={{ width: 32, height: 32, border: "3px solid #1a2d4a", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ color: "#64748b", fontSize: 13 }}>Loading {ticker} data…</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error || !data) return (
    <div style={{ background: "#040d1c", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
      <div style={{ color: "#ef4444", fontSize: 13 }}>{error || `No data found for ${ticker}`}</div>
      <a href="/10k" style={{ color: "#3b82f6", fontSize: 12 }}>← Back to Dashboard</a>
    </div>
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <PrimerBuilder ticker={ticker} data={data as any} />;
}
