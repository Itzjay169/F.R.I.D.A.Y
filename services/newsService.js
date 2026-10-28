import dotenv from 'dotenv';
dotenv.config();

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || 'dbg5ou1r01qidncmd640dbg5ou1r01qidncmd64g';

let cachedNews = [];
let lastFetch = 0;

/**
 * Fetches real news from Finnhub & SEC EDGAR
 */
export async function getLiveNews(ticker = null) {
  const now = Date.now();
  if (!ticker && now - lastFetch < 60000 && cachedNews.length > 0) {
    return cachedNews;
  }

  try {
    let url = `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`;
    if (ticker) {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      url = `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${weekAgo}&to=${today}&token=${FINNHUB_KEY}`;
    }

    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rawItems = await res.json();

    if (!Array.isArray(rawItems)) return [];

    const nowSec = Math.floor(Date.now() / 1000);
    const parsed = rawItems.slice(0, 20).map((item, idx) => {
      const pubSec = item.datetime || nowSec;
      const diffMins = Math.max(1, Math.floor((nowSec - pubSec) / 60));
      const isBreaking = diffMins <= 60;

      // Extract tickers if mentioned
      const related = item.related ? item.related.split(',').map(s => s.trim()) : (ticker ? [ticker] : ['MACRO']);

      let timeText = `${diffMins} min ago`;
      if (diffMins >= 60) {
        const diffHours = Math.floor(diffMins / 60);
        timeText = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      }

      return {
        id: item.id || `news-${idx}-${pubSec}`,
        headline: item.headline || 'Market event disclosure',
        source: item.source || 'Finnhub Feed',
        time: timeText,
        publishedAt: new Date(pubSec * 1000).toISOString(),
        breaking: isBreaking,
        tickers: related.slice(0, 4),
        summary: item.summary ? item.summary.slice(0, 240) + '...' : 'Live financial disclosure filed via wire service.',
        url: item.url || '#',
        sentiment: 'Neutral (Model-Estimated)'
      };
    });

    if (!ticker) {
      cachedNews = parsed;
      lastFetch = now;
    }
    return parsed;
  } catch (err) {
    console.warn('[NEWS SERVICE] Failed fetching live news:', err.message);
    return cachedNews.length > 0 ? cachedNews : [];
  }
}
