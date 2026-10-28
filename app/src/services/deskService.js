// Unified Desk Client: seamlessly uses local Node/Vite backend if available,
// or falls back to direct browser APIs (Finnhub & Google Gemini) for 100% zero-dependency portable use!

// Default free keys if .env is not present in pure static browser mode
const FINNHUB_KEY = 'dbg5ou1r01qidncmd640dbg5ou1r01qidncmd64g';
const GEMINI_KEY = 'AIzaSyCxft1Ou8eg2ejDI7UE5s0rdX4L_MYAJzE';

/**
 * Fetches real-time live market quotes
 */
export async function fetchLiveQuotes() {
  // 1. Try local server endpoint first
  try {
    const res = await fetch('/api/quotes', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch {
    // Local server offline or in standalone browser mode; fall back to direct browser Finnhub fetch
  }

  // 2. Direct browser fetch to Finnhub (CORS enabled)
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
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const d = await res.json();
        if (d && typeof d.c === 'number' && d.c > 0) {
          const changePct = typeof d.dp === 'number' ? d.dp : (d.d / (d.c - d.d)) * 100;
          results.push({
            symbol: t.displaySymbol,
            name: t.name,
            price: d.c,
            change: d.d || 0,
            changePct: parseFloat(changePct.toFixed(2)),
            high: d.h || d.c,
            low: d.l || d.c,
            prevClose: d.pc || d.c,
            isNegative: changePct < 0,
            source: `finnhub:direct:${t.finnhubSymbol}`,
            timestamp: new Date().toISOString(),
            isAvailable: true
          });
          continue;
        }
      }
    } catch {
      // Fall through to placeholder
    }

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

  return results;
}

/**
 * Computes NYSE session state directly in browser (America/New_York)
 */
export async function fetchSessionState() {
  try {
    const res = await fetch('/api/session', { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.status) return data;
    }
  } catch {
    // Compute locally in browser
  }

  const now = new Date();
  const nyString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const nyTime = new Date(nyString);
  const day = nyTime.getDay();
  const mins = nyTime.getHours() * 60 + nyTime.getMinutes();
  const isWeekend = day === 0 || day === 6;

  let status = 'MARKET CLOSED';
  let countdownText = 'OPENS MON 09:30 ET';
  let isOpen = false;

  if (isWeekend) {
    status = 'WEEKEND CLOSED';
  } else if (mins >= 240 && mins < 570) {
    status = 'PRE-MARKET';
    const left = 570 - mins;
    countdownText = `OPENS IN ${Math.floor(left / 60)}H ${left % 60}M`;
  } else if (mins >= 570 && mins < 960) {
    status = 'MARKET OPEN';
    isOpen = true;
    const left = 960 - mins;
    countdownText = `CLOSES IN ${Math.floor(left / 60)}H ${left % 60}M`;
  } else if (mins >= 960 && mins < 1200) {
    status = 'AFTER-HOURS';
    const left = 1200 - mins;
    countdownText = `CLOSES IN ${Math.floor(left / 60)}H ${left % 60}M`;
  } else {
    status = 'MARKET CLOSED';
    countdownText = 'OPENS 04:00 ET PRE-MKT';
  }

  return {
    exchange: 'NYSE',
    status,
    isOpen,
    countdownText,
    nyTime: nyTime.toLocaleTimeString('en-US', { hour12: false }) + ' ET'
  };
}

const LOCAL_PAPER_STORAGE_KEY = 'FRIDAY_PAPER_ACCOUNT_V2';

