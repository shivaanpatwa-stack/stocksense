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

  const marketCap   = extractFromRatios('Market Cap');
  const peRatio     = extractFromRatios('Stock P\\/E');
  const bookValue   = extractFromRatios('Book Value');
  const dividendYield = extractFromRatios('Dividend Yield');
  const roce        = extractFromRatios('ROCE');
  const roe         = extractFromRatios('ROE');

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

async function fetchYahoo(symbol) {
  const tickers = [`${symbol}.NS`, `${symbol}.BO`];
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  for (const ticker of tickers) {
    try {
      const [summaryRes, quoteRes] = await Promise.all([
        fetch(
          `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=financialData,defaultKeyStatistics,summaryDetail`,
          { headers, signal: AbortSignal.timeout(8000) }
        ),
        fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
          { headers, signal: AbortSignal.timeout(8000) }
        ),
      ]);

      if (!summaryRes.ok) continue;

      const summaryJson = await summaryRes.json();
      const result = summaryJson?.quoteSummary?.result?.[0];
      if (!result) continue;

      const fd = result.financialData      || {};
      const ks = result.defaultKeyStatistics || {};
      const sd = result.summaryDetail      || {};

      // Yahoo returns values as { raw, fmt } objects — extract raw number
      const raw = (obj, key) => {
        const v = obj?.[key];
        if (v == null) return null;
        if (typeof v === 'object') return v.raw ?? null;
        return typeof v === 'number' ? v : null;
      };

      const pct     = (v) => v != null ? parseFloat((v * 100).toFixed(2)) : null;
      const toCr    = (v) => v != null ? parseFloat((v / 1e7).toFixed(2)) : null;
      const deRatio = (v) => v != null ? parseFloat((v / 100).toFixed(4)) : null;

      // 52-week from chart endpoint
      let week52High = raw(sd, 'fiftyTwoWeekHigh') ?? raw(ks, 'fiftyTwoWeekHigh');
      let week52Low  = raw(sd, 'fiftyTwoWeekLow')  ?? raw(ks, 'fiftyTwoWeekLow');
      if (quoteRes.ok) {
        try {
          const quoteJson = await quoteRes.json();
          const meta = quoteJson?.chart?.result?.[0]?.meta;
          if (meta) {
            week52High = week52High ?? meta.fiftyTwoWeekHigh ?? null;
            week52Low  = week52Low  ?? meta.fiftyTwoWeekLow  ?? null;
          }
        } catch (_) {}
      }

      const mapped = {
        grossMargin:      pct(raw(fd, 'grossMargins')),
        operatingMargin:  pct(raw(fd, 'operatingMargins')),
        netMargin:        pct(raw(fd, 'profitMargins')),
        roe:              pct(raw(fd, 'returnOnEquity')),
        roa:              pct(raw(fd, 'returnOnAssets')),
        revenueGrowthYoY:  pct(raw(fd, 'revenueGrowth')),
        earningsGrowthYoY: pct(raw(fd, 'earningsGrowth')),
        debtToEquity:  deRatio(raw(fd, 'debtToEquity')),
        currentRatio:  raw(fd, 'currentRatio'),
        totalDebtCr:   toCr(raw(fd, 'totalDebt')),
        totalCashCr:   toCr(raw(fd, 'totalCash')),
        freeCashFlowCr: toCr(raw(fd, 'freeCashflow')),
        targetPriceMean: raw(fd, 'targetMeanPrice'),
        targetPriceLow:  raw(fd, 'targetLowPrice'),
        targetPriceHigh: raw(fd, 'targetHighPrice'),
        recommendationKey: typeof fd.recommendationKey === 'string'
          ? fd.recommendationKey
          : raw(fd, 'recommendationKey'),
        numberOfAnalysts: raw(fd, 'numberOfAnalystOpinions'),
        week52High,
        week52Low,
      };

      const hasData = Object.values(mapped).some((v) => v != null);
      if (hasData) return mapped;
    } catch (_) {}
  }

  return null;
}

