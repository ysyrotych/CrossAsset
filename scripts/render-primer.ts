#!/usr/bin/env node
// Run: npx tsx scripts/render-primer.ts
// Output: /tmp/primer-test.pdf
//
// Generates the primer PDF locally using hardcoded META fixture data.
// No Railway, no web app, no pushing needed. Renders in ~5 seconds.

import React from "react";
// @ts-ignore — renderToFile is a Node-only export
import { renderToFile } from "@react-pdf/renderer";
import { PrimerDocument } from "../components/PrimerPDF";
import { FIXTURE } from "./primer-fixture";

const OUT = "/tmp/primer-test.pdf";

async function main() {
  console.log("Rendering META primer PDF…");
  const t0 = Date.now();

  const doc = React.createElement(PrimerDocument, {
    ticker:          FIXTURE.ticker,
    companyName:     FIXTURE.companyName,
    industry:        FIXTURE.industry,
    sector:          FIXTURE.sector,
    content:         FIXTURE.content,
    generatedDate:   FIXTURE.generatedDate,
    history:         FIXTURE.history,
    facts:           FIXTURE.facts as Record<string, number>,
    selectedCharts:  FIXTURE.selectedCharts,
    chartVariants:   FIXTURE.chartVariants,
    fmpExtended:     FIXTURE.fmpExtended as Record<string, unknown>,
  });

  await renderToFile(doc, OUT);
  console.log(`Done in ${Date.now() - t0}ms → ${OUT}`);
}

main().catch(e => {
  console.error("RENDER ERROR:", e);
  process.exit(1);
});
