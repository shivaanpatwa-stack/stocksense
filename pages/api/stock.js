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

      const pick = (obj, key) => {
        const v = obj?.[key];
        if (v == null) return null;
        if (typeof v === 'object' && 'raw' in v) return v.raw;
        return v;
      };

      const result = {
        grossMargins: pick(fd, 'grossMargins'),
        operatingMargins: pick(fd, 'operatingMargins'),
        profitMargins: pick(fd, 'profitMargins'),
        revenueGrowth: pick(fd, 'revenueGrowth'),
        earningsGrowth: pick(fd, 'earningsGrowth'),
        debtToEquity: pick(fd, 'debtToEquity'),
        currentRatio: pick(fd, 'currentRatio'),
        totalDebt: pick(fd, 'totalDebt'),
        totalCash: pick(fd, 'totalCash'),
        freeCashflow: pick(fd, 'freeCashflow'),
        targetMeanPrice: pick(fd, 'targetMeanPrice'),
        targetLowPrice: pick(fd, 'targetLowPrice'),
        targetHighPrice: pick(fd, 'targetHighPrice'),
        recommendationKey: pick(fd, 'recommendationKey'),
        numberOfAnalystOpinions: pick(fd, 'numberOfAnalystOpinions'),
        week52High: pick(ks, 'fiftyTwoWeekHigh') ?? pick(quote, 'fiftyTwoWeekHigh'),
        week52Low: pick(ks, 'fiftyTwoWeekLow') ?? pick(quote, 'fiftyTwoWeekLow'),
      };

      // Only return if we got at least some useful data
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
      return res.status(404).json({ error: `Could not fetch data for "${symbol}". Make sure it's a valid NSE ticker.` });
    }

    // Merge: Yahoo Finance fills in fields; Screener data wins for fields it already has
    const data = {
      ticker: symbol,
      exchange: 'NSE',
      currency: 'INR',

      // Screener fields (primary)
      name: screener.name,
      sector: screener.sector,
      about: screener.about,
      price: screener.price,
      marketCap: screener.marketCap,
      peRatio: screener.peRatio,
      pbRatio: screener.pbRatio,
      bookValue: screener.bookValue,
      eps: screener.eps,
      roe: screener.roe,
      roce: screener.roce,
      dividendYield: screener.dividendYield,
      week52High: screener.week52High ?? yahoo?.week52High ?? null,
      week52Low: screener.week52Low ?? yahoo?.week52Low ?? null,
      pros: screener.pros,
      cons: screener.cons,
      screenerUrl: screener.screenerUrl,

      // Yahoo Finance fields
      grossMargins: yahoo?.grossMargins ?? null,
      operatingMargins: yahoo?.operatingMargins ?? null,
      profitMargins: yahoo?.profitMargins ?? null,
      revenueGrowth: yahoo?.revenueGrowth ?? null,
      earningsGrowth: yahoo?.earningsGrowth ?? null,
      debtToEquity: yahoo?.debtToEquity ?? null,
      currentRatio: yahoo?.currentRatio ?? null,
      totalDebt: yahoo?.totalDebt ?? null,
      totalCash: yahoo?.totalCash ?? null,
      freeCashflow: yahoo?.freeCashflow ?? null,
      targetMeanPrice: yahoo?.targetMeanPrice ?? null,
      targetLowPrice: yahoo?.targetLowPrice ?? null,
      targetHighPrice: yahoo?.targetHighPrice ?? null,
      recommendationKey: yahoo?.recommendationKey ?? null,
      numberOfAnalystOpinions: yahoo?.numberOfAnalystOpinions ?? null,
    };

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
}
