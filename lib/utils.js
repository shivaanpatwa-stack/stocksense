// Format a number as Indian Rupee with Cr/L/K suffixes
export function fmtINR(n) {
  if (n == null) return '—';
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)}L Cr`;
  if (Math.abs(n) >= 1e2) return `₹${n.toFixed(2)} Cr`;
  return `₹${n.toFixed(2)}`;
}

export function fmtNum(n, suffix = '', decimals = 2) {
  if (n == null) return '—';
  return `${parseFloat(n.toFixed(decimals)).toLocaleString('en-IN')}${suffix}`;
}

export function fmtPct(n) {
  if (n == null) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function fmtPrice(n) {
  if (n == null) return '—';
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtCr(n) {
  if (n == null) return '—';
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)}L Cr`;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr`;
}

export function fmtLargeNum(n) {
  if (n == null) return '—';
  if (n >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(2)} L`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)} K`;
  return String(n);
}

// Rule-based scoring: returns { score (0-100), verdict, signals }
export function scoreStock(d) {
  const signals = [];
  let score = 50; // neutral start

  // --- Valuation ---
  if (d.peRatio != null) {
    if (d.peRatio < 15) { score += 8; signals.push({ type: 'positive', label: 'Low P/E', detail: `P/E of ${d.peRatio} — stock may be undervalued relative to earnings` }); }
    else if (d.peRatio < 25) { score += 3; signals.push({ type: 'neutral', label: 'Fair P/E', detail: `P/E of ${d.peRatio} — reasonably valued` }); }
    else if (d.peRatio < 40) { score -= 3; signals.push({ type: 'caution', label: 'High P/E', detail: `P/E of ${d.peRatio} — priced for growth, needs strong earnings delivery` }); }
    else { score -= 8; signals.push({ type: 'negative', label: 'Very High P/E', detail: `P/E of ${d.peRatio} — significantly expensive, high risk if growth disappoints` }); }
  }

  if (d.pbRatio != null) {
    if (d.pbRatio < 1) { score += 6; signals.push({ type: 'positive', label: 'Below Book Value', detail: `P/B of ${d.pbRatio} — trading below assets, potential deep value` }); }
    else if (d.pbRatio < 3) { score += 2; signals.push({ type: 'neutral', label: 'Fair P/B', detail: `P/B of ${d.pbRatio} — fair book value` }); }
    else if (d.pbRatio > 8) { score -= 5; signals.push({ type: 'caution', label: 'High P/B', detail: `P/B of ${d.pbRatio} — expensive relative to book value` }); }
  }

  // --- Profitability ---
  if (d.roe != null) {
    if (d.roe >= 20) { score += 8; signals.push({ type: 'positive', label: 'Strong ROE', detail: `ROE of ${d.roe.toFixed(1)}% — excellent capital efficiency` }); }
    else if (d.roe >= 12) { score += 3; signals.push({ type: 'neutral', label: 'Decent ROE', detail: `ROE of ${d.roe.toFixed(1)}%` }); }
    else if (d.roe < 5) { score -= 5; signals.push({ type: 'negative', label: 'Weak ROE', detail: `ROE of ${d.roe.toFixed(1)}% — poor capital efficiency` }); }
  }

  if (d.netMargin != null) {
    if (d.netMargin >= 20) { score += 7; signals.push({ type: 'positive', label: 'High Net Margin', detail: `${d.netMargin.toFixed(1)}% net margin — very profitable business` }); }
    else if (d.netMargin >= 10) { score += 3; signals.push({ type: 'neutral', label: 'Healthy Net Margin', detail: `${d.netMargin.toFixed(1)}% net margin` }); }
    else if (d.netMargin < 0) { score -= 10; signals.push({ type: 'negative', label: 'Loss Making', detail: `Negative net margin — company is currently unprofitable` }); }
    else if (d.netMargin < 5) { score -= 3; signals.push({ type: 'caution', label: 'Thin Margins', detail: `${d.netMargin.toFixed(1)}% net margin — low profitability` }); }
  }

  // --- Growth ---
  if (d.revenueGrowthYoY != null) {
    if (d.revenueGrowthYoY >= 20) { score += 8; signals.push({ type: 'positive', label: 'High Revenue Growth', detail: `Revenue grew ${d.revenueGrowthYoY.toFixed(1)}% YoY — strong top-line expansion` }); }
    else if (d.revenueGrowthYoY >= 10) { score += 4; signals.push({ type: 'positive', label: 'Good Revenue Growth', detail: `Revenue grew ${d.revenueGrowthYoY.toFixed(1)}% YoY` }); }
    else if (d.revenueGrowthYoY < 0) { score -= 7; signals.push({ type: 'negative', label: 'Revenue Declining', detail: `Revenue fell ${Math.abs(d.revenueGrowthYoY).toFixed(1)}% — top-line shrinkage is a red flag` }); }
  }

  if (d.earningsGrowthYoY != null) {
    if (d.earningsGrowthYoY >= 25) { score += 8; signals.push({ type: 'positive', label: 'Strong Earnings Growth', detail: `Earnings grew ${d.earningsGrowthYoY.toFixed(1)}% YoY` }); }
    else if (d.earningsGrowthYoY < -10) { score -= 7; signals.push({ type: 'negative', label: 'Earnings Declining', detail: `Earnings fell ${Math.abs(d.earningsGrowthYoY).toFixed(1)}% — profitability under pressure` }); }
  }

  // --- Debt ---
  if (d.debtToEquity != null) {
    if (d.debtToEquity < 0.3) { score += 5; signals.push({ type: 'positive', label: 'Low Debt', detail: `D/E of ${d.debtToEquity.toFixed(2)} — strong balance sheet, low financial risk` }); }
    else if (d.debtToEquity < 1) { score += 1; signals.push({ type: 'neutral', label: 'Manageable Debt', detail: `D/E of ${d.debtToEquity.toFixed(2)}` }); }
    else if (d.debtToEquity > 2) { score -= 7; signals.push({ type: 'negative', label: 'High Debt', detail: `D/E of ${d.debtToEquity.toFixed(2)} — leveraged balance sheet, watch interest coverage` }); }
  }

  // --- Analyst target vs price ---
  if (d.targetPriceMean && d.price) {
    const upside = ((d.targetPriceMean - d.price) / d.price) * 100;
    if (upside >= 20) { score += 7; signals.push({ type: 'positive', label: 'Strong Analyst Upside', detail: `Analysts see ${upside.toFixed(1)}% upside to ₹${d.targetPriceMean}` }); }
    else if (upside >= 10) { score += 3; signals.push({ type: 'positive', label: 'Moderate Upside', detail: `Analysts see ${upside.toFixed(1)}% upside` }); }
    else if (upside < -10) { score -= 5; signals.push({ type: 'negative', label: 'Analyst Downside', detail: `Analysts price target is ${Math.abs(upside).toFixed(1)}% below current price` }); }
  }

  // --- Free cash flow ---
  if (d.freeCashFlowCr != null) {
    if (d.freeCashFlowCr > 0) { score += 4; signals.push({ type: 'positive', label: 'Positive Free Cash Flow', detail: `₹${d.freeCashFlowCr.toFixed(0)} Cr FCF — company generates real cash` }); }
    else { score -= 4; signals.push({ type: 'caution', label: 'Negative Free Cash Flow', detail: 'Company is a net cash burner — monitor carefully' }); }
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  let verdict, verdictClass, verdictDetail;
  if (score >= 65) {
    verdict = 'BUY';
    verdictClass = 'buy';
    verdictDetail = 'Fundamentals are strong across multiple dimensions. Risk-adjusted, this looks like a favourable entry point.';
  } else if (score >= 45) {
    verdict = 'HOLD';
    verdictClass = 'hold';
    verdictDetail = 'Mixed signals — some positives offset by concerns. Suitable to hold if already in; wait for a clearer catalyst before fresh entry.';
  } else {
    verdict = 'AVOID';
    verdictClass = 'sell';
    verdictDetail = 'Multiple red flags in fundamentals. Exercise caution — do deeper research before entering.';
  }

  return { score, verdict, verdictClass, verdictDetail, signals };
}

// Build the Claude prompt from stock data
export function buildClaudePrompt(d, scoring) {
  const lines = [
    `Analyse the following Indian stock and give me a detailed, plain-English investment analysis. Write like you're explaining to a smart 18-year-old who understands basic finance but not jargon.`,
    ``,
    `## Stock: ${d.name} (${d.ticker})`,
    `Exchange: ${d.exchange} | Sector: ${d.sector || 'N/A'} | Industry: ${d.industry || 'N/A'}`,
    ``,
    `## Current Price & Market`,
    `Price: ₹${d.price} | Change Today: ${d.changePct > 0 ? '+' : ''}${d.changePct}%`,
    `Market Cap: ₹${d.marketCap} Cr | 52W High: ₹${d.week52High} | 52W Low: ₹${d.week52Low}`,
    ``,
    `## Valuation Ratios`,
    `P/E (TTM): ${d.peRatio ?? 'N/A'} | Forward P/E: ${d.forwardPE ?? 'N/A'}`,
    `P/B: ${d.pbRatio ?? 'N/A'} | P/S: ${d.psRatio ?? 'N/A'} | EV/EBITDA: ${d.evToEbitda ?? 'N/A'}`,
    `EPS: ₹${d.eps ?? 'N/A'} | Book Value: ₹${d.bookValue ?? 'N/A'}`,
    ``,
    `## Profitability`,
    `Gross Margin: ${d.grossMargin ?? 'N/A'}% | Operating Margin: ${d.operatingMargin ?? 'N/A'}% | Net Margin: ${d.netMargin ?? 'N/A'}%`,
    `ROE: ${d.roe ?? 'N/A'}% | ROA: ${d.roa ?? 'N/A'}%`,
    ``,
    `## Growth (YoY)`,
    `Revenue Growth: ${d.revenueGrowthYoY ?? 'N/A'}% | Earnings Growth: ${d.earningsGrowthYoY ?? 'N/A'}%`,
    ``,
    `## Balance Sheet & Debt`,
    `Debt/Equity: ${d.debtToEquity ?? 'N/A'} | Current Ratio: ${d.currentRatio ?? 'N/A'}`,
    `Total Debt: ₹${d.totalDebtCr ?? 'N/A'} Cr | Cash: ₹${d.totalCashCr ?? 'N/A'} Cr | Free Cash Flow: ₹${d.freeCashFlowCr ?? 'N/A'} Cr`,
    ``,
    `## Analyst Consensus`,
    `Target (Mean): ₹${d.targetPriceMean ?? 'N/A'} | Range: ₹${d.targetPriceLow ?? 'N/A'} – ₹${d.targetPriceHigh ?? 'N/A'}`,
    `Recommendation: ${d.recommendationKey ?? 'N/A'} | Analysts covering: ${d.numberOfAnalysts ?? 'N/A'}`,
    ``,
    `## My Rule-Based Score`,
    `Score: ${scoring.score}/100 | Preliminary Verdict: ${scoring.verdict}`,
    `Key signals flagged: ${scoring.signals.map(s => s.label).join(', ')}`,
    ``,
    `---`,
    `Please provide:`,
    `1. **What this company does** — in 2-3 sentences, simple language`,
    `2. **What the numbers are saying** — walk through the key ratios, what's good, what's concerning`,
    `3. **Growth story** — is there a real growth thesis here?`,
    `4. **Risks** — what could go wrong?`,
    `5. **Final verdict** — Buy, Hold, or Avoid, with a clear 2-3 sentence reasoning`,
    `6. **One key thing to watch** — the single metric or event that will determine this stock's next move`,
    ``,
    `Keep it sharp, honest, and back every claim with the actual numbers above.`,
  ];
  return lines.join('\n');
}