async function fetchTickertape(symbol) {
  try {
    // Tickertape uses a slug — try the symbol directly as the sid
    const url = `https://api.tickertape.in/stocks/financials/ratios/${symbol}?count=4`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Origin': 'https://www.tickertape.in',
        'Referer': 'https://www.tickertape.in/',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    const json = await r.json();
    const data = json?.data;
    if (!data) return null;

    // Tickertape returns arrays of annual values; take the most recent (last item)
    const latest = (arr) => {
      if (!Array.isArray(arr) || arr.length === 0) return null;
      const v = arr[arr.length - 1]?.value;
      return typeof v === 'number' ? v : null;
    };

    return {
      grossMargin:     latest(data.grossProfitMargin),
      operatingMargin: latest(data.operatingProfitMargin),
      netMargin:       latest(data.netProfitMargin),
      roe:             latest(data.roe),
      roa:             latest(data.roa),
      debtToEquity:    latest(data.debtToEquity),
      currentRatio:    latest(data.currentRatio),
    };
  } catch (_) {
    return null;
  }
}

// Keep 'a' if not null, otherwise use 'b'
const fill = (a, b) => a ?? b ?? null;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: 'Ticker is required' });

  const symbol = ticker.trim().toUpperCase().replace(/\.(NS|BO)$/i, '');

  // 1. Screener — required
  const screener = await fetchScreener(symbol);
  if (!screener) {
    return res.status(404).json({
      error: `Could not fetch data for "${symbol}". Make sure it's a valid NSE/BSE ticker.`,
    });
  }

  // 2. Yahoo Finance + Tickertape — both optional, run in parallel
  const [yahoo, tickertape] = await Promise.all([
    fetchYahoo(symbol).catch(() => null),
    fetchTickertape(symbol).catch(() => null),
  ]);

  // 3. Merge: Screener > Yahoo > Tickertape, never leave null if any source has it
  const data = {
    ticker:   symbol,
    exchange: 'NSE',
    currency: 'INR',

    // Screener-only
    name:        screener.name,
    sector:      screener.sector,
    about:       screener.about,
    screenerUrl: screener.screenerUrl,
    pros:        screener.pros,
    cons:        screener.cons,
    price:       screener.price,
    marketCap:   screener.marketCap,
    peRatio:     screener.peRatio,
    pbRatio:     screener.pbRatio,
    bookValue:   screener.bookValue,
    eps:         screener.eps,
    roce:        screener.roce,
    dividendYield: screener.dividendYield,

    // Screener wins, Yahoo/Tickertape fill gaps
    roe:       fill(screener.roe,       fill(yahoo?.roe,       tickertape?.roe)),
    week52High: fill(screener.week52High, yahoo?.week52High),
    week52Low:  fill(screener.week52Low,  yahoo?.week52Low),

    // Yahoo primary, Tickertape fallback
    grossMargin:      fill(yahoo?.grossMargin,      tickertape?.grossMargin),
    operatingMargin:  fill(yahoo?.operatingMargin,  tickertape?.operatingMargin),
    netMargin:        fill(yahoo?.netMargin,         tickertape?.netMargin),
    roa:              fill(yahoo?.roa,               tickertape?.roa),
    revenueGrowthYoY:  yahoo?.revenueGrowthYoY  ?? null,
    earningsGrowthYoY: yahoo?.earningsGrowthYoY ?? null,
    debtToEquity:  fill(yahoo?.debtToEquity,  tickertape?.debtToEquity),
    currentRatio:  fill(yahoo?.currentRatio,  tickertape?.currentRatio),
    totalDebtCr:   yahoo?.totalDebtCr   ?? null,
    totalCashCr:   yahoo?.totalCashCr   ?? null,
    freeCashFlowCr: yahoo?.freeCashFlowCr ?? null,
    targetPriceMean:  yahoo?.targetPriceMean  ?? null,
    targetPriceLow:   yahoo?.targetPriceLow   ?? null,
    targetPriceHigh:  yahoo?.targetPriceHigh  ?? null,
    recommendationKey: yahoo?.recommendationKey ?? null,
    numberOfAnalysts:  yahoo?.numberOfAnalysts  ?? null,
  };

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
  return res.status(200).json(data);
}
