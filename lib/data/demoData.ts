import type {
  MacroIssue,
  WatchlistItem,
  Task,
  CalendarEvent,
  ReactionEntry,
  MacroData,
  ArchiveEntry,
} from "@/lib/types";

export const DEMO_MACRO_DATA: MacroData = {
  rates: {
    tenYear: { label: "10Y Treasury", value: "4.68%", change: "+0.04", direction: "up", context: "Highest since Nov 2023" },
    twoYear: { label: "2Y Treasury", value: "4.97%", change: "+0.02", direction: "up", context: "Near cycle high" },
    spread2s10s: { label: "2s10s Spread", value: "-29bps", change: "+2", direction: "up", context: "Inversion narrowing" },
    fedFunds: { label: "Fed Funds", value: "5.33%", change: "0", direction: "flat", context: "FOMC on hold" },
  },
  inflation: {
    cpi: { label: "CPI YoY", value: "3.4%", change: "-0.1", direction: "down", context: "Above 2% target" },
    coreCpi: { label: "Core CPI YoY", value: "3.6%", change: "-0.1", direction: "down", context: "Services sticky" },
    pce: { label: "PCE YoY", value: "2.7%", change: "0", direction: "flat", context: "Fed's preferred gauge" },
  },
  growth: {
    gdp: { label: "GDP QoQ", value: "1.6%", change: "-0.9", direction: "down", context: "Below consensus 2.4%" },
    payrolls: { label: "Nonfarm Payrolls", value: "+175K", change: "-50K", direction: "down", context: "Below 240K est." },
    unemployment: { label: "Unemployment", value: "3.9%", change: "+0.1", direction: "up", context: "Gradual softening" },
  },
  risk: {
    hySpread: { label: "HY OAS", value: "307bps", change: "+8", direction: "up", context: "Widening on growth fears" },
  },
  commodities: {
    oil: { label: "WTI Crude", value: "$81.40", change: "-0.85", direction: "down", context: "Demand concerns" },
    gold: { label: "Gold", value: "$2,335", change: "+12", direction: "up", context: "Safe haven bid" },
  },
  isDemo: true,
};

