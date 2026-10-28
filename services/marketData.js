import dotenv from 'dotenv';
dotenv.config();

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || 'dbg5ou1r01qidncmd640dbg5ou1r01qidncmd64g';

// In-memory cache to respect rate limits (30s TTL)
const cache = {
  quotes: {},
  lastFetchTime: 0
};

/**
 * Fetches real-time quotes from Finnhub
 * Symbols: SPY, QQQ, NVDA, BTC (BINANCE:BTCUSDT)
 */
export async function getLiveQuotes() {
  const now = Date.now();
  if (now - cache.lastFetchTime < 15000 && Object.keys(cache.quotes).length > 0) {
    return cache.quotes;
  }

  const targets = [
    { displaySymbol: 'SPY', finnhubSymbol: 'SPY', name: 'S&P 500 ETF' },
    { displaySymbol: 'QQQ', finnhubSymbol: 'QQQ', name: 'Nasdaq 100 ETF' },
    { displaySymbol: 'NVDA', finnhubSymbol: 'NVDA', name: 'Nvidia Corp' },
    { displaySymbol: 'BTC', finnhubSymbol: 'BINANCE:BTCUSDT', name: 'Bitcoin / USD' }
  ];

  const results = [];

  for (const t of targets) {
    try {
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(t.finnhubSymbol)}&token=${FINNHUB_KEY}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data && typeof data.c === 'number' && data.c > 0) {
        const currentPrice = data.c;
        const changePct = typeof data.dp === 'number' ? data.dp : (data.d / (currentPrice - data.d)) * 100;
        const isNegative = changePct < 0;

        results.push({
          symbol: t.displaySymbol,
          name: t.name,
          price: currentPrice,
          change: data.d || 0,
          changePct: parseFloat(changePct.toFixed(2)),
          high: data.h || currentPrice,
          low: data.l || currentPrice,
          prevClose: data.pc || currentPrice,
          isNegative,
          source: `finnhub:quote:${t.finnhubSymbol}`,
          timestamp: new Date().toISOString(),
          isAvailable: true
        });
      } else {
        // Honest fallback: show "—" when unavailable
        results.push({
          symbol: t.displaySymbol,
          name: t.name,
          price: null,
          changePct: null,
          isNegative: false,
          source: 'finnhub:offline',
          timestamp: new Date().toISOString(),
          isAvailable: false
        });
      }
    } catch (err) {
      console.warn(`[MARKET DATA] Failed fetching ${t.displaySymbol}:`, err.message);
      results.push({
        symbol: t.displaySymbol,
        name: t.name,
        price: null,
        changePct: null,
        isNegative: false,
        source: 'feed:unavailable',
        timestamp: new Date().toISOString(),
        isAvailable: false
      });
    }
  }

  cache.quotes = results;
  cache.lastFetchTime = now;
  return results;
}

/**
 * Calculates real-world NYSE Market Session status
 * NYSE Regular Hours: 09:30 - 16:00 ET (Mon - Fri)
 * Pre-market: 04:00 - 09:30 ET
 * After-hours: 16:00 - 20:00 ET
 */
export function getNyseSession() {
  const now = new Date();
  
  // Format current time in America/New_York
  const nyString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const nyTime = new Date(nyString);
  
  const dayOfWeek = nyTime.getDay(); // 0 is Sunday, 6 is Saturday
  const hours = nyTime.getHours();
  const minutes = nyTime.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  let status = 'MARKET CLOSED';
  let countdownText = 'OPENS MON 09:30 ET';
  let isOpen = false;

  if (isWeekend) {
    status = 'WEEKEND CLOSED';
    countdownText = 'OPENS MON 09:30 ET';
  } else if (totalMinutes >= 240 && totalMinutes < 570) { // 04:00 to 09:30
    status = 'PRE-MARKET';
    const minsToOpen = 570 - totalMinutes;
    const h = Math.floor(minsToOpen / 60);
    const m = minsToOpen % 60;
    countdownText = `OPENS IN ${h > 0 ? `${h}H ` : ''}${m}M`;
  } else if (totalMinutes >= 570 && totalMinutes < 960) { // 09:30 to 16:00
    status = 'MARKET OPEN';
    isOpen = true;
    const minsToClose = 960 - totalMinutes;
    const h = Math.floor(minsToClose / 60);
    const m = minsToClose % 60;
    countdownText = `CLOSES IN ${h > 0 ? `${h}H ` : ''}${m}M`;
  } else if (totalMinutes >= 960 && totalMinutes < 1200) { // 16:00 to 20:00
    status = 'AFTER-HOURS';
    const minsToEnd = 1200 - totalMinutes;
    const h = Math.floor(minsToEnd / 60);
    const m = minsToEnd % 60;
    countdownText = `CLOSES IN ${h > 0 ? `${h}H ` : ''}${m}M`;
  } else {
    status = 'MARKET CLOSED';
    countdownText = 'OPENS 04:00 ET PRE-MKT';
  }

  return {
    exchange: 'NYSE',
    status,
    isOpen,
    countdownText,
    nyTime: nyTime.toLocaleTimeString('en-US', { hour12: false }) + ' ET',
    melbourneTime: now.toLocaleTimeString('en-US', { timeZone: 'Australia/Melbourne', hour12: false })
  };
}