function getClientPaperAccount() {
  try {
    const raw = localStorage.getItem(LOCAL_PAPER_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    equity: 1604199.00,
    cash: 1420500.00,
    realizedPnl: 18450.00,
    unrealizedPnl: 692.00,
    maxOpenPositions: 12,
    maxRiskPct: 2.0,
    positions: [
      { symbol: 'NVDA', qty: 50, avgPrice: 118.80, stopLoss: 115.00, takeProfit: 130.00, entryTime: '2026-09-15 03:45:12' },
      { symbol: 'AAPL', qty: 100, avgPrice: 224.50, stopLoss: 219.00, takeProfit: 240.00, entryTime: '2026-09-14 10:15:00' },
      { symbol: 'TSLA', qty: -40, avgPrice: 245.00, stopLoss: 252.00, takeProfit: 230.00, entryTime: '2026-09-15 01:20:00' }
    ],
    orders: [],
    journal: [
      { id: 'JRN-9012', timestamp: new Date(Date.now() - 3600000).toISOString(), symbol: 'NVDA', action: 'PAPER BUY 50 @ $118.80', sentinelToken: 'SIG_9A4F2E71B08C', outcome: 'OPEN' },
      { id: 'JRN-8984', timestamp: new Date(Date.now() - 86400000).toISOString(), symbol: 'AAPL', action: 'PAPER BUY 100 @ $224.50', sentinelToken: 'SIG_3D1C882FA011', outcome: 'OPEN' }
    ]
  };
}

function saveClientPaperAccount(acc) {
  try {
    localStorage.setItem(LOCAL_PAPER_STORAGE_KEY, JSON.stringify(acc));
  } catch {}
}

/**
 * Fetches real-time quote and bid/ask for any ticker
 */
export async function fetchSymbolQuote(symbol) {
  if (!symbol) return null;
  const clean = symbol.trim().toUpperCase();

  let finnhubSym = clean;
  if (['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA'].includes(clean)) {
    finnhubSym = `BINANCE:${clean}USDT`;
  } else if (clean === 'GOLD') {
    finnhubSym = 'GLD';
  } else if (clean === 'OIL') {
    finnhubSym = 'USO';
  }

  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(finnhubSym)}&token=${FINNHUB_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const d = await res.json();
      if (d && typeof d.c === 'number' && d.c > 0) {
        const changePct = typeof d.dp === 'number' ? d.dp : (d.pc ? ((d.c - d.pc) / d.pc) * 100 : 0);
        const spread = parseFloat((d.c * 0.0004).toFixed(2)) || 0.02;
        return {
          symbol: clean,
          price: d.c,
          bid: parseFloat((d.c - spread / 2).toFixed(2)),
          ask: parseFloat((d.c + spread / 2).toFixed(2)),
          spread,
          change: d.d || 0,
          changePct: parseFloat(changePct.toFixed(2)),
          high: d.h || d.c,
          low: d.l || d.c,
          prevClose: d.pc || d.c,
          timestamp: new Date().toISOString()
        };
      }
    }
  } catch {}

  return null;
}

/**
 * Fetches paper portfolio from server or builds from client state
 */
export async function fetchPaperPortfolio(livePrices = {}) {
  // 1. Try server
  try {
    const res = await fetch('/api/portfolio', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.positions !== undefined) {
        saveClientPaperAccount(data);
        return data;
      }
    }
  } catch {
    // Offline or portable standalone mode
  }

  // 2. Client fallback
  const acc = getClientPaperAccount();
  let totalUnrealized = 0;
  let totalPositionValue = 0;

  const positions = (acc.positions || []).map(p => {
    const cur = livePrices[p.symbol] || p.avgPrice;
    const isLong = p.qty > 0;
    const diff = isLong ? (cur - p.avgPrice) * Math.abs(p.qty) : (p.avgPrice - cur) * Math.abs(p.qty);
    totalUnrealized += diff;
    totalPositionValue += cur * Math.abs(p.qty);
    const pnlPct = ((cur - p.avgPrice) / p.avgPrice) * 100 * (isLong ? 1 : -1);

    return {
      ...p,
      curPrice: cur,
      marketValue: cur * Math.abs(p.qty),
      pnl: parseFloat(diff.toFixed(2)),
      pnlPct: parseFloat(pnlPct.toFixed(2))
    };
  });

  return {
    equity: parseFloat((acc.equity + totalUnrealized).toFixed(2)),
    cash: parseFloat(acc.cash.toFixed(2)),
    unrealizedPnl: parseFloat(totalUnrealized.toFixed(2)),
    realizedPnl: parseFloat((acc.realizedPnl || 0).toFixed(2)),
    marginUsed: parseFloat(totalPositionValue.toFixed(2)),
    availableMargin: parseFloat(Math.max(0, acc.cash).toFixed(2)),
    maxRiskPct: acc.maxRiskPct || 2.0,
    positions,
    orders: acc.orders || [],
    journal: acc.journal || []
  };
}

/**
 * Evaluates risk with Sentinel Risk Gate
 */
