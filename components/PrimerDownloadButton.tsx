"use client";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { PrimerDocument } from "./PrimerPDF";
import { FileDown } from "lucide-react";

interface Props {
  ticker: string;
  companyName: string;
  industry: string;
  content: string;
  history: Record<string, Record<string, number>>;
  facts: Record<string, number>;
}

export function PrimerDownloadButton({ ticker, companyName, industry, content, history, facts }: Props) {
  const date = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return (
    <PDFDownloadLink
      document={
        <PrimerDocument
          ticker={ticker}
          companyName={companyName}
          industry={industry}
          content={content}
          generatedDate={date}
          history={history}
          facts={facts}
        />
      }
      fileName={`${ticker}_Primer_${new Date().toISOString().slice(0, 10)}.pdf`}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0c1b38] text-white text-[10.5px] font-bold rounded hover:bg-[#1a3361] transition-colors no-underline"
    >
      {({ loading }) =>
        loading ? "Generating PDF…" : <><FileDown size={11} className="inline mr-1" />Download PDF</>
      }
    </PDFDownloadLink>
  );
}
