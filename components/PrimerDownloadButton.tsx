"use client";
import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { PrimerDocument } from "./PrimerPDF";
import { FileDown } from "lucide-react";

interface Props {
  ticker: string;
  companyName: string;
  industry: string;
  content: string;
  history: Record<string, Record<string, number>>;
  facts: Record<string, number>;
  sector?: string;
  selectedCharts?: string[];
  chartVariants?: Record<string, number>;
  fmpExtended?: Record<string, unknown>;
}

export function PrimerDownloadButton({ ticker, companyName, industry, content, history, facts, sector, selectedCharts, chartVariants, fmpExtended }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setLoading(true);
    setError(null);
    try {
      const date = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
      const doc = (
        <PrimerDocument
          ticker={ticker}
          companyName={companyName}
          industry={industry}
          content={content}
          generatedDate={date}
          history={history}
          facts={facts}
          sector={sector}
          selectedCharts={selectedCharts}
          chartVariants={chartVariants}
          fmpExtended={fmpExtended}
        />
      );
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${ticker}_Primer_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("PDF generation failed:", e);
      setError(e instanceof Error ? e.message : "PDF generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
      <button
        onClick={handleDownload}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0c1b38] text-white text-[10.5px] font-bold rounded hover:bg-[#1a3361] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <FileDown size={11} className="inline mr-1" />
        {loading ? "Generating PDF…" : "Download PDF"}
      </button>
      {error && (
        <span style={{ fontSize: 10, color: "#b42318", maxWidth: 220, lineHeight: 1.4 }}>
          Error: {error.slice(0, 120)}
        </span>
      )}
    </div>
  );
}