export const DEMO_ISSUE: MacroIssue = {
  id: "demo-2026-06-08",
  date: "2026-06-08",
  title: "Fed Repricing Weighs on Duration; Consumer Names Face Margin Pressure",
  regimeLabel: "Fed Repricing / Sticky Inflation",
  executiveSummary:
    "Markets continue to digest the reality that the Fed is in no rush to cut rates. Sticky core services inflation, a resilient labor market, and above-trend GDP have pushed 10Y yields back toward 4.7%, pressuring duration-sensitive equities and creating headwinds for rate-sensitive sectors including REITs, utilities, and unprofitable tech. Consumer names face a squeeze from persistent wage costs and higher borrowing rates. Credit spreads are widening modestly on growth uncertainty. The dollar remains firm, creating FX headwinds for multinationals.",
  frontPage: [
    {
      headline: "10Y Yields Push Back Toward 4.7% as Fed Cut Pricing Shifts",
      whatHappened:
        "Fed funds futures have repriced to imply fewer than two cuts in 2026, down from five priced in at the start of the year. The 10Y Treasury yield rose 4bps to 4.68%, while the 2Y held near 4.97%, keeping the curve inverted at -29bps.",
      whyItMatters:
        "Higher-for-longer repricing is the central macro driver. It raises the discount rate for long-duration assets, pressures leveraged borrowers, and sustains USD strength. It also signals that the market no longer expects a Fed rescue in the near term.",
      marketImplication:
        "Headwinds for unprofitable tech, REITs, and utilities. Tailwind for bank NIM. USD firmness creates FX drag for multinationals. Credit spreads face upward pressure as refinancing risk increases.",
      affectedAssets: ["Rates", "Equities", "FX", "Credit", "Real Estate"],
    },
    {
      headline: "Core Services Inflation Remains Sticky at 3.6% YoY",
      whatHappened:
        "Core CPI printed 3.6% YoY, driven by shelter costs (+5.5%) and services ex-shelter (+4.2%). Goods deflation has faded as a disinflationary tailwind, leaving services as the dominant inflation driver.",
      whyItMatters:
        "The Fed has made clear it needs sustained progress on core services inflation before cutting. Shelter costs, which make up roughly 35% of CPI, remain elevated due to lagged rent indices. This constrains the pace of disinflation even as the economy slows.",
      marketImplication:
        "Supports higher-for-longer Fed stance. Pressures consumer discretionary margins. Supports TIPS over nominal Treasuries at the margin. Negative for REITs via both cost and rate channel.",
      affectedAssets: ["Rates", "Consumer", "Real Estate", "TIPS"],
    },
    {
      headline: "Q1 GDP Revised Down to 1.6%; Soft Landing Narrative Under Pressure",
      whatHappened:
        "Q1 GDP was revised down to 1.6% annualized from an initial 2.4% estimate, driven by weaker consumer spending and inventory drawdowns. Gross domestic income growth came in near zero, raising questions about the true underlying growth rate.",
      whyItMatters:
        "Stagflation risk — slow growth with sticky inflation — is the most challenging macro environment for equities. It limits earnings growth while keeping costs elevated. The Fed cannot cut aggressively without re-igniting inflation.",
      marketImplication:
        "Negative for cyclicals and consumer discretionary. Supports defensives and cash equivalents. Increases dispersion within equities. Lowers conviction on earnings beats for consumer-facing companies.",
      affectedAssets: ["Equities", "Cyclicals", "Consumer Discretionary"],
    },
  ],
  crossAssetMap: {
    equities:
      "Mixed to negative bias. Rate-sensitive sectors (REITs, utilities, unprofitable tech) face dual headwinds from discount rate and slow growth. Financials benefit from NIM expansion but face credit quality risk. Energy is a relative bright spot if oil holds. Defensives (staples, healthcare) outperform on a relative basis.",
    rates:
      "Bear flattener environment. 10Y anchored 4.5–4.8% near term. 2Y sticky near Fed funds. Curve inversion likely to persist until clear evidence of Fed pivot or economic deterioration. Duration underperformance vs short-end. TIPS have modest appeal given inflation stickiness.",
    fx: "USD firm across G10. DXY supported by rate differential and risk-off. EUR/USD testing 1.07 support. JPY under pressure from BoJ policy divergence. EM FX facing outflows as dollar funding costs remain elevated. Commodity currencies (AUD, CAD) mixed.",
    commodities:
      "Oil softening on demand concerns despite OPEC+ discipline. WTI in $78–84 range. Gold maintaining safe-haven bid near $2,300, supported by central bank demand and geopolitical risk. Copper weak on China growth concerns.",
    credit:
      "HY spreads widening modestly to 307bps OAS. IG relatively stable but yields elevated. Leveraged loans under refinancing pressure. CRE credit is a key watch item given office vacancy rates and floating rate exposure.",
  },
  sectorTranslation: [
    {
      sector: "Consumer Staples",
      implication:
        "Defensive relative positioning. Volume growth under pressure from price normalization. Labor costs remain elevated. Names with strong private label penetration and supply chain efficiency outperform. Watch gross margin trajectory.",
      tickers: ["WMT", "COST", "KR"],
    },
    {
      sector: "Consumer Discretionary",
      implication:
        "Most exposed to the macro setup. Higher borrowing costs reduce consumer wallet share. Inflation-fatigued consumers trading down. Rate sensitivity of housing-linked names (home goods, furniture) elevated.",
      tickers: ["TGT", "AMZN"],
    },
    {
      sector: "Financials",
      implication:
        "Higher-for-longer is a net positive for NIM in the near term, but watch credit quality deterioration in consumer and CRE books. Capital markets activity remains subdued. Expect credit loss provisions to trend higher.",
      tickers: ["JPM", "BAC"],
    },
    {
      sector: "Technology",
      implication:
        "Mega-cap tech with strong cash flows and AI revenue growth is relatively insulated. Duration-sensitive growth/unprofitable tech faces meaningful multiple compression risk. Semiconductor cycle in recovery; watch NVDA AI capex signals.",
      tickers: ["AAPL", "NVDA"],
    },
    {
      sector: "Energy",
      implication:
        "Oil demand uncertainty caps upside. OPEC+ supply discipline provides floor. Integrated majors benefit from diversified cash flows. Watch free cash flow yield vs cost of capital as rates stay elevated.",
      tickers: ["XOM"],
    },
    {
      sector: "Real Estate",
      implication:
        "Worst-positioned sector in the current regime. Higher discount rates compress cap rates. Office CRE faces structural demand destruction. Residential REITs have affordability tailwind but cost-of-capital headwind.",
      tickers: [],
    },
  ],
  watchlistImpact: [
    {
      ticker: "WMT",
      companyName: "Walmart",
      impactLevel: "Medium",
      explanation:
        "Walmart's defensive consumer positioning and private label penetration provide relative resilience. Key risks are wage inflation (largest private employer) and fuel costs affecting supply chain. Higher rates increase cost of capital for capex. Grocery market share gains from trade-down are a positive offset.",
      suggestedAction: "Review Q1 gross margin vs SG&A to assess wage cost absorption. Check fuel surcharge disclosure.",
    },
    {
      ticker: "TGT",
      companyName: "Target",
      impactLevel: "High",
      explanation:
        "Target has higher discretionary exposure (~50% of revenue) vs Walmart. Consumer pressure from sticky inflation and higher borrowing costs directly impacts its core shopper. Promotional environment to drive traffic could compress gross margins further.",
      suggestedAction: "Monitor comp-store sales vs gross margin tradeoff. Check inventory levels for discretionary categories.",
    },
    {
      ticker: "COST",
      companyName: "Costco",
      impactLevel: "Low",
      explanation:
        "Costco's membership model and bulk-value positioning make it structurally resilient in this environment. Membership fee income provides high-margin annuity revenue. Valuation remains stretched (P/E ~50x) and is rate-sensitive, but fundamentals are solid.",
      suggestedAction: "Track membership renewal rates and new member additions as key leading indicators.",
    },
    {
      ticker: "KR",
      companyName: "Kroger",
      impactLevel: "Low",
      explanation:
        "Pure-play grocery is defensive. Kroger benefits from trade-down from restaurants. Fuel center revenues provide offset to food inflation. Merger uncertainty with Albertsons is a headline risk. Digital and private label momentum positive.",
      suggestedAction: "Monitor FTC merger decision timeline and its impact on capital allocation plans.",
    },
    {
      ticker: "AMZN",
      companyName: "Amazon",
      impactLevel: "High",
      explanation:
        "Amazon carries multiple macro exposures: consumer discretionary (retail), duration sensitivity (long-dated cash flows from AWS), and FX (significant international revenue). AWS growth is the critical driver — any slowdown would pressure the sum-of-parts valuation. Dollar strength creates international revenue headwinds.",
      suggestedAction: "Analyze AWS segment margin vs capex guidance. Quantify FX impact on international segment.",
    },
    {
      ticker: "JPM",
      companyName: "JPMorgan Chase",
      impactLevel: "Medium",
      explanation:
        "Higher-for-longer supports NII expansion. Investment banking pipeline improving but deal activity below historical norms. Credit card delinquency rates are the key credit quality watch item. Fortress balance sheet limits downside risk.",
      suggestedAction: "Track net charge-off rates in consumer credit card book vs NCO guidance.",
    },
    {
      ticker: "BAC",
      companyName: "Bank of America",
      impactLevel: "Medium",
      explanation:
        "Most rate-sensitive major bank due to large fixed-rate securities portfolio. Benefits significantly from higher-for-longer on NII. Greater exposure to consumer banking than JPM. Watch for deposit migration to higher-yielding alternatives.",
      suggestedAction: "Review NII sensitivity to rate scenarios in latest earnings supplement.",
    },
    {
      ticker: "XOM",
      companyName: "ExxonMobil",
      impactLevel: "Medium",
      explanation:
        "Oil demand softness caps near-term upside. However, XOM's integrated model, Pioneer acquisition synergies, and strong FCF yield (~5%) make it attractive vs the macro backdrop. Dollar strength creates mixed signals — helps USD-denominated oil price but some international cost exposure.",
      suggestedAction: "Track Permian production volume vs Pioneer integration targets.",
    },
    {
      ticker: "AAPL",
      companyName: "Apple",
      impactLevel: "Medium",
      explanation:
        "Apple faces FX headwinds (~55% international revenue) from USD strength. Services revenue growth is the valuation driver and remains resilient. iPhone upgrade cycle muted in a high-rate consumer environment. AI product roadmap is the key catalyst watch.",
      suggestedAction: "Monitor services revenue growth rate vs hardware volume. Track China market share data.",
    },
    {
      ticker: "NVDA",
      companyName: "NVIDIA",
      impactLevel: "Medium",
      explanation:
        "NVDA is primarily an AI capex story rather than a macro rate story. Data center demand from hyperscalers appears intact. Key risk is whether AI capex discipline emerges at Microsoft, Google, and Amazon. Valuation (P/E ~40x forward) retains duration sensitivity if real rates rise further.",
      suggestedAction: "Track hyperscaler capex guidance for AI infrastructure spend trajectory.",
    },
  ],
  talkingPoints: [
    "The Fed is effectively in a 'wait and watch' mode — markets have removed all but one cut from 2026 expectations, and we're in a higher-for-longer regime until core services inflation convincingly decelerates.",
    "The 2s10s curve remains inverted at -29bps. Historically this precedes a recession 12-18 months out, though the timeline is uncertain. The more immediate signal is that credit conditions remain tight.",
    "Consumer staples are the defensive play in this setup — WMT and COST benefit from trade-down, but TGT's discretionary mix makes it more vulnerable to the consumer squeeze.",
    "NVDA remains the market's AI proxy — watch whether Blackwell chip demand commentary changes at the next earnings call, as it would have asymmetric read-through to the broader semiconductor and data center complex.",
    "Dollar strength is a stealth headwind across the market — it pressures commodity prices in USD terms, creates FX drag for multinationals like AAPL and AMZN, and tightens financial conditions for EM, which could feed back as slower global growth.",
  ],
  actionItems: [
    {
      title: "Review WMT and TGT gross margin trajectories on higher-for-longer days",
      priority: "High",
      category: "research",
      dueDate: "2026-06-10",
      relatedTicker: "WMT, TGT",
      relatedEvent: "Core CPI Print",
    },
    {
      title: "Prepare 3 talking points on sticky CPI impact for consumer discretionary",
      priority: "High",
      category: "meeting_prep",
      dueDate: "2026-06-09",
      relatedEvent: "CPI Release",
    },
    {
      title: "Model NII sensitivity for BAC under flat vs -50bps rate scenarios",
      priority: "Medium",
      category: "model_update",
      dueDate: "2026-06-12",
      relatedTicker: "BAC",
      relatedEvent: "FOMC Hold Decision",
    },
    {
      title: "Track hyperscaler capex guidance ahead of NVDA earnings",
      priority: "High",
      category: "watchlist",
      dueDate: "2026-06-11",
      relatedTicker: "NVDA",
    },
    {
      title: "Read latest Fed speaker comments on inflation path — Waller and Williams scheduled",
      priority: "Medium",
      category: "reading",
      dueDate: "2026-06-09",
      relatedEvent: "Fed Speeches",
    },
    {
      title: "Update inflation sensitivity scoring in retail sector model",
      priority: "Medium",
      category: "model_update",
      dueDate: "2026-06-14",
      relatedEvent: "CPI Release",
    },
  ],
  sourcesUsed: ["FRED API (DGS10, DGS2, T10Y2Y, CPIAUCSL, CPILFESL, UNRATE, PAYEMS, GDP, FEDFUNDS, PCEPI)", "Demo fallback data"],
  dataQualityNote:
    "This brief was generated using demo/fallback data. Configure FRED_API_KEY and ANTHROPIC_API_KEY in .env.local to generate live AI-powered briefs with real macro data.",
};

