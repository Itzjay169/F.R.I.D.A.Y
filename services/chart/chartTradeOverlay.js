/**
 * ChartTradeOverlay Store
 * Maintains a synchronized mapping between every paper trade, its lifecycle,
 * and its exact chart drawings (entry line, stop loss line, take profit line,
 * risk/reward zone, and trade labels) to guarantee zero orphaned lines.
 */

// In-memory trade overlay store
const overlays = new Map();

// In-memory agent structure drawings store (support/resistance, Fibonacci, supply/demand zones)
const structureDrawings = new Map();

/**
 * Creates an entry/stop/target drawing set for a filled paper trade
 */
export function createTradeOverlay({
  tradeId,
  symbol,
  side = 'BUY',
  shares,
  price,
  stopLoss,
  takeProfit,
  token
}) {
  if (!symbol) throw new Error('Symbol is required to create trade overlay');
  const cleanSymbol = symbol.trim().toUpperCase();
  const id = tradeId || `TRD-${cleanSymbol}-${Date.now()}`;
  const numShares = Math.abs(parseInt(shares) || 1);
  const entryPrice = parseFloat(price) || 0;
  const slPrice = stopLoss ? parseFloat(stopLoss) : null;
  const tpPrice = takeProfit ? parseFloat(takeProfit) : null;
  const isLong = side.toUpperCase().includes('BUY');

  // Drawing IDs tied to this specific trade
  const drawingIds = [
    `drw-entry-${id}`,
    slPrice ? `drw-sl-${id}` : null,
    tpPrice ? `drw-tp-${id}` : null,
    `drw-lbl-${id}`,
    slPrice && tpPrice ? `drw-zone-${id}` : null
  ].filter(Boolean);

  const tradeLabelText = `PAPER ${isLong ? 'LONG' : 'SHORT'} ${numShares} ${cleanSymbol} @ ${entryPrice.toFixed(2)} | SL ${slPrice ? slPrice.toFixed(2) : 'NONE'} | TP ${tpPrice ? tpPrice.toFixed(2) : 'NONE'}`;

  const overlayRecord = {
    trade_id: id,
    symbol: cleanSymbol,
    side: isLong ? 'BUY' : 'SELL',
    quantity: numShares,
    entry: entryPrice,
    stop: slPrice,
    target: tpPrice,
    status: 'OPEN',
    token: token || 'SIG_LOCAL',
    drawing_ids: drawingIds,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    drawings: {
      entryLine: {
        id: `drw-entry-${id}`,
        type: 'horizontal_line',
        price: entryPrice,
        color: '#00f0ff',
        style: 'solid',
        label: `ENTRY: $${entryPrice.toFixed(2)}`
      },
      stopLine: slPrice ? {
        id: `drw-sl-${id}`,
        type: 'horizontal_line',
        price: slPrice,
        color: '#ef4444',
        style: 'dashed',
        label: `STOP LOSS: $${slPrice.toFixed(2)}`
      } : null,
      targetLine: tpPrice ? {
        id: `drw-tp-${id}`,
        type: 'horizontal_line',
        price: tpPrice,
        color: '#10b981',
        style: 'dashed',
        label: `TAKE PROFIT: $${tpPrice.toFixed(2)}`
      } : null,
      tradeLabel: {
        id: `drw-lbl-${id}`,
        type: 'text_label',
        text: tradeLabelText,
        price: entryPrice,
        color: isLong ? '#00f0ff' : '#ec4899'
      },
      riskRewardZone: (slPrice && tpPrice) ? {
        id: `drw-zone-${id}`,
        type: 'risk_reward_zone',
        entry: entryPrice,
        stop: slPrice,
        target: tpPrice,
        ratio: Math.abs(tpPrice - entryPrice) / (Math.abs(entryPrice - slPrice) || 1)
      } : null
    }
  };

  overlays.set(id, overlayRecord);
  return overlayRecord;
}

/**
 * Updates an existing trade overlay (e.g., trailing stop, partial close, adjusted target)
 */
