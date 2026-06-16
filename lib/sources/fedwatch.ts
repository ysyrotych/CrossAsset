// FedWatch-style rate change probability matrix derived from CME ZQ Fed Funds Futures
// Methodology: implied monthly avg EFFR = 100 − ZQ price
// Probability: P(cut) = (R_pre − R_post) / 0.25; P(hike) = (R_post − R_pre) / 0.25

import { fetchYFQuotes } from "./yahoo";

// FOMC meetings and their corresponding ZQ contracts
// zqSym = contract for the meeting month (gives monthly average)
// zqNext = next month's contract (used as clean post-meeting rate for late-month meetings)
// lateMeeting = meeting day >= 22, so next contract is cleaner post-meeting proxy
const FOMC_MEETINGS = [
  { date: "2026-06-17", label: "Jun '26", month: 6,  year: 2026, day: 17, days: 30, zqSym: "ZQM26.CBT", zqNext: "ZQN26.CBT", late: false },
  { date: "2026-07-29", label: "Jul '26", month: 7,  year: 2026, day: 29, days: 31, zqSym: "ZQN26.CBT", zqNext: "ZQQ26.CBT", late: true  },
  { date: "2026-09-16", label: "Sep '26", month: 9,  year: 2026, day: 16, days: 30, zqSym: "ZQU26.CBT", zqNext: "ZQV26.CBT", late: false },
  { date: "2026-10-28", label: "Oct '26", month: 10, year: 2026, day: 28, days: 31, zqSym: "ZQV26.CBT", zqNext: "ZQX26.CBT", late: true  },
  { date: "2026-12-09", label: "Dec '26", month: 12, year: 2026, day: 9,  days: 31, zqSym: "ZQZ26.CBT", zqNext: "ZQF27.CBT", late: false },
  { date: "2027-01-27", label: "Jan '27", month: 1,  year: 2027, day: 27, days: 31, zqSym: "ZQF27.CBT", zqNext: "ZQG27.CBT", late: true  },
  { date: "2027-03-17", label: "Mar '27", month: 3,  year: 2027, day: 17, days: 31, zqSym: "ZQH27.CBT", zqNext: "ZQJ27.CBT", late: false },
  { date: "2027-04-28", label: "Apr '27", month: 4,  year: 2027, day: 28, days: 30, zqSym: "ZQJ27.CBT", zqNext: "ZQK27.CBT", late: true  },
];

const ALL_ZQ_SYMBOLS = [
  "ZQM26.CBT", "ZQN26.CBT", "ZQQ26.CBT", "ZQU26.CBT",
  "ZQV26.CBT", "ZQX26.CBT", "ZQZ26.CBT", "ZQF27.CBT",
  "ZQG27.CBT", "ZQH27.CBT", "ZQJ27.CBT", "ZQK27.CBT",
];

// current EFFR midpoint inferred from target range
// ZQM26 ≈ 3.624% → 350-375 band → midpoint 3.625%
const CURRENT_RATE_MIDPOINT = 3.625;

export type MeetingProb = {
  date: string;
  label: string;
  cutProb: number;
  holdProb: number;
  hikeProb: number;
  impliedRate: number;
};

export async function fetchFedWatchProbs(): Promise<MeetingProb[]> {
  const quotes = await fetchYFQuotes(ALL_ZQ_SYMBOLS);

  const implied: Record<string, number> = {};
  for (const sym of ALL_ZQ_SYMBOLS) {
    const q = quotes.get(sym);
    if (q) implied[sym] = 100 - q.price; // implied monthly avg EFFR in %
  }

  const results: MeetingProb[] = [];

  // R_pre propagates forward: post-meeting rate of meeting N = pre-meeting rate of meeting N+1
  let rPre = CURRENT_RATE_MIDPOINT;

  for (const mtg of FOMC_MEETINGS) {
    const rMonth = implied[mtg.zqSym];
    const rNextMonth = implied[mtg.zqNext];

    if (rMonth == null || rNextMonth == null) {
      results.push({ date: mtg.date, label: mtg.label, cutProb: 0, holdProb: 100, hikeProb: 0, impliedRate: rPre });
      continue;
    }

    let rPost: number;

    if (mtg.late) {
      // Meeting on day 27-29: only 2-4 days remain post-meeting in this month.
      // The next month's contract reflects post-meeting rate directly.
      rPost = rNextMonth;
    } else {
      // Mid-month meeting: month avg = (pre_days * rPre + post_days * rPost) / totalDays
      // Solve for rPost:
      const preDays  = mtg.day;        // days 1..meetingDay at rPre
      const postDays = mtg.days - mtg.day; // days after meeting at rPost
      rPost = (rMonth * mtg.days - rPre * preDays) / postDays;
    }

    // Continuous probability from expected change
    // Positive delta = hike expected; negative delta = cut expected
    const delta = rPost - rPre;

    let cutProb = 0, holdProb = 0, hikeProb = 0;
    if (delta >= 0.005) {
      // Hike territory
      hikeProb = Math.min(100, Math.max(0, (delta / 0.25) * 100));
      holdProb = 100 - hikeProb;
    } else if (delta <= -0.005) {
      // Cut territory
      cutProb = Math.min(100, Math.max(0, (-delta / 0.25) * 100));
      holdProb = 100 - cutProb;
    } else {
      holdProb = 100;
    }

    results.push({
      date:    mtg.date,
      label:   mtg.label,
      cutProb:  Math.round(cutProb * 10) / 10,
      holdProb: Math.round(holdProb * 10) / 10,
      hikeProb: Math.round(hikeProb * 10) / 10,
      impliedRate: Math.round(rPost * 1000) / 1000,
    });

    // Next meeting's pre-rate = this meeting's post-rate
    rPre = rPost;
  }

  return results;
}