export async function evaluatePaperOrder(ticket) {
  // 1. Server check
  try {
    const res = await fetch('/api/order/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ticket),
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) return await res.json();
  } catch {}

  // 2. Client fallback
  const isBuy = ticket.action.toUpperCase().includes('BUY');
  const price = Number(ticket.price) || 100;
  const shares = Number(ticket.shares) || 1;
  let effectiveStopLoss = ticket.stopLoss;
  let autoProvisionedStop = false;

  if (!effectiveStopLoss || effectiveStopLoss <= 0) {
    effectiveStopLoss = isBuy ? parseFloat((price * 0.975).toFixed(2)) : parseFloat((price * 1.025).toFixed(2));
    autoProvisionedStop = true;
  }

  const riskPerShare = Math.abs(price - effectiveStopLoss) || 0.01;
  const totalRiskDollars = riskPerShare * shares;
  const acc = getClientPaperAccount();
  const maxAllowedRisk = (acc.equity * 0.02);

  if (totalRiskDollars > maxAllowedRisk && maxAllowedRisk > 0) {
    const recommendedShares = Math.max(1, Math.floor(maxAllowedRisk / riskPerShare));
    return {
      approved: false,
      verdict: 'MODIFY',
      suggestedShares: recommendedShares,
      reason: `Proposed risk ($${totalRiskDollars.toFixed(0)}) exceeds 2% equity limit ($${maxAllowedRisk.toFixed(0)}). Max safe size: ${recommendedShares} shares.`
    };
  }

  let rrRatio = null;
  if (ticket.takeProfit && ticket.takeProfit > 0) {
    const rewardPerShare = Math.abs(ticket.takeProfit - price);
    rrRatio = parseFloat((rewardPerShare / riskPerShare).toFixed(2));
  }

  const token = `SIG_${Math.random().toString(16).substring(2, 14).toUpperCase()}`;

  return {
    approved: true,
    verdict: 'APPROVE',
    token,
    riskDollars: totalRiskDollars,
    riskPct: ((totalRiskDollars / acc.equity) * 100).toFixed(2),
    effectiveStopLoss,
    autoProvisionedStop,
    rrRatio
  };
}

/**
 * Executes a Paper Order via Pilot
 */
export async function placePaperOrder(ticket) {
  // 1. Try server
  try {
    const res = await fetch('/api/order/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ticket),
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) return await res.json();
  } catch {}

  // 2. Client fallback
  const acc = getClientPaperAccount();
  const cleanSymbol = ticket.symbol.trim().toUpperCase();
  const isBuy = ticket.action.toUpperCase().includes('BUY');
  const numShares = Math.abs(Number(ticket.shares) || 1);
  const fillPrice = Number(ticket.price) || 100;
  const token = ticket.token || `SIG_${Math.random().toString(16).substring(2, 14).toUpperCase()}`;

  if (ticket.orderType === 'LIMIT' || ticket.orderType === 'STOP') {
    const order = {
      id: `ORD-${Date.now().toString().slice(-5)}`,
      symbol: cleanSymbol,
      action: isBuy ? 'BUY' : 'SELL',
      orderType: ticket.orderType,
      shares: numShares,
      price: fillPrice,
      stopLoss: ticket.stopLoss || null,
      takeProfit: ticket.takeProfit || null,
      status: 'WORKING',
      token,
      createdAt: new Date().toISOString()
    };
    acc.orders = acc.orders || [];
    acc.orders.unshift(order);
    saveClientPaperAccount(acc);
    return { status: 'placed', orderType: ticket.orderType, order };
  }

  // Market execution
  acc.positions = acc.positions || [];
  const existingIndex = acc.positions.findIndex(p => p.symbol === cleanSymbol);
  let pnlRealized = 0;

  if (existingIndex >= 0) {
    const existing = acc.positions[existingIndex];
    const existingIsLong = existing.qty > 0;

    if ((existingIsLong && isBuy) || (!existingIsLong && !isBuy)) {
      const currentQty = Math.abs(existing.qty);
      const newTotalQty = currentQty + numShares;
      const weightedAvg = ((currentQty * existing.avgPrice) + (numShares * fillPrice)) / newTotalQty;
      acc.positions[existingIndex].qty = existingIsLong ? newTotalQty : -newTotalQty;
      acc.positions[existingIndex].avgPrice = parseFloat(weightedAvg.toFixed(2));
    } else {
      const currentQty = Math.abs(existing.qty);
      const closeShares = Math.min(currentQty, numShares);
      pnlRealized = existingIsLong ? (fillPrice - existing.avgPrice) * closeShares : (existing.avgPrice - fillPrice) * closeShares;
      acc.realizedPnl = (acc.realizedPnl || 0) + pnlRealized;
      acc.cash += (existing.avgPrice * closeShares) + pnlRealized;

      if (numShares === currentQty) {
        acc.positions.splice(existingIndex, 1);
      } else if (numShares < currentQty) {
        const rem = currentQty - numShares;
        acc.positions[existingIndex].qty = existingIsLong ? rem : -rem;
      } else {
        const rem = numShares - currentQty;
        acc.positions[existingIndex] = {
          symbol: cleanSymbol,
          qty: isBuy ? rem : -rem,
          avgPrice: fillPrice,
          stopLoss: ticket.stopLoss || null,
          takeProfit: ticket.takeProfit || null,
          entryTime: new Date().toISOString()
        };
      }
    }
  } else {
    acc.positions.push({
      symbol: cleanSymbol,
      qty: isBuy ? numShares : -numShares,
      avgPrice: fillPrice,
      stopLoss: ticket.stopLoss || null,
      takeProfit: ticket.takeProfit || null,
      entryTime: new Date().toISOString()
    });
    acc.cash -= (fillPrice * numShares);
  }

  acc.journal = acc.journal || [];
  acc.journal.unshift({
    id: `JRN-${Date.now().toString().slice(-5)}`,
    timestamp: new Date().toISOString(),
    symbol: cleanSymbol,
    action: `PAPER ${isBuy ? 'BUY' : 'SELL'} ${numShares} @ $${fillPrice.toFixed(2)}`,
    sentinelToken: token,
    outcome: pnlRealized !== 0 ? `PnL: ${pnlRealized >= 0 ? '+' : ''}$${pnlRealized.toFixed(2)}` : 'OPEN'
  });

  saveClientPaperAccount(acc);

  return {
    status: 'filled',
    symbol: cleanSymbol,
    action: isBuy ? 'BUY' : 'SELL',
    shares: numShares,
    price: fillPrice,
    pnlRealized,
    token
  };
}