export const DEMO_WATCHLIST: WatchlistItem[] = [
  { id: "1", ticker: "WMT", companyName: "Walmart", sector: "Consumer Staples", macroTags: ["Inflation", "Consumer Demand", "Labor", "Oil"], todayImpact: "Defensive positioning supports relative performance. Wage cost pressure is the primary margin risk.", suggestedTask: "Review SG&A vs gross margin trends in latest quarter." },
  { id: "2", ticker: "TGT", companyName: "Target", sector: "Consumer Discretionary", macroTags: ["Rates", "Inflation", "Consumer Demand", "Labor"], todayImpact: "Discretionary mix creates above-average exposure to consumer spending slowdown. Promotional risk elevated.", suggestedTask: "Compare comp-store sales vs inventory build in discretionary categories." },
  { id: "3", ticker: "COST", companyName: "Costco", sector: "Consumer Staples", macroTags: ["Inflation", "Consumer Demand", "Rates"], todayImpact: "Membership model insulates revenue. Valuation (P/E ~50x) retains rate sensitivity.", suggestedTask: "Track membership renewal rates as a leading volume indicator." },
  { id: "4", ticker: "KR", companyName: "Kroger", sector: "Consumer Staples", macroTags: ["Inflation", "Consumer Demand"], todayImpact: "Pure-play grocery is defensive. Trade-down from restaurants is a structural tailwind.", suggestedTask: "Monitor FTC Albertsons merger timeline." },
  { id: "5", ticker: "AMZN", companyName: "Amazon", sector: "Technology / Consumer", macroTags: ["Rates", "Consumer Demand", "FX", "Labor"], todayImpact: "Multi-exposure: retail discretionary, AWS duration, FX drag from USD strength.", suggestedTask: "Analyze AWS margin trajectory and international FX sensitivity." },
  { id: "6", ticker: "JPM", companyName: "JPMorgan Chase", sector: "Financials", macroTags: ["Rates", "Credit", "Consumer Demand"], todayImpact: "NII benefits from higher-for-longer. Credit card delinquency is the primary watch item.", suggestedTask: "Review net charge-off rates vs prior quarter guidance." },
  { id: "7", ticker: "BAC", companyName: "Bank of America", sector: "Financials", macroTags: ["Rates", "Credit"], todayImpact: "Highest rate sensitivity among major banks. NII upside is meaningful if rates stay elevated.", suggestedTask: "Model NII sensitivity in flat vs -50bps rate scenarios." },
  { id: "8", ticker: "XOM", companyName: "ExxonMobil", sector: "Energy", macroTags: ["Oil", "FX", "Inflation"], todayImpact: "Oil demand uncertainty caps near-term upside. Pioneer synergies are a medium-term catalyst.", suggestedTask: "Track Permian basin production volume vs targets." },
  { id: "9", ticker: "AAPL", companyName: "Apple", sector: "Technology", macroTags: ["FX", "Consumer Demand", "Rates"], todayImpact: "FX headwind from USD strength (~55% international revenue). Services growth is the valuation anchor.", suggestedTask: "Monitor China market share data and services revenue growth rate." },
  { id: "10", ticker: "NVDA", companyName: "NVIDIA", sector: "Technology", macroTags: ["Rates", "Consumer Demand"], todayImpact: "AI capex story more than macro story. Watch hyperscaler capex discipline as the key risk.", suggestedTask: "Track hyperscaler capex guidance ahead of next NVDA earnings." },
];

