// Hardcoded META fixture data for local PDF debugging.
// All values approximate real 2024 financials.

export const FIXTURE = {
  ticker: "META",
  companyName: "Meta Platforms",
  industry: "Internet Content & Information",
  sector: "Communication Services",
  generatedDate: "July 2026",

  facts: {
    market_cap:       1430000000000,
    revenue:          164501000000,
    free_cash_flow:   52125000000,
    ev_ebitda:        16.2,
    roic:             26.8,
    pe_ratio:         24.8,
    net_debt:         -43194000000,
    ebitda:           74500000000,
    gross_margin:     80.8,
    stock_price:      595,
    enterprise_value: 1387000000000,
    ev_revenue:       8.4,
    revenue_growth:   19.0,
    pt_consensus:     697,
    pt_high:          850,
    pt_low:           450,
    week52_high:      638,
    week52_low:       414,
  },

  history: {
    revenue: {
      "2020-12-31": 86000000000,
      "2021-12-31": 117929000000,
      "2022-12-31": 116609000000,
      "2023-12-31": 134902000000,
      "2024-12-31": 164501000000,
    },
    gross_profit: {
      "2020-12-31": 69273000000,
      "2021-12-31": 95990000000,
      "2022-12-31": 90697000000,
      "2023-12-31": 107966000000,
      "2024-12-31": 132918000000,
    },
    operating_income: {
      "2020-12-31": 32671000000,
      "2021-12-31": 46753000000,
      "2022-12-31": 28944000000,
      "2023-12-31": 46751000000,
      "2024-12-31": 69381000000,
    },
    net_income: {
      "2020-12-31": 29146000000,
      "2021-12-31": 39370000000,
      "2022-12-31": 23200000000,
      "2023-12-31": 39098000000,
      "2024-12-31": 62360000000,
    },
    operating_cf: {
      "2020-12-31": 38747000000,
      "2021-12-31": 57683000000,
      "2022-12-31": 50475000000,
      "2023-12-31": 71113000000,
      "2024-12-31": 91611000000,
    },
    free_cash_flow: {
      "2020-12-31": 23632000000,
      "2021-12-31": 39116000000,
      "2022-12-31": 18908000000,
      "2023-12-31": 43011000000,
      "2024-12-31": 52125000000,
    },
    eps_diluted: {
      "2020-12-31": 10.09,
      "2021-12-31": 13.77,
      "2022-12-31": 8.59,
      "2023-12-31": 14.87,
      "2024-12-31": 23.86,
    },
    capex: {
      "2020-12-31": -15115000000,
      "2021-12-31": -18567000000,
      "2022-12-31": -31567000000,
      "2023-12-31": -28101000000,
      "2024-12-31": -39186000000,
    },
    buybacks: {
      "2020-12-31": -6272000000,
      "2021-12-31": -44814000000,
      "2022-12-31": -27956000000,
      "2023-12-31": -19998000000,
      "2024-12-31": -14648000000,
    },
    dividends_paid: {
      "2020-12-31": 0,
      "2021-12-31": 0,
      "2022-12-31": 0,
      "2023-12-31": 0,
      "2024-12-31": -1262000000,
    },
    sbc_expense: {
      "2020-12-31": 6536000000,
      "2021-12-31": 9164000000,
      "2022-12-31": 11732000000,
      "2023-12-31": 12018000000,
      "2024-12-31": 15001000000,
    },
    cash: {
      "2020-12-31": 62079000000,
      "2021-12-31": 48082000000,
      "2022-12-31": 40737000000,
      "2023-12-31": 65396000000,
      "2024-12-31": 72020000000,
    },
    long_term_debt: {
      "2020-12-31": 10000000000,
      "2021-12-31": 10000000000,
      "2022-12-31": 9923000000,
      "2023-12-31": 18387000000,
      "2024-12-31": 28826000000,
    },
  },

  fmpExtended: {
    analyst_rec: { strong_buy: 28, buy: 23, hold: 10, sell: 1, strong_sell: 0, total: 62 },
    analyst_estimates: [
      { date: "FY2025E", rev_avg: 192000000000, eps_avg: 29.50, ebitda_avg: 88000000000,  num_analysts: 58 },
      { date: "FY2026E", rev_avg: 220000000000, eps_avg: 35.20, ebitda_avg: 104000000000, num_analysts: 52 },
      { date: "FY2027E", rev_avg: 251000000000, eps_avg: 41.80, ebitda_avg: 122000000000, num_analysts: 41 },
    ],
    peer_comparison: [
      { symbol: "GOOGL", name: "Alphabet Inc",  revenue: 350000000000, market_cap: 2200000000000, pe: 22.5, ev_ebitda: 14.8, ev_revenue: 6.2, gross_margin: 58.1, roic: 28.5, revenue_growth: 13.4 },
      { symbol: "SNAP",  name: "Snap Inc",      revenue: 5360000000,   market_cap: 17200000000,   pe: null, ev_ebitda: 28.5, ev_revenue: 3.2, gross_margin: 54.2, roic: null,  revenue_growth: 14.2 },
      { symbol: "PINS",  name: "Pinterest",     revenue: 3640000000,   market_cap: 19400000000,   pe: 35.2, ev_ebitda: 21.0, ev_revenue: 5.2, gross_margin: 77.2, roic: 8.4,   revenue_growth: 19.8 },
      { symbol: "RDDT",  name: "Reddit Inc",    revenue: 1150000000,   market_cap: 16800000000,   pe: null, ev_ebitda: null,  ev_revenue: 14.8,gross_margin: 88.1, roic: null,  revenue_growth: 48.2 },
      { symbol: "AMZN",  name: "Amazon",        revenue: 638000000000, market_cap: 2400000000000, pe: 42.1, ev_ebitda: 18.9, ev_revenue: 3.9, gross_margin: 48.2, roic: 16.2,  revenue_growth: 10.9 },
    ],
  },

  selectedCharts: [
    "revenue_fcf", "margin_trend", "eps_trend",
    "balance_sheet", "fcf_quality", "buyback_sbc",
    "capex_trend", "op_leverage", "net_debt",
    "price_range",
  ],
  chartVariants: { revenue_fcf: 0, margin_trend: 0, eps_trend: 0 },

  content: `## I. EXECUTIVE SUMMARY

Meta Platforms is the dominant social media infrastructure company with 3.3 billion daily active users. After the 2022 restructuring, the company has emerged with exceptional margin expansion and FCF generation. We rate META **STRONG BUY** with a 12-month price target of $720, implying 21% upside.

### Executive Bullets
• **Core advertising engine re-accelerating**: Reels monetization has matured with CPMs closing the gap to feed, while AI-driven targeting improvements are delivering 20%+ ROAS improvements for advertisers
• **Margin inflection is structural**: Operating margins expanded from 25% in 2022 to 41% in 2024 as headcount rationalization and AI efficiency gains compound; this is not cyclical
• **Reality Labs optionality unpriced**: At current valuation, the market is paying zero for the AR/VR division which has $40B+ invested; near-term Quest 4 launch could catalyze re-rating
• **Capital return machine**: $50B buyback authorization with $32B remaining; dividend initiated in Q1 2024 signals management confidence in FCF durability
• **AI infrastructure moat widening**: $60-65B 2025 CapEx directly productive — every dollar deployed immediately improves ad targeting and lowers advertiser churn

## II. COMPANY SNAPSHOT

| Field | Value |
|-------|-------|
| Ticker | META |
| Exchange | NASDAQ |
| Sector | Communication Services |
| Industry | Internet Content & Information |
| Market Cap | $1.43T |
| 52-Week Range | $414 - $638 |
| P/E (TTM) | 24.8x |
| EV/EBITDA | 16.2x |
| Dividend Yield | 0.35% |
| Beta | 1.18 |
| Float | 2.53B shares |
| Daily Active People | 3.35 billion |
| Investment Frame | Core large-cap growth compounding at 20%+ FCF CAGR |

## III. BUSINESS OVERVIEW

### Company Background
Meta Platforms, Inc. operates the world's largest social media ecosystem, connecting over 3.3 billion daily active users across Facebook, Instagram, WhatsApp, and Messenger. Founded in 2004 by Mark Zuckerberg, the company has evolved from a college social network into a global advertising duopoly alongside Alphabet, commanding approximately 19% of global digital ad spend.

The company's transformation over 2022-2024 — the "Year of Efficiency" and its aftermath — represents one of the most dramatic corporate restructurings in tech history. Headcount peaked at 87,000 in late 2022 before falling to 67,000 by 2024, while revenues nearly doubled. This created a step-change in operating leverage that fundamentally repriced the stock from $88 in November 2022 to over $600 by end of 2024.

### Product Portfolio & Revenue Mix
Meta's revenue is approximately 98% advertising, derived from auction-based CPM and CPC ads served across its Family of Apps. The advertising ecosystem benefits from closed-loop measurement, first-party identity data (email + phone matching), and increasingly AI-powered ad delivery via the Advantage+ suite.

Key product vectors include Reels (short-form video, now 200B+ daily plays), WhatsApp Business API (emerging revenue stream in international markets at early monetization stages), and Meta AI (generative AI assistant integrated across all apps with 600M+ monthly active users). Reality Labs — the AR/VR segment — generates under $2B revenue but absorbs approximately $17B in annual operating losses.

### Customers, End Markets & Geographic Exposure
The advertiser base is highly diversified across 10+ million active advertisers, with no single advertiser exceeding 1% of revenue. US & Canada accounts for ~43% of revenue despite being only 9% of DAUs, reflecting the significant CPM premium in developed markets. Europe (25%) and Asia-Pacific (17%) are growth regions as monetization efficiency improves through better AI targeting models trained on local behavior data.

## IV. INDUSTRY ANALYSIS

### Market Structure & Competitive Dynamics
The global digital advertising market is a ~$740B market growing at 12% annually. Meta and Google collectively control ~50% of global digital ad spend, creating an effective duopoly in performance advertising. TikTok has gained share in awareness advertising but lacks the conversion optimization infrastructure that drives Meta's advertiser retention and renewal rates above 85%.

The industry is experiencing a structural shift toward AI-powered creative tools (Meta Advantage+, Google PMax) that are increasing advertiser ROI and meaningfully reducing churn. Meta's advantage is its closed-loop attribution with 3.3B users providing training signal no competitor can replicate.

### Key Industry Drivers & Cycle
Ad spend is highly correlated with nominal GDP growth, with a ~1.5x multiplier as digital takes share from traditional media. The 2024-2025 period benefits from elevated political ad spend, strong e-commerce growth in international markets, and AI-driven efficiency improvements that expand the ROI case for digital. The secular shift from linear TV (still $60B+ in annual US spend) to digital/streaming creates a multi-year tailwind.

### Competitive Position
Meta's competitive moat rests on three pillars: (1) network effects — 3.3B users create a self-reinforcing engagement loop that is mathematically impossible to replicate; (2) data flywheel — first-party data plus AI inference yields best-in-class targeting precision; (3) advertiser switching costs — 10+ years of conversion attribution data makes switching to an alternative platform prohibitively expensive for SMBs who represent 60% of ad revenue.

## V. FINANCIAL ANALYSIS

### Revenue & Profitability Trends
Revenue grew from $86B in FY2020 to $164B in FY2024, a 17% CAGR. The critical inflection was the "Year of Efficiency" restructuring in 2023 that drove operating margin from 25% back above 35%, hitting 41% in FY2024 — the highest in the company's public history. Net income more than doubled from $23B in 2022 to $62B in 2024 as operating leverage fully materialized.

Gross margins have been exceptionally stable at 78-81%, reflecting the near-zero marginal cost of digital advertising at scale. The cost structure is heavily R&D and S&M weighted, with both declining as a percentage of revenue post-restructuring.

### Balance Sheet & Capital Allocation
Meta ended FY2024 with $72B in cash and $28.8B in long-term debt, representing a net cash position of $43B — one of the strongest balance sheets in megacap technology. The company initiated a quarterly dividend of $0.50/share in Q1 2024 and has repurchased $45B in shares over the past three years.

Reality Labs represents the primary capital allocation debate: $17B in annual operating losses for an unproven mass-market AR/VR opportunity. Bulls view this as option value in the next computing platform; bears see it as a value-destructive distraction from the core advertising business.

### Free Cash Flow & CapEx
Free cash flow reached $52B in FY2024 (32% FCF margin), one of the highest absolute FCF figures in corporate history. CapEx guidance for 2025 is $60-65B as AI infrastructure investment accelerates significantly. This compresses near-term FCF but represents investment in advertising efficiency improvements with measurable payback, not speculative growth.

### Quality of Earnings & Cash Conversion
OCF/Net income ratio averages 1.4x, reflecting non-cash stock-based compensation as the primary wedge between accounting and cash earnings. Net income quality is high — revenue is cash-collected on 30-60 day terms, working capital needs are minimal, and the business has essentially zero inventory. SBC was $15B in 2024, representing 9% of revenue, an area of ongoing investor scrutiny.

## VI. VALUATION FRAMEWORK

### Current Valuation vs. Historical Range
META trades at 24.8x TTM P/E and 16.2x EV/EBITDA, representing a modest premium to the S&P 500 on P/E but a discount to the Mag-7 median of 27x. On a forward basis, consensus FY2025E implies 20.2x P/E — below the 5-year average of 25x and slightly below GOOGL at 22x, despite superior FCF margins and higher organic revenue growth.

The EV/FCF multiple of 27x appears more representative of intrinsic value given that the $17B Reality Labs operating loss meaningfully depresses reported EBITDA and net income. Adjusting for RL losses, the core advertising business trades at approximately 18x P/E — exceptional for a business generating $52B+ in FCF growing at 15-20% annually.

### Peer Valuation Context
Versus the digital advertising peer group, META screens as the most attractive on a growth-adjusted basis. The PEG ratio of 1.2x compares favorably to GOOGL at 1.4x and is dramatically below SNAP or PINS. The company trades at a modest premium to GOOGL in P/E terms but generates superior FCF margins, better ROIC, and has higher organic growth in its core business excluding RL losses.

### Implied Scenarios

Bear Case ($420): Reality Labs losses accelerate to $25B/year, regulatory action by the FTC results in operational restrictions on data sharing across apps, and AI Overviews in Google Search reduces top-of-funnel web traffic to advertisers. At 16x TTM earnings, implies 29% downside from current levels. Probability: 15%.

Base Case ($720): Current trajectory continues — 15% revenue CAGR, stable 40% operating margins, buybacks reduce share count by 2-3% annually. At 24x FY2025E earnings of $30, implies 21% upside. Probability: 60%.

Bull Case ($950): AI advertising platform creates structural step-up in advertiser ROAS driving revenue growth to 20%+ through FY2026. Reality Labs commercializes one killer AR consumer use case. At 28x FY2026E EPS of $34, implies 59% upside. Probability: 25%.

## VII. MANAGEMENT COMMENTARY & GUIDANCE

### Earnings Call Highlights
On the Q4 2024 earnings call, Zuckerberg articulated a clear framework: "2025 is an investment year, but every dollar we spend on AI infrastructure has a direct payback in ad efficiency improvement. We're not building for an uncertain future — we're building for revenue we can already see." This contrasts favorably with 2021-2022 when Reality Labs spending was presented without clear ROI frameworks, contributing to the multiple compression that took the stock from $380 to $88.

### Forward Guidance & Outlook
Management guided Q1 2025 revenue to $39.5-41.8B (consensus: $41.1B), implying continued 17-19% YoY growth. Full-year CapEx guidance of $60-65B surprised the market to the upside, driving the initial earnings day stock decline of 4%, but the market subsequently recovered as analysts clarified the AI infrastructure investment is immediately revenue-productive via Advantage+ ad targeting improvements.

## VIII. MANAGEMENT & GOVERNANCE

### Leadership & Track Record
Mark Zuckerberg (CEO, 40) has led the company since founding and has demonstrated exceptional adaptability through multiple platform shifts — from desktop to mobile, from feed to stories to short-form video, and now to AI-native applications. His ownership of 57% of voting control creates strong alignment but also meaningful governance concentration risk for minority shareholders.

CFO Susan Li (former VP of Finance, 38) has executed well on the "Year of Efficiency" discipline since her promotion following Sheryl Sandberg's departure in 2022. The broader management team is increasingly technical-AI-first, with key hires from Google DeepMind, OpenAI, and leading academic machine learning institutions.

### Capital Allocation Discipline
Capital allocation decision quality has improved materially since 2021. The $10B+ Reality Labs investment announced at the peak of metaverse hype has been rationalized with clearer milestones. The 2024 dividend initiation alongside buyback continuation signals confidence in FCF durability at scale. The $60-65B 2025 CapEx commitment is the key swing factor — bears view this as risk; bulls view it as the next advertising moat being constructed.

## IX. KEY RISKS

**Regulatory & Antitrust Risk**
The FTC antitrust lawsuit seeking to unwind the Instagram and WhatsApp acquisitions represents the single largest binary risk to the investment thesis. While historical precedent for unwinding consummated acquisitions is extremely limited, a forced divestiture would eliminate 30%+ of revenue and permanently shatter the Family of Apps network effect. **HIGH probability of continued litigation; LOW probability of forced structural remedy.**

**Apple ATT & Privacy Headwinds**
The 2021 Apple App Tracking Transparency framework caused an estimated $10B in revenue disruption in 2022. META has recovered through AI-powered probabilistic matching and conversion modeling, but further privacy regulation (EU Digital Markets Act enforcement, potential US federal privacy legislation) could re-impair the ad targeting advantage that took $10B and three years to rebuild. **MEDIUM probability; ongoing monitoring required.**

**TikTok Competition**
TikTok's rapid growth (170M+ US users) directly threatens the short-form video engagement that drives Reels CPM expansion. A US TikTok ban would be a significant near-term catalyst for share price; conversely, TikTok's continued presence represents ongoing engagement share risk particularly with Gen Z demographics. **MEDIUM probability of material impact on core engagement metrics.**

**AI CapEx Overspend Risk**
The $60-65B 2025 CapEx commitment represents a 50%+ increase YoY. If AI ad targeting improvements prove more incremental than transformative, this investment cycle could impair FCF for 2-3 years without the expected revenue offset that management is signaling. **LOW-MEDIUM probability given early signals of Advantage+ ROI payback already visible in advertiser data.**

**Reality Labs Drag**
At $17B+ in annual operating losses, Reality Labs continues to be a significant drag on reported earnings quality. If the AR/VR consumer market takes longer than 3-5 years to achieve mass-market adoption — as now seems increasingly likely given Quest 3 sales trajectory — continued losses at this scale will create growing shareholder pressure for a strategic review or spinout. **HIGH probability of continued losses through at least 2026.**

## X. NEWS ANALYSIS & MARKET INTELLIGENCE

### 1. Events Scorecard
Recent catalysts have been net positive for META. Q4 2024 earnings beat on revenue ($48.4B vs $47.0B consensus) and operating margin (48% vs 45% expected). The Llama 4 open-source model release in April 2025 was received constructively as a developer ecosystem play differentiating META from closed-model competitors. The FTC antitrust trial continuation is a persistent overhang but the market has largely discounted this given low probability of forced structural remedy.

### 2. Sentiment Trajectory
Buy-side sentiment has shifted from deeply skeptical (late 2022) to constructive (2023-2024) to increasingly bullish (2025). The primary sentiment driver is the AI advertising monetization story — advertisers are reporting 20-30% ROAS improvements from Advantage+ AI creative optimization tools. Short interest has declined from 2.8% to 1.4% of float over the past 12 months, reflecting the capitulation of the bear case on margins.

### 3. Analyst Positioning
Of 62 analysts covering META, 51 are Buy/Strong Buy, 10 are Hold, and 1 is Sell. The average price target is $697 with a bull target of $850 and a bear target of $420. Key dissenters cite valuation and CapEx risk. Notable upgrades include Goldman Sachs (PT raised to $820) and Morgan Stanley (upgraded to Overweight with $750 PT) following Q4 earnings.

### 4. What's Priced In
The market is pricing in continued ~17% revenue CAGR through 2026 and stable 40%+ operating margins. AI CapEx payback is being assumed but not quantified in most sell-side models. Reality Labs losses are being zeroed out (no terminal value assigned). A partial TikTok ban benefit is estimated to be priced into approximately 10-15% of upside in consensus price targets.

### 5. Near-Term Catalysts
Q1 2025 earnings (April 30) is the next major catalyst — consensus expects $41.1B revenue and $4.68 EPS. Any management commentary on AI ad ROAS data from the spring Upfront advertising season could drive estimate revisions. Llama 4 commercial API monetization framework announcement expected H2 2025. FTC trial verdict on Instagram/WhatsApp ownership is the key binary risk catalyst within the 12-month investment horizon.

## XI. INVESTMENT THESIS

Meta Platforms is the most compelling large-cap opportunity in our coverage universe at current valuations. The company has structurally repriced its cost base through the 2022-2023 restructuring, is benefiting from AI-driven advertising efficiency improvements that create a widening competitive moat, and generates $52B+ in annual free cash flow at a below-market multiple given the earnings drag from Reality Labs.

### Bull Case
• AI advertising platform driving structural ROAS improvements creates pricing power that competitors with smaller data sets cannot match or replicate
• Reels CPM gap to feed continues to close — 60% closed as of Q4 2024, with the remaining 40% representing pure incremental revenue as format matures
• WhatsApp Business monetization in emerging markets is a $20B+ annual revenue opportunity largely unmodeled by consensus sell-side estimates
• Reality Labs AR glasses (Project Orion) could achieve mainstream adoption by 2027, opening a hardware and services TAM exceeding $100B annually
• Buyback program at current pace retires approximately 3% of shares annually, adding a mechanical 3% annual EPS accretion on top of organic earnings growth
• Regulatory risk has LOW probability of forced structural remedy based on all available legal precedent for consummated acquisitions of this vintage

### Bear Case
• $60-65B CapEx guidance indicates AI investment phase is not yet complete; FCF compression in 2025-2026 could disappoint income-oriented shareholders rotating out of growth
• Apple ATT 2.0 or analogous US federal privacy regulation could re-impair the ad targeting advantage META spent $10B rebuilding over 2022-2024
• TikTok, YouTube Shorts, and Amazon's growing ad network continue to capture incremental digital ad budget from upper-funnel brand campaigns
• FTC antitrust litigation creates a permanent uncertainty premium that caps the P/E multiple expansion potential regardless of earnings growth
• Mark Zuckerberg's 57% voting control limits the effectiveness of institutional shareholder pressure if capital allocation decisions deteriorate

## XII. KEY METRICS DASHBOARD

Key performance indicators tracking thesis integrity: Daily Active People growth above 3% YoY confirms platform health and engagement durability. Average Revenue Per User expansion above 10% confirms pricing power. Operating margin above 38% confirms cost discipline is maintained. FCF conversion above 85% of net income confirms earnings quality. CapEx as percentage of revenue declining by FY2026 confirms AI investment cycle is peaking rather than permanently structurally higher.

## XIII. EARNINGS CALL QUESTIONS

**Question 1 on AI monetization**: Given that Advantage+ AI creative tools are reportedly delivering 20-30% ROAS improvements for advertisers, at what point do you expect to capture a portion of that value creation through pricing (higher CPMs) rather than purely through volume (more impressions)? Has your auction clearing price dynamic fundamentally changed?

**Question 2 on Reality Labs**: At what specific unit economics milestone or quarterly revenue threshold would the board consider spinning out or externally financing Reality Labs to surface its value independently and eliminate the EPS drag on the core advertising business?
`,
};