export function updateTradeOverlay(tradeId, updates = {}) {
  const existing = overlays.get(tradeId);
  if (!existing) {
    throw new Error(`Trade overlay with ID "${tradeId}" not found`);
  }

  const updated = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
    status: updates.status || 'MODIFIED'
  };

  if (updates.stopLoss !== undefined) {
    updated.stop = parseFloat(updates.stopLoss);
    if (updated.drawings.stopLine) {
      updated.drawings.stopLine.price = updated.stop;
      updated.drawings.stopLine.label = `STOP LOSS: $${updated.stop.toFixed(2)}`;
    }
  }

  if (updates.takeProfit !== undefined) {
    updated.target = parseFloat(updates.takeProfit);
    if (updated.drawings.targetLine) {
      updated.drawings.targetLine.price = updated.target;
      updated.drawings.targetLine.label = `TAKE PROFIT: $${updated.target.toFixed(2)}`;
    }
  }

  if (updates.shares !== undefined) {
    updated.quantity = Math.abs(parseInt(updates.shares));
  }

  // Update composite label text
  const isLong = updated.side === 'BUY';
  updated.drawings.tradeLabel.text = `PAPER ${isLong ? 'LONG' : 'SHORT'} ${updated.quantity} ${updated.symbol} @ ${updated.entry.toFixed(2)} | SL ${updated.stop ? updated.stop.toFixed(2) : 'NONE'} | TP ${updated.target ? updated.target.toFixed(2) : 'NONE'}`;

  overlays.set(tradeId, updated);
  return updated;
}

/**
 * Removes or archives a trade overlay when a trade is closed, stopped out, or cancelled.
 * Guarantees that corresponding drawing IDs are detached and old trades do NOT leave orphaned lines.
 */
export function removeTradeOverlay(tradeId, reason = 'CLOSED') {
  const existing = overlays.get(tradeId);
  if (!existing) return null;

  const detachedDrawingIds = [...existing.drawing_ids];

  const archived = {
    ...existing,
    status: reason,
    drawing_ids: [], // Purged to prevent orphaned drawings
    drawings: {},
    closedAt: new Date().toISOString()
  };

  overlays.set(tradeId, archived);
  return {
    tradeId,
    reason,
    detachedDrawingIds,
    archived
  };
}

/**
 * Returns all active trade overlays for a given symbol
 */
export function getOverlaysForSymbol(symbol) {
  if (!symbol) return [];
  const clean = symbol.trim().toUpperCase();
  const list = [];
  for (const overlay of overlays.values()) {
    if (overlay.symbol === clean && (overlay.status === 'OPEN' || overlay.status === 'MODIFIED')) {
      list.push(overlay);
    }
  }
  return list;
}

/**
 * Returns all overlays regardless of symbol
 */
export function getAllOverlays() {
  return Array.from(overlays.values());
}

/**
 * Adds an agent-generated structure drawing (support/resistance, Fibonacci, zones, liquidity)
 */
export function addStructureDrawing({
  symbol,
  agent = 'CHARTIST',
  type, // 'level' | 'zone' | 'fibonacci' | 'trendline' | 'text'
  data,
  label
}) {
  if (!symbol) throw new Error('Symbol required for structure drawing');
  const clean = symbol.trim().toUpperCase();
  const id = `struct-${agent.toLowerCase()}-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const drawing = {
    id,
    symbol: clean,
    agent: agent.toUpperCase(),
    type,
    data,
    label: label || `${agent.toUpperCase()} // ${type.toUpperCase()}`,
    createdAt: new Date().toISOString()
  };

  if (!structureDrawings.has(clean)) {
    structureDrawings.set(clean, []);
  }
  structureDrawings.get(clean).push(drawing);
  return drawing;
}

/**
 * Retrieves all structure drawings for a given symbol
 */
export function getStructureDrawingsForSymbol(symbol) {
  if (!symbol) return [];
  const clean = symbol.trim().toUpperCase();
  return structureDrawings.get(clean) || [];
}

/**
 * Clears agent drawings for a symbol while strictly preserving manual drawings
 */
export function clearAgentDrawings(symbol, agentFilter = null) {
  if (!symbol) return { cleared: 0 };
  const clean = symbol.trim().toUpperCase();
  const current = structureDrawings.get(clean) || [];

  if (agentFilter) {
    const kept = current.filter(d => d.agent !== agentFilter.toUpperCase());
    const clearedCount = current.length - kept.length;
    structureDrawings.set(clean, kept);
    return { symbol: clean, cleared: clearedCount, preserved: kept.length };
  } else {
    const clearedCount = current.length;
    structureDrawings.set(clean, []);
    return { symbol: clean, cleared: clearedCount, preservedManual: 'ALL_MANUAL_DRAWINGS_PRESERVED' };
  }
}

/**
 * Resets the entire overlay store (primarily for unit tests)
 */
export function resetOverlayStore() {
  overlays.clear();
  structureDrawings.clear();
}