export const DEMO_TASKS: Task[] = [
  { id: "t1", title: "Review WMT and TGT gross margin vs SG&A trends", category: "research", priority: "High", dueDate: "2026-06-10", relatedTicker: "WMT, TGT", relatedEvent: "CPI Print", status: "not_started", createdAt: "2026-06-08" },
  { id: "t2", title: "Prepare 3 talking points on CPI impact for consumer discretionary", category: "meeting_prep", priority: "High", dueDate: "2026-06-09", relatedEvent: "CPI Release", status: "in_progress", createdAt: "2026-06-08" },
  { id: "t3", title: "Model NII sensitivity for BAC under flat vs -50bps rate scenarios", category: "model_update", priority: "Medium", dueDate: "2026-06-12", relatedTicker: "BAC", relatedEvent: "FOMC Decision", status: "not_started", createdAt: "2026-06-08" },
  { id: "t4", title: "Track hyperscaler capex guidance ahead of NVDA earnings", category: "watchlist", priority: "High", dueDate: "2026-06-11", relatedTicker: "NVDA", status: "not_started", createdAt: "2026-06-08" },
  { id: "t5", title: "Read latest Fed speaker comments — Waller and Williams scheduled", category: "reading", priority: "Medium", dueDate: "2026-06-09", relatedEvent: "Fed Speeches", status: "complete", createdAt: "2026-06-07" },
  { id: "t6", title: "Update inflation sensitivity scoring in retail sector model", category: "model_update", priority: "Medium", dueDate: "2026-06-14", relatedEvent: "CPI Release", status: "not_started", createdAt: "2026-06-08" },
  { id: "t7", title: "Track oil move impact on airlines, transports, and energy names", category: "watchlist", priority: "Low", dueDate: "2026-06-15", relatedTicker: "XOM", status: "not_started", createdAt: "2026-06-08" },
];

