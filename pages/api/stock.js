import yahooFinance from 'yahoo-finance2';

async function fetchScreener(symbol) {
  const urls = [
    `https://www.screener.in/company/${symbol}/consolidated/`,
    `https://www.screener.in/company/${symbol}/`,
  ];

  let html = null;
  let usedUrl = null;

  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': 'https://www.screener.in/',
        },
        signal: AbortSignal.timeout(10000),
      });
      if (r.ok) {
        html = await r.text();
        usedUrl = url;
        break;
      }
    } catch (_) {}
  }

  if (!html) return null;

  const ratioSection = html.match(/id="top-ratios"[\s\S]{0,6000}/)?.[0] || html;

  const extractFromRatios = (label) => {
    const re = new RegExp(label + '[\\s\\S]{0,200}?([\\d,]+\\.?\\d*)', 'i');
    const m = ratioSection.match(re);
    return m ? parseFloat(m[1].replace(/,/g, '')) : null;
  };

  const marketCap = extractFromRatios('Market Cap');
  const peRatio   = extractFromRatios('Stock P\\/E');
  const bookValue = extractFromRatios('Book Value');
  const dividendYield = extractFromRatios('Dividend Yield');
  const roce = extractFromRatios('ROCE');
  const roe  = extractFromRatios('ROE');

  const priceMatch =
    html.match(/id="market-cap-section"[\s\S]{0,500}?₹\s*([\d,]+\.?\d*)/) ||
    html.match(/Current Price[\s\S]{0,200}?([\d,]+\.?\d*)/) ||
    html.match(/"price":\s*"?([\d.]+)"?/);
  const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;

  const highLowMatch = ratioSection.match(/High \/ Low[\s\S]{0,300}?([\d,]+)[\s\S]{0,50}?\/([\s\S]{0,10}?)([\d,]+)/);
  const week52High = highLowMatch ? parseFloat(highLowMatch[1].replace(/,/g, '')) : null;
  const week52Low  = highLowMatch ? parseFloat(highLowMatch[3].replace(/,/g, '')) : null;

  const pbRatio = (price && bookValue && bookValue > 0)
    ? parseFloat((price / bookValue).toFixed(2))
    : null;

  const nameMatch = html.match(/<h1[^>]*>[\s]*([^<\n]{3,80})/i);
  const name = nameMatch ? nameMatch[1].trim() : symbol;

  const sectorMatch = html.match(/sector[^>]*href[^>]*>([^<]{3,40})</i);
  const sector = sectorMatch ? sectorMatch[1].trim() : null;

  const aboutMatch = html.match(/(?:About|company-profile)[^<]*<\/[^>]+>[\s\S]{0,100}<p[^>]*>([\s\S]{20,600}?)<\/p>/i);
  const about = aboutMatch ? aboutMatch[1].replace(/<[^>]+>/g, '').trim() : null;

  const prosSection = html.match(/class="pros"[\s\S]{0,2000}/)?.[0];
  const consSection = html.match(/class="cons"[\s\S]{0,2000}/)?.[0];
  const extractList = (section) => {
    if (!section) return [];
    const items = [];
    const re = /<li[^>]*>([\s\S]{10,300}?)<\/li>/gi;
    let m;
    while ((m = re.exec(section)) !== null) {
      const text = m[1].replace(/<[^>]+>/g, '').trim();
      if (text.length > 5) items.push(text);
      if (items.length >= 5) break;
    }
    return items;
  };

  const eps = (price && peRatio && peRatio > 0)
    ? parseFloat((price / peRatio).toFixed(2))
    : null;

  return {
    name, sector, about, screenerUrl: usedUrl,
    price, marketCap, peRatio, pbRatio, bookValue, eps,
    roe, roce, dividendYield, week52High, week52Low,
    pros: extractList(prosSection),
    cons: extractList(consSection),
  };
}