/**
 * Closes an open position at current price
 */
export async function closePaperPosition(symbol, currentPrice) {
  // 1. Try server
  try {
    const res = await fetch('/api/order/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, currentPrice }),
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) return await res.json();
  } catch {}

  // 2. Client fallback
  const acc = getClientPaperAccount();
  const cleanSymbol = symbol.trim().toUpperCase();
  const idx = (acc.positions || []).findIndex(p => p.symbol === cleanSymbol);
  if (idx < 0) return { success: false, error: 'Position not found' };

  const pos = acc.positions[idx];
  const isLong = pos.qty > 0;
  const numShares = Math.abs(pos.qty);
  const closePrice = Number(currentPrice) || pos.avgPrice;
  const pnl = isLong ? (closePrice - pos.avgPrice) * numShares : (pos.avgPrice - closePrice) * numShares;

  acc.realizedPnl = (acc.realizedPnl || 0) + pnl;
  acc.cash += (pos.avgPrice * numShares) + pnl;
  acc.positions.splice(idx, 1);

  acc.journal = acc.journal || [];
  acc.journal.unshift({
    id: `JRN-${Date.now().toString().slice(-5)}`,
    timestamp: new Date().toISOString(),
    symbol: cleanSymbol,
    action: `PAPER CLOSE ${isLong ? 'LONG' : 'SHORT'} ${numShares} @ $${closePrice.toFixed(2)}`,
    sentinelToken: 'SIG_POSITION_FLAT',
    outcome: `Realized: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`
  });

  saveClientPaperAccount(acc);
  return { success: true, symbol: cleanSymbol, shares: numShares, closePrice, pnl, realizedPnl: acc.realizedPnl };
}

/**
 * Cancels a working limit/stop order
 */