export const DEMO_CALENDAR: CalendarEvent[] = [
  { id: "c1", date: "2026-06-11", eventName: "Core CPI (May)", whyItMatters: "The Fed's primary inflation gauge. Any upside surprise re-prices rate cut expectations and pressures duration-sensitive assets. Services inflation is the critical subcomponent.", assetsAffected: ["Rates", "Equities", "USD", "REITs"], previousReading: "3.6% YoY", forecast: "3.5% YoY" },
  { id: "c2", date: "2026-06-12", eventName: "FOMC Rate Decision", whyItMatters: "Fed expected to hold at 5.25–5.50%. Watch dot plot revisions and Powell press conference language on inflation progress. Any hawkish surprise would steepen the selloff in duration.", assetsAffected: ["Rates", "Equities", "FX", "Credit"], previousReading: "5.25–5.50%", forecast: "Hold" },
  { id: "c3", date: "2026-06-14", eventName: "PPI (May)", whyItMatters: "Producer price index feeds into PCE, the Fed's preferred measure. Wholesale goods deflation has faded; services PPI is the watch item.", assetsAffected: ["Rates", "Equities"], previousReading: "2.2% YoY", forecast: "2.3% YoY" },
  { id: "c4", date: "2026-06-18", eventName: "Retail Sales (May)", whyItMatters: "Real-time read on consumer spending. Controls group feeds directly into GDP calculation. Watch for signs of consumer exhaustion under credit stress.", assetsAffected: ["Consumer Discretionary", "Equities", "Rates"], previousReading: "+0.6% MoM", forecast: "+0.3% MoM" },
  { id: "c5", date: "2026-06-20", eventName: "Nonfarm Payrolls (May)", whyItMatters: "Labor market remains the Fed's second mandate. Robust jobs data delays cut expectations. Watch average hourly earnings — the wage inflation proxy.", assetsAffected: ["Rates", "Equities", "USD"], previousReading: "+175K", forecast: "+185K" },
  { id: "c6", date: "2026-06-25", eventName: "PCE Price Index (May)", whyItMatters: "The Fed's preferred inflation measure. Core PCE above 2.5% keeps the Fed on hold. This print will shape the June FOMC narrative.", assetsAffected: ["Rates", "Equities", "USD"], previousReading: "2.7% YoY", forecast: "2.6% YoY" },
  { id: "c7", date: "2026-06-27", eventName: "GDP (Q1 Final)", whyItMatters: "Third and final revision of Q1 GDP. Already revised down to 1.6%. A further revision lower would intensify stagflation concerns.", assetsAffected: ["Equities", "Credit", "USD"], previousReading: "1.6% QoQ SAAR" },
  { id: "c8", date: "2026-07-02", eventName: "Treasury 10Y Auction", whyItMatters: "Strong demand (low tail, high bid-to-cover) would cap yields. Weak demand would push yields higher and pressure equities. Foreign participation is a key indicator of dollar confidence.", assetsAffected: ["Rates", "Equities", "USD"] },
];

