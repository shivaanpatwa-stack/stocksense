import { useState, useRef } from 'react';
import Head from 'next/head';
import { scoreStock, buildClaudePrompt, fmtPrice, fmtPct, fmtCr, fmtNum } from '../lib/utils';

const POPULAR = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'WIPRO', 'BAJFINANCE', 'ZOMATO', 'ADANIENT', 'IRFC', 'DIXON'];

function MetricCard({ label, value, sub, color }) {
  const colorMap = {
    green: 'text-green-400',
    red: 'text-red-400',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
    default: 'text-white',
  };
  return (
    <div className="metric-card">
      <p className="text-xs font-mono uppercase tracking-widest text-text-muted mb-1">{label}</p>
      <p className={`text-lg font-display font-semibold ${colorMap[color] || colorMap.default}`}>{value}</p>
      {sub && <p className="text-xs text-text-secondary mt-0.5">{sub}</p>}
    </div>
  );
}

function SignalBadge({ signal }) {
  const cfg = {
    positive: { bg: 'bg-green-500/10 border-green-500/30 text-green-400', dot: 'bg-green-400' },
    negative: { bg: 'bg-red-500/10 border-red-500/30 text-red-400', dot: 'bg-red-400' },
    caution: { bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400', dot: 'bg-amber-400' },
    neutral: { bg: 'bg-blue-500/10 border-blue-500/30 text-blue-400', dot: 'bg-blue-400' },
  };
  const c = cfg[signal.type] || cfg.neutral;
  return (
    <div className={`border rounded-lg p-3 ${c.bg}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot} flex-shrink-0`} />
        <span className="text-xs font-mono font-medium uppercase tracking-wider">{signal.label}</span>
      </div>
      <p className="text-xs text-text-secondary leading-relaxed">{signal.detail}</p>
    </div>
  );
}

function HistoryBar({ history, field, label, color }) {
  if (!history || history.length === 0) return null;
  const vals = history.map(h => h[field]).filter(v => v != null);
  if (vals.length === 0) return null;
  const max = Math.max(...vals.map(Math.abs));
  return (
    <div>
      <p className="text-xs font-mono uppercase tracking-widest text-text-muted mb-2">{label}</p>
      <div className="flex items-end gap-2 h-16">
        {history.map((h, i) => {
          const val = h[field];
          if (val == null) return null;
          const pct = max > 0 ? (Math.abs(val) / max) * 100 : 20;
          const isNeg = val < 0;
          return (
            <div key={i} className="flex flex-col items-center flex-1 gap-1">
              <div className="w-full flex flex-col justify-end" style={{ height: '48px' }}>
                <div
                  className={`w-full rounded-sm ${isNeg ? 'bg-red-500/50' : color}`}
                  style={{ height: `${Math.max(4, pct * 0.48)}px` }}
                />
              </div>
              <span className="text-[10px] text-text-muted font-mono">{h.year}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [scoring, setScoring] = useState(null);
  const resultsRef = useRef(null);

  const search = async (ticker) => {
    const t = (ticker || query).trim().toUpperCase();
    if (!t) return;
    setLoading(true);
    setError('');
    setData(null);
    setScoring(null);

    try {
      const res = await fetch(`/api/stock?ticker=${encodeURIComponent(t)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch data');
      const sc = scoreStock(json);
      setData(json);
      setScoring(sc);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const openClaude = () => {
    if (!data || !scoring) return;
    const prompt = buildClaudePrompt(data, scoring);
    const url = `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
    window.open(url, '_blank');
  };

  const verdictColors = {
    buy: { badge: 'bg-green-500/15 text-green-400 border-green-500/30', glow: 'verdict-buy', score: 'text-green-400' },
    hold: { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30', glow: 'verdict-hold', score: 'text-amber-400' },
    sell: { badge: 'bg-red-500/15 text-red-400 border-red-500/30', glow: 'verdict-sell', score: 'text-red-400' },
  };
  const vc = scoring ? verdictColors[scoring.verdictClass] : null;

  return (
    <>
      <Head>
        <title>StockSense — AI Stock Analyser for Indian Markets</title>
        <meta name="description" content="Analyse Indian stocks with real financial data, rule-based scoring, and AI-powered insight via Claude." />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%231a6fff'/><text y='24' x='6' font-size='20' fill='white'>S</text></svg>" />
      </Head>

      <div className="min-h-screen grid-bg relative overflow-x-hidden">
        {/* Ambient glow */}
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />

        {/* Nav */}
        <nav className="border-b border-border-dim px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 12L6 7L9 10L12 5L14 7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-white">StockSense</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-text-secondary font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              NSE / BSE Live
            </span>
            <a href="#" className="hover:text-blue transition-colors">Powered by Yahoo Finance</a>
          </div>
        </nav>

        {/* Hero */}
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border text-xs font-mono text-blue mb-6 bg-blue-dim">
            <span>Indian Markets · NSE · BSE · Real Data</span>
          </div>
          <h1 className="font-display font-bold text-5xl md:text-6xl tracking-tight text-white mb-4 leading-tight">
            Analyse Any Indian<br />
            <span className="text-blue">Stock in Seconds</span>
          </h1>
          <p className="text-text-secondary text-lg max-w-xl mx-auto mb-10">
            Real financial data — P/E, P/B, ROE, margins, debt, growth — scored automatically. Then send to Claude for plain-English AI analysis.
          </p>

          {/* Search */}
          <div className="max-w-xl mx-auto">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && search()}
                  placeholder="Enter ticker — e.g. RELIANCE, TCS, ZOMATO"
                  className="w-full bg-bg-card border border-border rounded-xl px-4 py-3.5 text-white placeholder:text-text-muted font-mono text-sm focus:outline-none focus:border-blue transition-colors"
                />
              </div>
              <button
                onClick={() => search()}
                disabled={loading}
                className="px-6 py-3.5 bg-blue hover:bg-blue-bright disabled:opacity-50 text-white font-display font-semibold rounded-xl transition-all text-sm"
              >
                {loading ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : 'Analyse'}
              </button>
            </div>

            {error && (
              <div className="mt-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-mono">
                {error}
              </div>
            )}

            {/* Popular chips */}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {POPULAR.map(t => (
                <button
                  key={t}
                  onClick={() => { setQuery(t); search(t); }}
                  className="px-3 py-1 text-xs font-mono bg-bg-elevated border border-border-dim hover:border-border hover:text-white text-text-secondary rounded-full transition-all"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="max-w-6xl mx-auto px-6 pb-16">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="metric-card shimmer h-20 rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {data && scoring && !loading && (
          <div ref={resultsRef} className="max-w-6xl mx-auto px-6 pb-20 animate-fade-up">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8 pb-6 border-b border-border-dim">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="font-display font-bold text-3xl text-white">{data.name}</h2>
                  <span className="text-xs font-mono px-2 py-1 rounded-md bg-bg-elevated border border-border-dim text-text-secondary">{data.ticker}</span>
                </div>
                <p className="text-text-secondary text-sm">{data.exchange} · {data.sector || 'N/A'} · {data.industry || 'N/A'}</p>
              </div>
              <div className="text-right">
                <div className="font-display font-bold text-4xl text-white">{fmtPrice(data.price)}</div>
                <div className={`text-sm font-mono ${data.changePct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {data.changePct >= 0 ? '▲' : '▼'} {Math.abs(data.changePct || 0).toFixed(2)}% today
                </div>
              </div>
            </div>

            {/* Verdict Card */}
            <div className={`glass-card rounded-2xl p-6 mb-8 border-2 ${vc?.glow} ${vc?.badge}`} style={{ borderColor: undefined }}>
              <div className={`glass-card rounded-2xl p-6 mb-0 ${scoring.verdictClass === 'buy' ? 'verdict-buy' : scoring.verdictClass === 'hold' ? 'verdict-hold' : 'verdict-sell'}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`font-display font-black text-5xl ${vc?.score}`}>{scoring.verdict}</div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-text-secondary uppercase tracking-widest">Fundamental Score</span>
                        <span className={`font-mono font-bold ${vc?.score}`}>{scoring.score}/100</span>
                      </div>
                      <p className="text-sm text-text-secondary max-w-md">{scoring.verdictDetail}</p>
                    </div>
                  </div>
                  <button
                    onClick={openClaude}
                    className="flex items-center gap-2.5 px-5 py-3 bg-blue hover:bg-blue-bright text-white font-display font-semibold rounded-xl transition-all text-sm whitespace-nowrap"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M5 8h6M9 6l2 2-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Deep Analyse with Claude AI
                  </button>
                </div>
              </div>
            </div>

            {/* Key metrics grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <MetricCard label="Market Cap" value={fmtCr(data.marketCap)} sub="Total company value" />
              <MetricCard label="P/E Ratio" value={data.peRatio ?? '—'} sub={`Forward: ${data.forwardPE ?? '—'}`} color={data.peRatio < 20 ? 'green' : data.peRatio > 40 ? 'red' : 'default'} />
              <MetricCard label="P/B Ratio" value={data.pbRatio ?? '—'} sub="Price to Book" color={data.pbRatio < 1 ? 'green' : data.pbRatio > 8 ? 'red' : 'default'} />
              <MetricCard label="EPS" value={`₹${data.eps ?? '—'}`} sub="Earnings per share" color={data.eps > 0 ? 'green' : 'red'} />
              <MetricCard label="52W High" value={fmtPrice(data.week52High)} sub={`${data.week52HighPct?.toFixed(1) ?? '—'}% from now`} />
              <MetricCard label="52W Low" value={fmtPrice(data.week52Low)} sub={`${Math.abs(data.week52LowPct || 0).toFixed(1)}% from now`} />
              <MetricCard label="ROE" value={`${data.roe?.toFixed(1) ?? '—'}%`} sub="Return on equity" color={data.roe >= 20 ? 'green' : data.roe < 5 ? 'red' : 'default'} />
              <MetricCard label="Dividend Yield" value={`${data.dividendYield?.toFixed(2) ?? '0.00'}%`} sub={`₹${data.dividendRate ?? '0'}/share`} color={data.dividendYield > 2 ? 'green' : 'default'} />
            </div>

            {/* Two-column detail */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Profitability */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="font-display font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue" />
                  Profitability
                </h3>
                <div className="space-y-3">
                  {[
                    { label: 'Gross Margin', value: `${data.grossMargin?.toFixed(1) ?? '—'}%`, good: data.grossMargin > 30 },
                    { label: 'Operating Margin', value: `${data.operatingMargin?.toFixed(1) ?? '—'}%`, good: data.operatingMargin > 15 },
                    { label: 'Net Margin', value: `${data.netMargin?.toFixed(1) ?? '—'}%`, good: data.netMargin > 10, bad: data.netMargin < 0 },
                    { label: 'ROE', value: `${data.roe?.toFixed(1) ?? '—'}%`, good: data.roe >= 20, bad: data.roe < 5 },
                    { label: 'ROA', value: `${data.roa?.toFixed(1) ?? '—'}%`, good: data.roa > 5 },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between py-2 border-b border-border-dim last:border-0">
                      <span className="text-sm text-text-secondary">{row.label}</span>
                      <span className={`text-sm font-mono font-medium ${row.bad ? 'text-red-400' : row.good ? 'text-green-400' : 'text-white'}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Balance Sheet */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="font-display font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue" />
                  Balance Sheet & Liquidity
                </h3>
                <div className="space-y-3">
                  {[
                    { label: 'Debt / Equity', value: data.debtToEquity?.toFixed(2) ?? '—', good: data.debtToEquity < 0.5, bad: data.debtToEquity > 2 },
                    { label: 'Current Ratio', value: data.currentRatio?.toFixed(2) ?? '—', good: data.currentRatio > 1.5, bad: data.currentRatio < 1 },
                    { label: 'Total Debt', value: fmtCr(data.totalDebtCr), bad: data.debtToEquity > 2 },
                    { label: 'Cash & Equivalents', value: fmtCr(data.totalCashCr), good: data.totalCashCr > 0 },
                    { label: 'Free Cash Flow', value: fmtCr(data.freeCashFlowCr), good: data.freeCashFlowCr > 0, bad: data.freeCashFlowCr < 0 },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between py-2 border-b border-border-dim last:border-0">
                      <span className="text-sm text-text-secondary">{row.label}</span>
                      <span className={`text-sm font-mono font-medium ${row.bad ? 'text-red-400' : row.good ? 'text-green-400' : 'text-white'}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Growth */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="font-display font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue" />
                  Growth Indicators
                </h3>
                <div className="space-y-3">
                  {[
                    { label: 'Revenue Growth YoY', value: `${data.revenueGrowthYoY?.toFixed(1) ?? '—'}%`, good: data.revenueGrowthYoY > 10, bad: data.revenueGrowthYoY < 0 },
                    { label: 'Earnings Growth YoY', value: `${data.earningsGrowthYoY?.toFixed(1) ?? '—'}%`, good: data.earningsGrowthYoY > 15, bad: data.earningsGrowthYoY < 0 },
                    { label: 'Qtrly Earnings Growth', value: `${data.earningsQuarterlyGrowth?.toFixed(1) ?? '—'}%`, good: data.earningsQuarterlyGrowth > 10, bad: data.earningsQuarterlyGrowth < 0 },
                    { label: 'EV/EBITDA', value: data.evToEbitda?.toFixed(1) ?? '—' },
                    { label: 'EV/Revenue', value: data.evToRevenue?.toFixed(2) ?? '—' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between py-2 border-b border-border-dim last:border-0">
                      <span className="text-sm text-text-secondary">{row.label}</span>
                      <span className={`text-sm font-mono font-medium ${row.bad ? 'text-red-400' : row.good ? 'text-green-400' : 'text-white'}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Analyst */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="font-display font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue" />
                  Analyst Consensus
                </h3>
                {data.targetPriceMean ? (
                  <>
                    <div className="flex items-end gap-3 mb-4">
                      <div>
                        <p className="text-xs text-text-muted font-mono uppercase tracking-widest mb-1">Mean Target</p>
                        <p className="font-display font-bold text-3xl text-white">₹{data.targetPriceMean}</p>
                      </div>
                      <div className={`text-sm font-mono font-medium mb-1 ${((data.targetPriceMean - data.price) / data.price * 100) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {fmtPct(((data.targetPriceMean - data.price) / data.price * 100))} potential
                      </div>
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: 'High Target', value: fmtPrice(data.targetPriceHigh) },
                        { label: 'Low Target', value: fmtPrice(data.targetPriceLow) },
                        { label: 'Recommendation', value: (data.recommendationKey || '—').toUpperCase() },
                        { label: 'Analysts Covering', value: data.numberOfAnalysts ?? '—' },
                      ].map(row => (
                        <div key={row.label} className="flex items-center justify-between py-2 border-b border-border-dim last:border-0">
                          <span className="text-sm text-text-secondary">{row.label}</span>
                          <span className="text-sm font-mono font-medium text-white">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-text-muted text-sm">No analyst coverage data available.</p>
                )}
              </div>
            </div>

            {/* Historical bars */}
            {data.incomeHistory?.length > 0 && (
              <div className="glass-card rounded-2xl p-6 mb-8">
                <h3 className="font-display font-semibold text-white mb-6 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue" />
                  Historical Financials (₹ Cr)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <HistoryBar history={data.incomeHistory} field="revenue" label="Revenue" color="bg-blue-500/60" />
                  <HistoryBar history={data.incomeHistory} field="netIncome" label="Net Income / Loss" color="bg-green-500/60" />
                  <HistoryBar history={data.incomeHistory} field="grossProfit" label="Gross Profit" color="bg-purple-500/60" />
                </div>
              </div>
            )}

            {/* Signal flags */}
            <div className="glass-card rounded-2xl p-6 mb-8">
              <h3 className="font-display font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue" />
                Signal Flags ({scoring.signals.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {scoring.signals.map((s, i) => <SignalBadge key={i} signal={s} />)}
              </div>
            </div>

            {/* Claude CTA */}
            <div className="glass-card rounded-2xl p-8 text-center border border-border">
              <div className="w-12 h-12 rounded-2xl bg-blue/20 border border-blue/30 flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#1a6fff" strokeWidth="1.5"/>
                  <path d="M8 12h8M14 9l3 3-3 3" stroke="#1a6fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-2">Want a deeper analysis?</h3>
              <p className="text-text-secondary text-sm mb-6 max-w-md mx-auto">
                All the numbers above will be auto-packaged into a prompt and sent to Claude AI. You'll get a plain-English breakdown — what the business does, what the numbers mean, risks, and a final verdict.
              </p>
              <button
                onClick={openClaude}
                className="inline-flex items-center gap-2.5 px-6 py-3 bg-blue hover:bg-blue-bright text-white font-display font-semibold rounded-xl transition-all"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M5 8h6M9 6l2 2-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Open Full AI Analysis in Claude
              </button>
            </div>
          </div>
        )}

        {/* How it works section (shown when no data) */}
        {!data && !loading && (
          <div className="max-w-6xl mx-auto px-6 pb-20">
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: '01', title: 'Enter any Indian stock', desc: 'Type the NSE/BSE ticker. Large caps, mid caps, small caps, recent IPOs — all supported.' },
                { icon: '02', title: 'Get instant fundamentals', desc: 'Real data from Yahoo Finance: P/E, P/B, ROE, margins, debt ratios, growth, analyst targets.' },
                { icon: '03', title: 'Send to Claude for AI insight', desc: 'One click packages everything into a prompt. Claude gives you a full plain-English verdict.' },
              ].map(step => (
                <div key={step.icon} className="glass-card rounded-2xl p-6">
                  <div className="font-mono text-4xl font-bold text-blue-dim text-blue mb-4">{step.icon}</div>
                  <h3 className="font-display font-semibold text-white text-lg mb-2">{step.title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="border-t border-border-dim py-6 px-6 max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-text-muted font-mono">
            <span>StockSense · Built for Indian markets · Data via Yahoo Finance</span>
            <span>Not financial advice. Always do your own research.</span>
          </div>
        </footer>
      </div>
    </>
  );
}