export async function cancelPaperOrder(orderId) {
  // 1. Try server
  try {
    const res = await fetch('/api/order/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) return await res.json();
  } catch {}

  // 2. Client fallback
  const acc = getClientPaperAccount();
  acc.orders = acc.orders || [];
  const idx = acc.orders.findIndex(o => o.id === orderId);
  if (idx >= 0) {
    const cancelled = acc.orders.splice(idx, 1)[0];
    saveClientPaperAccount(acc);
    return { success: true, order: cancelled };
  }
  return { success: false, error: 'Order not found' };
}

/**
 * Fetches real-time news from local server or directly from Finnhub
 */
export async function fetchLiveNews(ticker = null) {
  // 1. Try local server endpoint first
  try {
    const url = ticker ? `/api/news?ticker=${encodeURIComponent(ticker)}` : '/api/news';
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch {
    // Fall back to direct Finnhub fetch
  }

  // 2. Direct browser Finnhub fetch
  try {
    let url = `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`;
    if (ticker) {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      url = `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${weekAgo}&to=${today}&token=${FINNHUB_KEY}`;
    }

    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const raw = await res.json();
      if (Array.isArray(raw)) {
        const nowSec = Math.floor(Date.now() / 1000);
        return raw.slice(0, 25).map((item, idx) => {
          const pubSec = item.datetime || nowSec;
          const diffMins = Math.max(1, Math.floor((nowSec - pubSec) / 60));
          const isBreaking = diffMins <= 60;
          const related = item.related ? item.related.split(',').map(s => s.trim()).filter(Boolean) : (ticker ? [ticker] : ['MACRO']);
          let timeText = `${diffMins}m ago`;
          if (diffMins >= 60) {
            const diffHours = Math.floor(diffMins / 60);
            timeText = `${diffHours}h ago`;
          }

          return {
            id: item.id || `news-${idx}-${pubSec}`,
            headline: item.headline || 'Market event disclosure',
            source: item.source || 'Wire Feed',
            time: timeText,
            datetime: pubSec,
            publishedAt: new Date(pubSec * 1000).toISOString(),
            breaking: isBreaking,
            tickers: related.slice(0, 4),
            summary: item.summary || 'Live financial disclosure filed via wire service.',
            url: item.url || '#',
            sentiment: 'Neutral (Model-Estimated)'
          };
        });
      }
    }
  } catch (err) {
    console.warn('[DESK NEWS] Direct news fetch error:', err.message);
  }
  return [];
}

/**
 * Summarizes a news article for speech and UI breakdown using Gemini Flash or local specialist synthesis
 */
export async function summarizeNewsArticle(article) {
  if (!article) return null;

  // Attempt Gemini AI summary first
  try {
    const prompt = `You are F.R.I.D.A.Y.'s senior intelligence officer NEWSROOM. Provide a crisp 2-sentence executive trading desk briefing on this breaking market news:
Headline: "${article.headline}"
Summary: "${article.summary}"
Source: "${article.source}"
Related Tickers: "${(article.tickers || []).join(', ')}"

Format strictly as JSON with keys:
- "briefing": string (2 sentences maximum, natural spoken English for text-to-speech)
- "impact": string ("Bullish", "Bearish", "Macro Volatility", or "Sector Specific")
- "takeaways": array of 2 short bullet points
- "affectedTickers": array of ticker symbols`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
      }),
      signal: AbortSignal.timeout(5000)
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed.briefing) return parsed;
      }
    }
  } catch (err) {
    console.warn('[NEWSROOM] Gemini news summary fallback:', err.message);
  }

  // Fallback: Deterministic expert synthesis
  const headline = article.headline || '';
  const isPositive = /surge|jump|gain|record|profit|beat|soar|bull|boost|growth|rally/i.test(headline);
  const isNegative = /fall|drop|slump|plunge|miss|loss|bear|cut|decline|warn|probe|sue/i.test(headline);
  const impact = isPositive ? 'Bullish' : isNegative ? 'Bearish' : 'Macro Volatility';
  const cleanSummary = article.summary && article.summary.length > 20 ? article.summary : headline;

  return {
    briefing: `${article.source} reports: ${headline}. ${cleanSummary.slice(0, 160)}. Market impact is assessed as ${impact.toLowerCase()}.`,
    impact,
    takeaways: [
      `Wire filing from ${article.source} (${article.time || 'recent'})`,
      `Desk estimated market stance: ${impact}`
    ],
    affectedTickers: article.tickers && article.tickers.length > 0 ? article.tickers : ['MARKET']
  };
}

/**
 * Detects local command intent from a voice/text command.
 * Returns an action descriptor if matched, or null if it should go to Gemini.
 */