export const DEMO_REACTIONS: ReactionEntry[] = [
  {
    id: "r1",
    eventDate: "2026-05-15",
    eventName: "CPI (April) — Core 3.6%",
    surpriseDirection: "In-Line",
    expectedRatesReaction: "Modest bear flattening, 10Y +3-5bps",
    actualRatesReaction: "10Y +4bps to 4.66%; 2Y flat",
    expectedEquityReaction: "S&P flat to -0.5%; tech underperforms",
    actualEquityReaction: "S&P -0.6%; NDX -1.1%; financials flat",
    expectedFxReaction: "USD modest strength, DXY +0.2%",
    actualFxReaction: "DXY +0.3%; EUR/USD -0.2%",
    result: "Correct",
    lessonLearned: "In-line prints with still-elevated core are treated as bearish — market wants downside surprise to justify cuts.",
  },
  {
    id: "r2",
    eventDate: "2026-05-03",
    eventName: "Nonfarm Payrolls — +175K (est. 240K)",
    surpriseDirection: "Miss",
    expectedRatesReaction: "Bull steepening, 10Y -8-12bps",
    actualRatesReaction: "10Y -6bps; 2Y -8bps — flatter than expected",
    expectedEquityReaction: "S&P +0.8-1.2% on rate relief",
    actualEquityReaction: "S&P +0.5%; growth stocks underperformed despite rate rally",
    expectedFxReaction: "USD weakens 0.4-0.6%",
    actualFxReaction: "DXY -0.3%; less than expected",
    result: "Mixed",
    lessonLearned: "Jobs miss cut both ways: rate relief positive for duration, but growth fears partial offset. Growth stocks did NOT rally despite lower rates — earnings growth concern dominated.",
  },
  {
    id: "r3",
    eventDate: "2026-04-26",
    eventName: "Q1 GDP — 1.6% (est. 2.4%)",
    surpriseDirection: "Miss",
    expectedRatesReaction: "Bull rally, 10Y -10-15bps on growth scare",
    actualRatesReaction: "10Y -4bps only; PCE component was hot, offsetting growth relief",
    expectedEquityReaction: "Mixed — growth scare vs rate relief",
    actualEquityReaction: "S&P -0.9%; stagflation read dominated",
    expectedFxReaction: "USD weakens",
    actualFxReaction: "DXY flat — hot PCE component kept dollar bid",
    result: "Wrong",
    lessonLearned: "GDP miss alone does not rally bonds if inflation components are hot. The market read GDP+PCE together as stagflationary. Next time: parse the inflation subcomponents before calling the rate reaction.",
  },
  {
    id: "r4",
    eventDate: "2026-03-20",
    eventName: "FOMC Decision — Hold, Hawkish Dots",
    surpriseDirection: "Miss",
    expectedRatesReaction: "Bear flattening, 10Y +8-12bps",
    actualRatesReaction: "10Y +9bps; 2Y +12bps — both ends sold off",
    expectedEquityReaction: "S&P -1 to -1.5%; rate-sensitives underperform",
    actualEquityReaction: "S&P -0.9%; REITs -2.1%; utilities -1.8%; banks +0.4%",
    expectedFxReaction: "USD strengthens on rate differential",
    actualFxReaction: "DXY +0.5%; USD strongest performer vs G10",
    result: "Correct",
    lessonLearned: "Hawkish FOMC follows a predictable cross-asset script: bear flattening, USD strength, rate-sensitive equity sectors underperform, banks outperform. The magnitude was in range.",
  },
];

