export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.status(400).json({ quotes: [] });

  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&lang=en-IN&region=IN&quotesCount=10&newsCount=0&listsCount=0`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!r.ok) return res.status(200).json({ quotes: [] });

    const json = await r.json();
    const quotes = (json?.finance?.result?.[0]?.quotes || json?.quotes || [])
      .filter(q => q.symbol && (q.symbol.endsWith('.NS') || q.symbol.endsWith('.BO')) && q.quoteType === 'EQUITY')
      .slice(0, 6)
      .map(q => ({
        symbol: q.symbol.replace(/\.(NS|BO)$/, ''),
        exchange: q.symbol.endsWith('.NS') ? 'NSE' : 'BSE',
        name: q.longname || q.shortname || q.symbol,
      }));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json({ quotes });
  } catch (_) {
    return res.status(200).json({ quotes: [] });
  }
}
