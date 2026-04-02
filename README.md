# StockSense — AI Stock Analyser for Indian Markets

A standalone stock analysis website built with Next.js. Fetches real financial data from Yahoo Finance (free, no API key needed) and uses a rule-based scoring engine. One click sends a full analysis prompt to Claude AI for plain-English insight.

## Features
- Real-time data: P/E, P/B, EPS, ROE, margins, debt, growth, analyst targets
- Rule-based scoring (0–100) with Buy / Hold / Avoid verdict
- Historical financials bar chart (4 years)
- Signal flags with plain-English explanations
- "Analyse with Claude" button — opens claude.ai with all data pre-packaged as a prompt
- Midnight Blueprint dark aesthetic
- Works for NSE & BSE stocks

## Stack
- Next.js 16
- Tailwind CSS
- yahoo-finance2 (free, unofficial Yahoo Finance API)
- Screener.in (fundamentals, pros/cons)
- Vercel (free tier)

---

## Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd stocksense
npm install
```

### 2. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 3. Deploy to Vercel

**Option A — Vercel CLI (same as your portfolio)**
```bash
npm install -g vercel
vercel
```

**Option B — GitHub + Vercel dashboard**
1. Push this repo to GitHub
2. Go to vercel.com → New Project → Import your repo
3. Framework: Next.js (auto-detected)
4. No environment variables needed
5. Deploy

---

## Usage

1. Type any NSE ticker in the search box (e.g. `RELIANCE`, `TCS`, `ZOMATO`)
2. If it doesn't find it, try adding `.NS` (NSE) or `.BO` (BSE) — e.g. `RELIANCE.NS`
3. Hit Analyse
4. Review the metrics, score, and signal flags
5. Click **"Deep Analyse with Claude AI"** — it opens claude.ai with a perfectly packaged prompt
6. Claude (your Pro plan) gives you the full AI analysis for free

---

## How the scoring works

The rule-based scorer checks:
- **Valuation**: P/E, P/B (is it cheap or expensive?)
- **Profitability**: Net margin, ROE (does it make good money?)
- **Growth**: Revenue & earnings growth YoY (is it expanding?)
- **Debt**: D/E ratio, free cash flow (is the balance sheet healthy?)
- **Analyst consensus**: Target price vs current price (what do the pros think?)

Score 65+ → BUY | Score 45–64 → HOLD | Below 45 → AVOID

---

## Tips
- For IPOs, data may be limited — Yahoo Finance takes a few months to populate all fundamentals
- Some small-caps may not have analyst coverage data
- The Claude AI analysis button works best with your Claude Pro plan — it opens a new chat with everything pre-filled

---

## Linking from your portfolio

Add this to your portfolio's nav or links page:
```
https://your-stocksense-url.vercel.app
```

Or embed as an iframe in your Finance Lab page.

---

*Not financial advice. Always do your own research before investing.*
 
