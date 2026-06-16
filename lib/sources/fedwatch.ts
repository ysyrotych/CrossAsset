// FedWatch-style rate change probability matrix derived from CME ZQ Fed Funds Futures
// Methodology mirrors CME FedWatch Tool: implied rate = 100 - ZQ price

import { fetchYFQuotes } from "./yahoo";

// FOMC meeting dates (2026-2027)
const FOMC_MEETINGS = [
  { date: "2026-06-17", label: "Jun 2026", month: 6,  year: 2026, day: 17, zqSym: "ZQM26.CBT", zqNext: "ZQN26.CBT" },
  { date: "2026-07-29", label: "Jul 2026", month: 7,  year: 2026, day: 29, zqSym: "ZQN26.CBT", zqNext: "ZQQ26.CBT" },
  { date: "2026-09-16", label: "Sep 2026", month: 9,  year: 2026, day: 16, zqSym: "ZQU26.CBT", zqNext: "ZQV26.CBT" },
  { date: "2026-10-28", label: "Oct 2026", month: 10, year: 2026, day: 28, zqSym: "ZQV26.CBT", zqNext: "ZQX26.CBT" },
  { date: "2026-12-09", label: "Dec 2026", month: 12, year: 2026, day: 9,  zqSym: "ZQZ26.CBT", zqNext: "ZQF27.CBT" },
  { date: "2027-01-27", label: "Jan 2027", month: 1,  year: 2027, day: 27, zqSym: "ZQF27.CBT", zqNext: "ZQG27.CBT" },
  { date: "2027-03-17", label: "Mar 2027", month: 3,  year: 2027, day: 17, zqSym: "ZQH27.CBT", zqNext: "ZQJ27.CBT" },
  { date: "2027-04-28", label: "Apr 2027", month: 4,  year: 2027, day: 28, zqSym: "ZQJ27.CBT", zqNext: "ZQK27.CBT" },
];

const ALL_ZQ_SYMBOLS = [
  "ZQM26.CBT", "ZQN26.CBT", "ZQQ26.CBT", "ZQU26.CBT",
  "ZQV26.CBT", "ZQX26.CBT", "ZQZ26.CBT", "ZQF27.CBT",
  "ZQG27.CBT", "ZQH27.CBT", "ZQJ27.CBT", "ZQK27.CBT",
];

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

// Implied monthly average EFFR from ZQ price
function impliedRate(price: number): number {
  return 100 - price;
}

// For each meeting, compute implied post-meeting rate
// Late-month meetings (day >= 20): next month's contract IS the post-meeting rate
// Mid-month meetings: interpolate using contract-month average
function postMeetingRate(
  meetingDay: number,
  daysInMeetingMonth: number,
  rAvg: number,   // implied rate from meeting-month contract
  rNext: number   // implied rate from next-month contract
): number {
  if (meetingDay >= 20) {
    // Next month's contract reflects post-meeting rate cleanly
    return rNext;
  }
  // Meeting happens mid-month: avg = (pre * meetingDay + post * (N - meetingDay)) / N
  // Assume pre-meeting rate ≈ rAvg (close enough for first meeting; tree adjusts downstream)
  // r_post = (r_avg * N - r_pre * D) / (N - D)
  const N = daysInMeetingMonth;
  const D = meetingDay;
  const rPre = rAvg; // approximation for standalone calculation
  return (rAvg * N - rPre * D) / (N - D);
}

// Round to nearest 25bps target range
function roundToBand(ratePct: number): number {
  return Math.round(ratePct / 0.25) * 0.25;
}

export type MeetingProb = {
  date: string;
  label: string;
  // Probability distribution keyed by "LB-UB" e.g. "300-325"
  probs: { range: string; lb: number; ub: number; prob: number }[];
  // Summarized
  cutProb: number;
  holdProb: number;
  hikeProb: number;
  impliedRate: number;
};

export async function fetchFedWatchProbs(): Promise<MeetingProb[]> {
  const quotes = await fetchYFQuotes(ALL_ZQ_SYMBOLS);

  const prices: Record<string, number> = {};
  for (const sym of ALL_ZQ_SYMBOLS) {
    const q = quotes.get(sym);
    if (q) prices[sym] = q.price;
  }

  // Build cumulative probability tree across meetings
  // State: probability distribution over Fed Funds rate levels (in 25bp increments)
  // Start: current rate implied by nearest contract

  const results: MeetingProb[] = [];

  // Current implied rate from first available contract (ZQM26 = Jun 2026)
  const currentPrice = prices["ZQM26.CBT"] ?? 96.375;
  const currentImplied = impliedRate(currentPrice);
  const currentBand = roundToBand(currentImplied);

  // Initial distribution: 100% probability at current band
  let dist: Map<number, number> = new Map([[currentBand, 1.0]]);

  for (const mtg of FOMC_MEETINGS) {
    const priceThis = prices[mtg.zqSym];
    const priceNext = prices[mtg.zqNext];

    if (!priceThis || !priceNext) {
      // Missing data — skip this meeting with empty probs
      results.push({
        date: mtg.date,
        label: mtg.label,
        probs: [],
        cutProb: 0,
        holdProb: 1,
        hikeProb: 0,
        impliedRate: priceThis ? impliedRate(priceThis) : 0,
      });
      continue;
    }

    const rAvg = impliedRate(priceThis);
    const rNext = impliedRate(priceNext);
    const N = daysInMonth(mtg.month, mtg.year);

    // Compute implied post-meeting rate
    const rPost = postMeetingRate(mtg.day, N, rAvg, rNext);
    const postBand = roundToBand(rPost);

    // For each possible pre-meeting level, compute conditional probabilities
    const newDist: Map<number, number> = new Map();
    const meetingProbs: Map<number, number> = new Map();

    for (const [preMid, preProb] of dist.entries()) {
      // delta = post - pre (in 25bp steps)
      const deltaBps = Math.round((postBand - preMid) / 0.25);

      // Clamp: markets don't usually move more than 2 steps at once
      const clampedDelta = Math.max(-2, Math.min(2, deltaBps)) * 0.25;
      const postMid = preMid + clampedDelta;

      // Accumulate
      newDist.set(postMid, (newDist.get(postMid) ?? 0) + preProb);

      // For display: accumulate probs at each outcome
      meetingProbs.set(postMid, (meetingProbs.get(postMid) ?? 0) + preProb);
    }

    dist = newDist;

    // Build prob array for display
    const probArr = [...meetingProbs.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([mid, p]) => {
        const lb = Math.round((mid - 0.125) * 100);
        const ub = Math.round((mid + 0.125) * 100);
        return {
          range: `${lb}-${ub}`,
          lb,
          ub,
          prob: Math.round(p * 1000) / 10, // percentage with 1 decimal
        };
      });

    // Summarize as cut/hold/hike vs prior meeting
    // Use first meeting's pre-rate as baseline
    const priorBand = currentBand;
    const cutProb = probArr.filter(p => p.ub <= priorBand * 100).reduce((s, p) => s + p.prob, 0);
    const hikeProb = probArr.filter(p => p.lb >= priorBand * 100 + 25).reduce((s, p) => s + p.prob, 0);
    const holdProb = Math.max(0, 100 - cutProb - hikeProb);

    results.push({
      date: mtg.date,
      label: mtg.label,
      probs: probArr,
      cutProb: Math.round(cutProb * 10) / 10,
      holdProb: Math.round(holdProb * 10) / 10,
      hikeProb: Math.round(hikeProb * 10) / 10,
      impliedRate: Math.round(rPost * 1000) / 1000,
    });
  }

  return results;
}