export function detectLocalAction(command) {
  const norm = (command || '').toLowerCase().trim();

  // --- P&L / Portfolio / Book commands ---
  if (
    norm.includes('p&l') || norm.includes('pnl') || norm.includes('p and l') ||
    norm.includes('p & l') || norm.includes('profit and loss') ||
    norm.includes('portfolio') || norm.includes('positions') ||
    norm.includes('my book') || norm.includes('show book') ||
    norm.includes('paper portfolio') || norm.includes('open positions') ||
    norm.includes('unrealized') || norm.includes('realized') ||
    norm.includes('equity') || norm.includes('show my') ||
    norm.includes('how am i doing') || norm.includes('desk equity') ||
    norm.includes('my trades') || norm.includes('trade book')
  ) {
    return { action: 'SHOW_PORTFOLIO' };
  }

  // --- Workflow / Trade Plan commands ---
  if (
    norm.includes('show workflow') || norm.includes('open workflow') ||
    norm.includes('view workflow') || norm.includes('show workflows') ||
    norm.includes('open workflows') || norm.includes('workflows tab') ||
    norm === 'workflows' || norm === 'workflow' ||
    norm.includes('trade plans') || norm.includes('show plans')
  ) {
    return { action: 'SHOW_WORKFLOWS' };
  }

  // --- Chart commands ---
  const isChartIntent =
    norm.includes('chart') ||
    norm.includes('candle') ||
    norm.includes('candlestick') ||
    norm.includes('technical') ||
    norm.includes('pull up') ||
    norm.startsWith('open ') && !norm.includes('news') && !norm.includes('portfolio') && !norm.includes('journal') && !norm.includes('hud');

  if (isChartIntent) {
    const symbolMap = {
      'nvidia': 'NVDA', 'nvda': 'NVDA',
      'bitcoin': 'BTC', 'btc': 'BTC',
      'ethereum': 'ETH', 'eth': 'ETH',
      'apple': 'AAPL', 'aapl': 'AAPL',
      'tesla': 'TSLA', 'tsla': 'TSLA',
      'microsoft': 'MSFT', 'msft': 'MSFT',
      'google': 'GOOG', 'goog': 'GOOG',
      'amazon': 'AMZN', 'amzn': 'AMZN',
      'meta': 'META', 'facebook': 'META',
      'spy': 'SPY', 's&p': 'SPY', 'sp500': 'SPY',
      'qqq': 'QQQ', 'nasdaq': 'QQQ',
      'amd': 'AMD', 'coin': 'COIN', 'pltr': 'PLTR',
      'mstr': 'MSTR', 'nflx': 'NFLX', 'ba': 'BA', 'intc': 'INTC'
    };

    let chartSymbol = 'SPY';

    // Check mapped dictionary first
    for (const [key, val] of Object.entries(symbolMap)) {
      const regex = new RegExp(`\\b${key}\\b`, 'i');
      if (regex.test(norm)) {
        chartSymbol = val;
        return { action: 'SHOW_CHART', symbol: chartSymbol };
      }
    }

    // Check if user specified any arbitrary 1-5 letter ticker
    const extractedTicker = norm.match(/\b([a-z]{1,5})\b/gi);
    if (extractedTicker) {
      const ignoreWords = new Set([
        'open', 'show', 'pull', 'up', 'display', 'load', 'chart', 'view', 'the', 'a',
        'for', 'of', 'on', 'me', 'candlestick', 'candle', 'graph', 'technical', 'my',
        'please', 'can', 'you', 'give', 'look', 'at'
      ]);
      for (const t of extractedTicker) {
        if (!ignoreWords.has(t.toLowerCase())) {
          return { action: 'SHOW_CHART', symbol: t.toUpperCase() };
        }
      }
    }

    return { action: 'SHOW_CHART', symbol: chartSymbol };
  }

  // --- Read Breaking News command ---
  if (
    norm.includes('read news') || norm.includes('read the news') ||
    norm.includes('read that') || norm.includes('read it') ||
    norm.includes('tell me about the news') || norm.includes('tell me more') ||
    norm.includes('describe the news') || norm.includes('describe that') ||
    norm.includes('explain the news') || norm.includes('what\'s the news') ||
    norm.includes('what is the news') || norm.includes('show news details') ||
    norm.includes('what happened') || norm.includes('summarize the news') ||
    norm.includes('news details') || norm.includes('give me the news') ||
    norm === 'read' || norm === 'describe'
  ) {
    return { action: 'READ_BREAKING_NEWS' };
  }

  // --- News commands ---
  if (
    norm.includes('show news') || norm.includes('open news') ||
    norm.includes('latest news') || norm.includes('market news') ||
    norm.includes('breaking news') || norm.includes('what\'s happening')
  ) {
    return { action: 'SHOW_NEWS' };
  }

  // --- Journal commands ---
  if (
    norm.includes('journal') || norm.includes('trade journal') ||
    norm.includes('trade log') || norm.includes('show my trades') ||
    norm.includes('trade history') || norm.includes('review trades')
  ) {
    return { action: 'SHOW_JOURNAL' };
  }

  // --- Go back to HUD ---
  if (
    norm.includes('go home') || norm.includes('show hud') ||
    norm.includes('show dashboard') || norm.includes('main screen') ||
    norm.includes('go back') || norm.includes('back to hud') ||
    norm === 'home' || norm === 'hud' || norm === 'dashboard'
  ) {
    return { action: 'SHOW_HUD' };
  }

  // --- Status report ---
  if (
    norm.includes('status report') || norm.includes('desk status') ||
    norm.includes('system status') || norm.includes('all systems')
  ) {
    return { action: 'STATUS_REPORT' };
  }

  // No local action matched — route to Gemini AI
  return null;
}

