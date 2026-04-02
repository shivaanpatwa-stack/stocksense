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
  const peRatio = extractFromRatios('Stock P\\/E');
  const bookValue = extractFromRatios('Book Value');
  const dividendYield = extractFromRatios('Dividend Yield');
  const roce = extractFromRatios('ROCE');
  const roe = extractFromRatios('ROE');

  const priceMatch =
    html.match(/id="market-cap-section"[\s\S]{0,500}?₹\s*([\d,]+\.?\d*)/) ||
    html.match(/Current Price[\s\S]{0,200}?([\d,]+\.?\d*)/) ||
    html.match(/"price":\s*"?([\d.]+)"?/);
  const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;

  const highLowMatch = ratioSection.match(/High \/ Low[\s\S]{0,300}?([\d,]+)[\s\S]{0,50}?\/([\s\S]{0,10}?)([\d,]+)/);
  const week52High = highLowMatch ? parseFloat(highLowMatch[1].replace(/,/g, '')) : null;
  const week52Low = highLowMatch ? parseFloat(highLowMatch[3].replace(/,/g, '')) : null;

  const pbRatio = (price && bookValue && bookValue > 0) ? parseFloat((price / bookValue).toFixed(2)) : null;

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

  const eps = (price && peRatio && peRatio > 0) ? parseFloat((price / peRatio).toFixed(2)) : null;

  return {
    name,
    sector,
    about,
    price,
    marketCap,
    peRatio,
    pbRatio,
    bookValue,
    eps,
    roe,
    roce,
    dividendYield,
    week52High,
    week52Low,
    pros: extractList(prosSection),
    cons: extractList(consSection),
    screenerUrl: usedUrl,
  };
}

async function fetchYahoo(symbol) {
  const tickers = [`${symbol}.NS`, `${symbol}.BO`];

  for (const ticker of tickers) {
    try {
      const [quote, summary] = await Promise.all([
        yahooFinance.quote(ticker).catch(() => null),
        yahooFinance.quoteSummary(ticker, {
          modules: ['financialData', 'defaultKeyStatistics'],
        }).catch(() => null),
      ]);

      const fd = summary?.financialData || {};
      const ks = summary?.defaultKeyStatistics || {};

      // yahoo-finance2 returns plain numbers; handle legacy {raw} shape just in case
      const pick = (obj, key) => {
        const v = obj?.[key];
        if (v == null) return null;
        if (typeof v === 'object' && 'raw' in v) return v.raw;
        return typeof v === 'number' ? v : null;
      };

      // Yahoo margins are decimals (0.25 = 25%) → multiply by 100
      const pct = (v) => (v != null ? parseFloat((v * 100).toFixed(2)) : null);
      // Yahoo debt/cash/fcf are raw INR → divide by 1e7 to get Crores
      const toCr = (v) => (v != null ? parseFloat((v / 1e7).toFixed(2)) : null);
      // Yahoo debtToEquity is in percentage form (150 = 1.5x) → divide by 100
      const deRatio = (v) => (v != null ? parseFloat((v / 100).toFixed(4)) : null);

      const result = {
        grossMargin: pct(pick(fd, 'grossMargins')),
        operatingMargin: pct(pick(fd, 'operatingMargins')),
        netMargin: pct(pick(fd, 'profitMargins')),
        revenueGrowthYoY: pct(pick(fd, 'revenueGrowth')),
        earningsGrowthYoY: pct(pick(fd, 'earningsGrowth')),
        debtToEquity: deRatio(pick(fd, 'debtToEquity')),
        currentRatio: pick(fd, 'currentRatio'),
        totalDebtCr: toCr(pick(fd, 'totalDebt')),
        totalCashCr: toCr(pick(fd, 'totalCash')),
        freeCashFlowCr: toCr(pick(fd, 'freeCashflow')),
        targetPriceMean: pick(fd, 'targetMeanPrice'),
        targetPriceLow: pick(fd, 'targetLowPrice'),
        targetPriceHigh: pick(fd, 'targetHighPrice'),
        recommendationKey: pick(fd, 'recommendationKey') || fd?.recommendationKey || null,
        numberOfAnalysts: pick(fd, 'numberOfAnalystOpinions'),
        week52High: pick(ks, 'fiftyTwoWeekHigh') ?? quote?.fiftyTwoWeekHigh ?? null,
        week52Low: pick(ks, 'fiftyTwoWeekLow') ?? quote?.fiftyTwoWeekLow ?? null,
      };

      const hasData = Object.values(result).some((v) => v != null);
      if (hasData) return result;
    } catch (_) {}
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: 'Ticker is required' });

  const symbol = ticker.trim().toUpperCase().replace(/\.(NS|BO)$/i, '');

  try {
    const [screener, yahoo] = await Promise.all([
      fetchScreener(symbol),
      fetchYahoo(symbol),
    ]);

    if (!screener) {
      return res.status(404).json({ error: `Could not fetch data for "${symbol}". Make sure it's a valid NSE/BSE ticker.` });
    }

    // Merge: Screener wins for its own fields; Yahoo fills everything else.
    // Never leave a field null if either source has it.
    const data = {
      ticker: symbol,
      exchange: 'NSE',
      currency: 'INR',

      // Identity
      name: screener.name,
      sector: screener.sector,
      about: screener.about,
      screenerUrl: screener.screenerUrl,

      // Price & market
      price: screener.price,

      // Screener-primary fields
      marketCap: screener.marketCap,
      peRatio: screener.peRatio,
      pbRatio: screener.pbRatio,
      bookValue: screener.bookValue,
      eps: screener.eps,
      roe: screener.roe,
      roce: screener.roce,
      dividendYield: screener.dividendYield,

      // 52-week: Screener first, Yahoo fallback
      week52High: screener.week52High ?? yahoo?.week52High ?? null,
      week52Low: screener.week52Low ?? yahoo?.week52Low ?? null,

      // Screener qualitative
      pros: screener.pros,
      cons: screener.cons,

      // Yahoo Finance fields (with Screener fallbacks where applicable)
      grossMargin: yahoo?.grossMargin ?? null,
      operatingMargin: yahoo?.operatingMargin ?? null,
      netMargin: yahoo?.netMargin ?? null,
      revenueGrowthYoY: yahoo?.revenueGrowthYoY ?? null,
      earningsGrowthYoY: yahoo?.earningsGrowthYoY ?? null,
      debtToEquity: yahoo?.debtToEquity ?? null,
      currentRatio: yahoo?.currentRatio ?? null,
      totalDebtCr: yahoo?.totalDebtCr ?? null,
      totalCashCr: yahoo?.totalCashCr ?? null,
      freeCashFlowCr: yahoo?.freeCashFlowCr ?? null,
      targetPriceMean: yahoo?.targetPriceMean ?? null,
      targetPriceLow: yahoo?.targetPriceLow ?? null,
      targetPriceHigh: yahoo?.targetPriceHigh ?? null,
      recommendationKey: yahoo?.recommendationKey ?? null,
      numberOfAnalysts: yahoo?.numberOfAnalysts ?? null,
    };

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
}