export const DEMO_ARCHIVE: ArchiveEntry[] = [
  {
    id: "arch-1",
    date: "2026-06-08",
    title: "Fed Repricing Weighs on Duration; Consumer Names Face Margin Pressure",
    regimeLabel: "Fed Repricing / Sticky Inflation",
    topMacroEvent: "10Y yields push toward 4.7%; core CPI sticky at 3.6%",
    summary: "Higher-for-longer Fed stance continues to weigh on duration assets. Consumer names squeezed by wage costs and elevated rates. Dollar remains firm.",
    issue: DEMO_ISSUE,
  },
  {
    id: "arch-2",
    date: "2026-05-28",
    title: "Payrolls Miss Opens Door to September Cut; Growth Stocks Diverge",
    regimeLabel: "Growth Scare / Rate Relief",
    topMacroEvent: "Nonfarm payrolls +175K vs 240K estimate",
    summary: "Softer labor data gave markets temporary rate relief, but growth stocks failed to rally as earnings growth concerns offset the duration tailwind. Stagflation risk remains the dominant tail.",
  },
  {
    id: "arch-3",
    date: "2026-05-15",
    title: "Stagflation Setup Crystallizes: Slow Growth, Sticky Prices",
    regimeLabel: "Stagflation Risk",
    topMacroEvent: "Q1 GDP revised to 1.6%; core PCE remains at 2.8%",
    summary: "The worst combination for equities: GDP growth below trend while inflation stays above target. Rate cuts cannot be deployed without re-igniting inflation. Dispersion in equities elevated.",
  },
];