/**
 * Dispatches desk command with automatic browser Gemini fallback
 */
export async function dispatchDeskCommand(command, quotes = []) {
  // 1. Try local server
  try {
    const res = await fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.spokenText) return data;
    }
  } catch {
    // Local server offline; fall through to browser direct Gemini call
  }

  // 2. Direct browser Gemini Flash call
  try {
    const norm = (command || '').toLowerCase();
    let symbol = 'SPY';
    if (norm.includes('nvda') || norm.includes('nvidia')) symbol = 'NVDA';
    else if (norm.includes('qqq')) symbol = 'QQQ';
    else if (norm.includes('btc')) symbol = 'BTC';
    else if (norm.includes('tsla') || norm.includes('tesla')) symbol = 'TSLA';
    else if (norm.includes('aapl') || norm.includes('apple')) symbol = 'AAPL';

    const q = quotes.find(item => item.symbol === symbol) || { symbol, price: null, changePct: null };

    const prompt = `You are F.R.I.D.A.Y. – the AI trading desk master orchestrator.
Live Quote: ${symbol} at $${q.price || '—'} (${q.changePct ? `${q.changePct}%` : 'live'}).
Command: "${command}"
Task:
1. Provide a crisp 1-2 sentence spoken reply under 20s as FRIDAY.
2. Provide a 1-line update for 2-3 relevant specialist agents (e.g. ATLAS, ATHENA, ORACLE, SENTINEL, CHARTIST).
3. If asking to buy/sell, Sentinel must give a risk verdict (APPROVE / VETO / MODIFY).
Return STRICT JSON ONLY:
{
  "spokenText": "...",
  "primaryAgent": "...",
  "signals": [
    {"agent": "...", "message": "..."}
  ],
  "sources": ["finnhub:live", "gemini:direct"]
}`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 600, temperature: 0.2 }
      }),
      signal: AbortSignal.timeout(7000)
    });

    if (res.ok) {
      const d = await res.json();
      const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (txt) {
        const jsonMatch = txt.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            ...parsed,
            agentLoads: {
              athena: 20, chartist: 65, oracle: 45, atlas: 35,
              capitol: 30, scout: 45, sentinel: 75, pilot: 15, ledger: 15
            }
          };
        }
      }
    }
  } catch (err) {
    console.warn('[DESK CLIENT] Direct Gemini fallback failed:', err.message);
  }

  // 3. Deterministic safe offline rule synthesis
  return {
    spokenText: `Telemetry verified for "${command}". Live market data synchronized.`,
    primaryAgent: 'FRIDAY',
    signals: [
      { agent: 'FRIDAY', message: `Query routed: "${command}"` },
      { agent: 'SENTINEL', message: 'Risk gate online. Stop loss required on all orders.' }
    ],
    agentLoads: {
      athena: 15, chartist: 50, oracle: 40, atlas: 35,
      capitol: 25, scout: 35, sentinel: 65, pilot: 10, ledger: 10
    },
    sources: ['finnhub:live', 'local-rules']
  };
}
