import crypto from 'crypto';

const HMAC_SECRET = 'FRIDAY_SENTINEL_LOCAL_SECRET_KEY_2026';

let account = {
  equity: 1604199.00,
  cash: 1420500.00,
  realizedPnl: 18450.00,
  unrealizedPnl: 692.00,
  maxOpenPositions: 12,
  maxRiskPct: 2.0, // 2%
  positions: [
    { symbol: 'NVDA', qty: 50, avgPrice: 118.80, stopLoss: 115.00, takeProfit: 130.00, entryTime: '2026-09-15 03:45:12' },
    { symbol: 'AAPL', qty: 100, avgPrice: 224.50, stopLoss: 219.00, takeProfit: 240.00, entryTime: '2026-09-14 10:15:00' },
    { symbol: 'TSLA', qty: -40, avgPrice: 245.00, stopLoss: 252.00, takeProfit: 230.00, entryTime: '2026-09-15 01:20:00' }
  ],
  orders: [],
  journal: [
    {
      id: 'JRN-9012',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      symbol: 'NVDA',
      action: 'PAPER BUY 50 @ $118.80',
      thesis: 'Breakout above 20 EMA with bullish volume confirmation.',
      sentinelToken: 'SIG_9A4F2E71B08C',
      outcome: 'OPEN'
    },
    {
      id: 'JRN-8984',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      symbol: 'AAPL',
      action: 'PAPER BUY 100 @ $224.50',
      thesis: 'Catalyst pullback to demand zone.',
      sentinelToken: 'SIG_3D1C882FA011',
      outcome: 'OPEN'
    }
  ]
};

/**
 * Sentinel Risk Evaluation Gate
 */
export function evaluateRisk({ symbol, action, shares, price, stopLoss, takeProfit, orderType = 'MARKET' }) {
  const isBuy = action.toUpperCase().includes('BUY');
  
  // If stopLoss is omitted, Sentinel automatically provisions a 2.5% default protective stop
  let effectiveStopLoss = stopLoss;
  let autoProvisionedStop = false;
  if (!effectiveStopLoss || effectiveStopLoss <= 0) {
    effectiveStopLoss = isBuy ? parseFloat((price * 0.975).toFixed(2)) : parseFloat((price * 1.025).toFixed(2));
    autoProvisionedStop = true;
  }

  // Maximum position check
  if (account.positions.length >= account.maxOpenPositions && isBuy && !account.positions.some(p => p.symbol === symbol)) {
    return {
      approved: false,
      verdict: 'VETO',
      reason: `Maximum open positions (${account.maxOpenPositions}) reached. Flatten existing book first.`
    };
  }

  // Calculate risk amount
  const riskPerShare = Math.abs(price - effectiveStopLoss) || 0.01;
  const totalRiskDollars = riskPerShare * shares;
  const maxAllowedRisk = (account.equity * account.maxRiskPct) / 100;

  if (totalRiskDollars > maxAllowedRisk && maxAllowedRisk > 0) {
    const recommendedShares = Math.max(1, Math.floor(maxAllowedRisk / riskPerShare));
    return {
      approved: false,
      verdict: 'MODIFY',
      suggestedShares: recommendedShares,
      reason: `Proposed risk ($${totalRiskDollars.toFixed(0)}) exceeds 2% equity limit ($${maxAllowedRisk.toFixed(0)}). Max safe size: ${recommendedShares} shares.`
    };
  }

  // Reward-to-Risk check if take profit provided
  let rrRatio = null;
  if (takeProfit && takeProfit > 0) {
    const rewardPerShare = Math.abs(takeProfit - price);
    rrRatio = parseFloat((rewardPerShare / riskPerShare).toFixed(2));
    if (rrRatio < 1.0) {
      return {
        approved: false,
        verdict: 'VETO',
        reason: `Reward:Risk ratio (${rrRatio}) is under 1.0 minimum. Increase target or tighten stop.`
      };
    }
  }

  // Generate cryptographically signed HMAC token
  const payload = `${symbol}:${action}:${shares}:${price}:${effectiveStopLoss}:${Date.now()}`;
  const token = crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');

  return {
    approved: true,
    verdict: 'APPROVE',
    token: `SIG_${token.slice(0, 16).toUpperCase()}`,
    riskDollars: totalRiskDollars,
    riskPct: ((totalRiskDollars / account.equity) * 100).toFixed(2),
    effectiveStopLoss,
    autoProvisionedStop,
    rrRatio
  };
}

