export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: 'Ticker is required' });

  const symbol = ticker.trim().toUpperCase().replace(/\.(NS|BO)$/i, '');

  try {
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

    if (!html) {
      return res.status(404).json({ error: `Could not fetch data for "${symbol}". Make sure it's a valid NSE ticker.` });
    }

    // Extract top ratios section
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

    // Price
    const priceMatch = html.match(/id="market-cap-section"[\s\S]{0,500}?₹\s*([\d,]+\.?\d*)/) ||
                       html.match(/Current Price[\s\S]{0,200}?([\d,]+\.?\d*)/) ||
                       html.match(/"price":\s*"?([\d.]+)"?/);
    const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;

    // 52w high/low
    const highLowMatch = ratioSection.match(/High \/ Low[\s\S]{0,300}?([\d,]+)[\s\S]{0,50}?\/([\s\S]{0,10}?)([\d,]+)/);
    const week52High = highLowMatch ? parseFloat(highLowMatch[1].replace(/,/g, '')) : null;
    const week52Low = highLowMatch ? parseFloat(highLowMatch[3].replace(/,/g, '')) : null;

    // P/B
    const pbRatio = (price && bookValue && bookValue > 0) ? parseFloat((price / bookValue).toFixed(2)) : null;

    // Company name
    const nameMatch = html.match(/<h1[^>]*>[\s]*([^<\n]{3,80})/i);
    const name = nameMatch ? nameMatch[1].trim() : symbol;

    // Sector
    const sectorMatch = html.match(/sector[^>]*href[^>]*>([^<]{3,40})</i);
    const sector = sectorMatch ? sectorMatch[1].trim() : null;

    // About
    const aboutMatch = html.match(/(?:About|company-profile)[^<]*<\/[^>]+>[\s\S]{0,100}<p[^>]*>([\s\S]{20,600}?)<\/p>/i);
    const about = aboutMatch ? aboutMatch[1].replace(/<[^>]+>/g, '').trim() : null;

    // Pros and Cons
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

    const pros = extractList(prosSection);
    const cons = extractList(consSection);

    // EPS = Price / PE
    const eps = (price && peRatio && peRatio > 0) ? parseFloat((price / peRatio).toFixed(2)) : null;

    const data = {
      ticker: symbol,
      name,
      exchange: 'NSE',
      sector,
      currency: 'INR',
      price,
      week52High,
      week52Low,
      marketCap,
      peRatio,
      pbRatio,
      bookValue,
      eps,
      roe,
      roce,
      dividendYield,
      pros,
      cons,
      about,
      screenerUrl: usedUrl,
    };

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
}