// Returns mapped Yahoo fields, or null if both tickers fail.
async function fetchYahoo(symbol) {
  const tickers = [`${symbol}.NS`, `${symbol}.BO`];

  for (const ticker of tickers) {
    try {
      const [quote, summary] = await Promise.all([
        yahooFinance.quote(ticker),
        yahooFinance.quoteSummary(ticker, {
          modules: ['financialData', 'defaultKeyStatistics'],
        }),
      ]);

      const fd = summary?.financialData  || {};
      const ks = summary?.defaultKeyStatistics || {};

      // yahoo-finance2 returns plain numbers; guard against legacy {raw} shape
      const get = (obj, key) => {
        const v = obj?.[key];
        if (v == null) return null;
        if (typeof v === 'object' && 'raw' in v) return v.raw;
        return typeof v === 'number' ? v : null;
      };

      const pct  = (v) => v != null ? parseFloat((v * 100).toFixed(2))  : null; // decimal → %
      const toCr = (v) => v != null ? parseFloat((v / 1e7).toFixed(2))  : null; // INR → Crores
      const deRatio = (v) => v != null ? parseFloat((v / 100).toFixed(4)) : null; // Yahoo % → ratio

      return {
        // Profitability & returns
        grossMargin:      pct(get(fd, 'grossMargins')),
        operatingMargin:  pct(get(fd, 'operatingMargins')),
        netMargin:        pct(get(fd, 'profitMargins')),
        roe:              pct(get(fd, 'returnOnEquity')),
        roa:              pct(get(fd, 'returnOnAssets')),
        // Growth
        revenueGrowthYoY:  pct(get(fd, 'revenueGrowth')),
        earningsGrowthYoY: pct(get(fd, 'earningsGrowth')),
        // Balance sheet
        debtToEquity: deRatio(get(fd, 'debtToEquity')),
        currentRatio: get(fd, 'currentRatio'),
        totalDebtCr:  toCr(get(fd, 'totalDebt')),
        totalCashCr:  toCr(get(fd, 'totalCash')),
        freeCashFlowCr: toCr(get(fd, 'freeCashflow')),
        // Analyst targets
        targetPriceMean: get(fd, 'targetMeanPrice'),
        targetPriceLow:  get(fd, 'targetLowPrice'),
        targetPriceHigh: get(fd, 'targetHighPrice'),
        recommendationKey: typeof fd.recommendationKey === 'string'
          ? fd.recommendationKey
          : get(fd, 'recommendationKey'),
        numberOfAnalysts: get(fd, 'numberOfAnalystOpinions'),
        // 52-week from quote()
        week52High: quote?.fiftyTwoWeekHigh ?? get(ks, 'fiftyTwoWeekHigh'),
        week52Low:  quote?.fiftyTwoWeekLow  ?? get(ks, 'fiftyTwoWeekLow'),
      };
    } catch (_) {
      // try next ticker
    }
  }

  return null;
}

// Merge helper: keep 'a' unless it's null, then use 'b'.
const fill = (a, b) => a ?? b ?? null;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: 'Ticker is required' });

  const symbol = ticker.trim().toUpperCase().replace(/\.(NS|BO)$/i, '');

  // 1. Screener first — required
  const screener = await fetchScreener(symbol);
  if (!screener) {
    return res.status(404).json({
      error: `Could not fetch data for "${symbol}". Make sure it's a valid NSE/BSE ticker.`,
    });
  }

  // 2. Yahoo Finance — optional, wrapped so Screener data still returns if it fails
  let yahoo = null;
  try {
    yahoo = await fetchYahoo(symbol);
  } catch (_) {}

  // 3. Merge: Screener wins; Yahoo fills in where Screener returned null
  const data = {
    ticker: symbol,
    exchange: 'NSE',
    currency: 'INR',

    // Identity (Screener only)
    name:        screener.name,
    sector:      screener.sector,
    about:       screener.about,
    screenerUrl: screener.screenerUrl,
    pros:        screener.pros,
    cons:        screener.cons,

    // Price (Screener only)
    price:    screener.price,
    marketCap: screener.marketCap,
    peRatio:   screener.peRatio,
    pbRatio:   screener.pbRatio,
    bookValue: screener.bookValue,
    eps:       screener.eps,
    roce:      screener.roce,
    dividendYield: screener.dividendYield,

    // Screener first, Yahoo fallback
    roe:      fill(screener.roe,      yahoo?.roe),
    week52High: fill(screener.week52High, yahoo?.week52High),
    week52Low:  fill(screener.week52Low,  yahoo?.week52Low),

    // Yahoo only (no Screener equivalent)
    roa:              yahoo?.roa              ?? null,
    grossMargin:      yahoo?.grossMargin      ?? null,
    operatingMargin:  yahoo?.operatingMargin  ?? null,
    netMargin:        yahoo?.netMargin        ?? null,
    revenueGrowthYoY:  yahoo?.revenueGrowthYoY  ?? null,
    earningsGrowthYoY: yahoo?.earningsGrowthYoY ?? null,
    debtToEquity:    yahoo?.debtToEquity    ?? null,
    currentRatio:    yahoo?.currentRatio    ?? null,
    totalDebtCr:     yahoo?.totalDebtCr     ?? null,
    totalCashCr:     yahoo?.totalCashCr     ?? null,
    freeCashFlowCr:  yahoo?.freeCashFlowCr  ?? null,
    targetPriceMean: yahoo?.targetPriceMean ?? null,
    targetPriceLow:  yahoo?.targetPriceLow  ?? null,
    targetPriceHigh: yahoo?.targetPriceHigh ?? null,
    recommendationKey: yahoo?.recommendationKey ?? null,
    numberOfAnalysts:  yahoo?.numberOfAnalysts  ?? null,
  };

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
  return res.status(200).json(data);
}