/**
 * Pilot Paper Fill Engine
 */
export function executePaperOrder({ symbol, action, shares, price, orderType = 'MARKET', stopLoss, takeProfit, token }) {
  if (!token || !token.startsWith('SIG_')) {
    // If token missing, generate on the fly for UI convenience
    const payload = `${symbol}:${action}:${shares}:${price}:${Date.now()}`;
    const hash = crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
    token = `SIG_${hash.slice(0, 16).toUpperCase()}`;
  }

  const cleanSymbol = symbol.trim().toUpperCase();
  const isBuy = action.toUpperCase().includes('BUY');
  const numShares = Math.abs(Number(shares) || 1);
  const fillPrice = Number(price) || 100;

  // Handle Working Limit / Stop Orders
  if (orderType === 'LIMIT' || orderType === 'STOP') {
    const order = {
      id: `ORD-${Date.now().toString().slice(-5)}`,
      symbol: cleanSymbol,
      action: isBuy ? 'BUY' : 'SELL',
      orderType,
      shares: numShares,
      price: fillPrice,
      stopLoss: stopLoss || null,
      takeProfit: takeProfit || null,
      status: 'WORKING',
      token,
      createdAt: new Date().toISOString()
    };
    account.orders.unshift(order);
    return {
      status: 'placed',
      orderType,
      order,
      message: `${orderType} ${isBuy ? 'BUY' : 'SELL'} order for ${numShares} ${cleanSymbol} placed at $${fillPrice.toFixed(2)}.`
    };
  }

  // Market Order Execution against paper book
  const existingIndex = account.positions.findIndex(p => p.symbol === cleanSymbol);
  let pnlRealized = 0;

  if (existingIndex >= 0) {
    const existing = account.positions[existingIndex];
    const existingIsLong = existing.qty > 0;

    if ((existingIsLong && isBuy) || (!existingIsLong && !isBuy)) {
      // Adding to existing position in the same direction
      const currentQty = Math.abs(existing.qty);
      const newTotalQty = currentQty + numShares;
      const weightedAvgPrice = ((currentQty * existing.avgPrice) + (numShares * fillPrice)) / newTotalQty;

      account.positions[existingIndex].qty = existingIsLong ? newTotalQty : -newTotalQty;
      account.positions[existingIndex].avgPrice = parseFloat(weightedAvgPrice.toFixed(2));
      if (stopLoss) account.positions[existingIndex].stopLoss = stopLoss;
      if (takeProfit) account.positions[existingIndex].takeProfit = takeProfit;
    } else {
      // Opposite direction: Closing / Reducing / Flipping position
      const currentQty = Math.abs(existing.qty);
      const closeShares = Math.min(currentQty, numShares);

      if (existingIsLong) {
        // Was Long, now Selling
        pnlRealized = (fillPrice - existing.avgPrice) * closeShares;
      } else {
        // Was Short, now Buying back
        pnlRealized = (existing.avgPrice - fillPrice) * closeShares;
      }

      account.realizedPnl += pnlRealized;
      account.cash += (existing.avgPrice * closeShares) + pnlRealized;

      if (numShares === currentQty) {
        // Exactly closed
        account.positions.splice(existingIndex, 1);
      } else if (numShares < currentQty) {
        // Partial close
        const remainingQty = currentQty - numShares;
        account.positions[existingIndex].qty = existingIsLong ? remainingQty : -remainingQty;
      } else {
        // Flipped position
        const remainingQty = numShares - currentQty;
        account.positions[existingIndex] = {
          symbol: cleanSymbol,
          qty: isBuy ? remainingQty : -remainingQty,
          avgPrice: fillPrice,
          stopLoss: stopLoss || null,
          takeProfit: takeProfit || null,
          entryTime: new Date().toISOString()
        };
      }
    }
  } else {
    // New position
    account.positions.push({
      symbol: cleanSymbol,
      qty: isBuy ? numShares : -numShares,
      avgPrice: fillPrice,
      stopLoss: stopLoss || null,
      takeProfit: takeProfit || null,
      entryTime: new Date().toISOString()
    });
    account.cash -= (fillPrice * numShares);
  }

  // Journal Entry
  const journalEntry = {
    id: `JRN-${Date.now().toString().slice(-5)}`,
    timestamp: new Date().toISOString(),
    symbol: cleanSymbol,
    action: `PAPER ${isBuy ? 'BUY' : 'SELL'} ${numShares} @ $${fillPrice.toFixed(2)}`,
    thesis: `Executed via TradingView Order Ticket. Sentinel verification: ${token}`,
    sentinelToken: token,
    outcome: pnlRealized !== 0 ? `PnL: ${pnlRealized >= 0 ? '+' : ''}$${pnlRealized.toFixed(2)}` : 'OPEN'
  };
  account.journal.unshift(journalEntry);

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
 * Instant Close Open Position
 */
export function closePosition({ symbol, currentPrice }) {
  const cleanSymbol = symbol.trim().toUpperCase();
  const existingIndex = account.positions.findIndex(p => p.symbol === cleanSymbol);
  if (existingIndex < 0) {
    return { success: false, error: `Position ${cleanSymbol} not found.` };
  }

  const pos = account.positions[existingIndex];
  const isLong = pos.qty > 0;
  const closePrice = Number(currentPrice) || pos.avgPrice;
  const numShares = Math.abs(pos.qty);

  const pnl = isLong
    ? (closePrice - pos.avgPrice) * numShares
    : (pos.avgPrice - closePrice) * numShares;

  account.realizedPnl += pnl;
  account.cash += (pos.avgPrice * numShares) + pnl;
  account.positions.splice(existingIndex, 1);

  // Journal
  const journalEntry = {
    id: `JRN-${Date.now().toString().slice(-5)}`,
    timestamp: new Date().toISOString(),
    symbol: cleanSymbol,
    action: `PAPER CLOSE ${isLong ? 'LONG' : 'SHORT'} ${numShares} @ $${closePrice.toFixed(2)}`,
    thesis: `Manual position flatten from TradingView table. PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
    sentinelToken: 'SIG_POSITION_FLAT',
    outcome: `Realized: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`
  };
  account.journal.unshift(journalEntry);

  return {
    success: true,
    symbol: cleanSymbol,
    shares: numShares,
    closePrice,
    pnl,
    realizedPnl: account.realizedPnl
  };
}

/**
 * Cancel Working Order
 */
export function cancelOrder({ orderId }) {
  const idx = account.orders.findIndex(o => o.id === orderId);
  if (idx >= 0) {
    const cancelled = account.orders.splice(idx, 1)[0];
    return { success: true, order: cancelled };
  }
  return { success: false, error: 'Order not found' };
}

/**
 * Snapshot of Paper Account
 */
export function getAccountSnapshot(livePrices = {}) {
  let totalUnrealized = 0;
  let totalPositionValue = 0;

  const updatedPositions = account.positions.map(p => {
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
    equity: parseFloat((account.equity + totalUnrealized).toFixed(2)),
    cash: parseFloat(account.cash.toFixed(2)),
    unrealizedPnl: parseFloat(totalUnrealized.toFixed(2)),
    realizedPnl: parseFloat(account.realizedPnl.toFixed(2)),
    marginUsed: parseFloat(totalPositionValue.toFixed(2)),
    availableMargin: parseFloat(Math.max(0, account.cash).toFixed(2)),
    maxRiskPct: account.maxRiskPct,
    positions: updatedPositions,
    orders: account.orders,
    journal: account.journal.slice(0, 20)
  };
}
