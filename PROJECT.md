# CrossAsset — Project Handoff

## What this is
A premium macro intelligence web app for finance students/interns. Looks and feels like an institutional hedge-fund tool. Built with Next.js (App Router), TypeScript, Tailwind CSS v4.

## Tech stack
- **Framework**: Next.js (App Router, `app/` directory)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 — utility classes only, no config overrides needed
- **Fonts**: Cormorant Garamond (`--font-serif`), Geist Sans (`--font-sans`), Geist Mono (`--font-mono`) — loaded via `next/font/google` in `app/layout.tsx`
- **Icons**: `lucide-react`
- **AI**: Anthropic Claude via `@anthropic-ai/sdk` (server-side only)
- **Data**: FRED API (server-side only) with demo fallback
- **Persistence**: `localStorage` for watchlist, tasks, archive

## Design system
- Background: pure white `#ffffff`
- Primary text: `#0a0a0a`
- Navy accent (sidebar, labels, tags): `#0c1b38`
- Muted text: `#888`, `#999`
- Borders: `#e8e8e8`, `#ebebeb`
- Section labels: `text-[11px] font-bold tracking-[0.18em] uppercase text-[#0c1b38]`
- Page headings: `font-light` with `fontFamily: var(--font-serif)` (Cormorant Garamond)
- No dark mode. White background only.

---

## File map — what each file does

### Layout (edit these to change the chrome)
| File | What it controls |
|------|-----------------|
| `components/layout/Sidebar.tsx` | Left navy sidebar, logo, nav links |
| `components/layout/Topbar.tsx` | Top white bar, date, DEMO badge |
| `components/layout/AppShell.tsx` | Wraps every page — sets margins/padding |
| `components/layout/CrossAssetLogo.tsx` | The logo mark + wordmark SVG component |
| `app/globals.css` | Global CSS resets only |
| `app/layout.tsx` | Root HTML layout, font variables |

### Pages (edit these to change page content/UI)
| File | Route | Notes |
|------|-------|-------|
| `app/page.tsx` | `/` | Dashboard — metric grid, regime strip, summary |
| `app/issue/page.tsx` | `/issue` | Daily Issue — loads from localStorage or demo |
| `app/watchlist/page.tsx` | `/watchlist` | Watchlist — localStorage CRUD |
| `app/reaction-tracker/page.tsx` | `/reaction-tracker` | Trade reaction log |
| `app/calendar/page.tsx` | `/calendar` | Macro calendar, .ics download |

### Data & AI (edit these to change data sources or AI behavior)
| File | What it does |
|------|-------------|
| `lib/data/demoData.ts` | All demo/placeholder data — **edit this to change what shows on screen** |
| `lib/types.ts` | TypeScript interfaces for all data shapes |
| `lib/sources/fred.ts` | Fetches live macro data from FRED API |
| `lib/ai/claude.ts` | Calls Claude API to generate a macro brief |
| `app/api/generate-issue/route.ts` | POST endpoint — triggers FRED fetch + Claude generation |
| `app/api/macro-data/route.ts` | GET endpoint — returns FRED data or demo fallback |

### Components
| File | What it does |
|------|-------------|
| `components/cards/MetricCard.tsx` | Single metric display card |
| `components/cards/MacroCard.tsx` | Macro summary card |
| `components/charts/MacroCharts.tsx` | Recharts-based macro charts |
| `components/ui/button.tsx` | shadcn button primitive |

---

## Key patterns

### Adding a new page
1. Create `app/your-page/page.tsx`
2. Wrap content in `<AppShell>` (imported from `@/components/layout/AppShell`)
3. Add to the `NAV` array in `components/layout/Sidebar.tsx`

### Changing demo data (what shows on screen without API keys)
Edit `lib/data/demoData.ts`. The exports are:
- `DEMO_MACRO_DATA` — rates, inflation, growth, commodities numbers
- `DEMO_ISSUE` — full daily macro brief (headline, summary, talking points, watchlist impact)
- `DEMO_WATCHLIST` — watchlist tickers
- `DEMO_REACTIONS` — reaction tracker entries
- `DEMO_CALENDAR` — upcoming macro events

### Changing colors / fonts
All styling is inline Tailwind classes or inline `style={{}}` props. There is no central theme file. Search for the hex color or class you want to change.

### Environment variables (needed for live data + AI)
```
ANTHROPIC_API_KEY=   # Claude API — for Generate Brief button
FRED_API_KEY=        # FRED — for live macro data
```
Without these, the app runs entirely on demo data. Set them in `.env.local`.

---

## What's done
- [x] All 5 pages built with demo data: Dashboard, Daily Issue, Watchlist, Reaction Tracker, Calendar
- [x] Sidebar navigation, topbar, AppShell layout
- [x] CrossAsset logo (SVG mark + Cormorant Garamond wordmark)
- [x] FRED API integration with demo fallback
- [x] Claude API integration (`/api/generate-issue`)
- [x] Calendar .ics download
- [x] Watchlist localStorage CRUD

## What's not done yet
- [ ] "Generate Brief" button on dashboard wired up end-to-end
- [ ] Archive page (list of past issues saved to localStorage)
- [ ] Settings page (API key status, demo toggle)
- [ ] Real chart data (MacroCharts uses placeholder data)
- [ ] Mobile layout (currently desktop-only)

---

## Running locally
```bash
# Requires Node 20+
npm install
npm run dev
# → http://localhost:3000
```

## GitHub
https://github.com/ysyrotych/CrossAsset
